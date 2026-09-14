'use strict';
const vscode = require('vscode');
const { moveBookmarks } = require('./bookmarkPositions');

const STORAGE_KEY = 'editorToolbar.bookmarks';

class BookmarkManager {
  constructor(context) {
    this._context = context;
    this._bookmarks = this._load(); // uri -> Set<line>
    this._decorations = new Map();
    this._savePromise = Promise.resolve();
    this._listeners = [
      vscode.workspace.onDidChangeTextDocument(event => this._onChange(event)),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshDecorations()),
      vscode.workspace.onDidOpenTextDocument(() => this.refreshDecorations()),
      vscode.workspace.onDidRenameFiles(event => this._rename(event.files)),
      vscode.workspace.onDidDeleteFiles(event => this._delete(event.files)),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('editorToolbar.bookmarkColor')) this.refreshDecorations();
      }),
    ];
    context.subscriptions.push(this);
  }

  _load() {
    const stored = this._context.workspaceState.get(STORAGE_KEY, {});
    const map = new Map();
    for (const [uri, lines] of Object.entries(stored && typeof stored === 'object' ? stored : {})) {
      if (Array.isArray(lines)) map.set(uri, new Set(lines.filter(line => Number.isInteger(line) && line >= 0)));
    }
    return map;
  }

  _save() {
    const stored = {};
    for (const [uri, lines] of this._bookmarks) {
      if (lines.size) stored[uri] = [...lines];
    }
    this._savePromise = this._savePromise
      .then(() => this._context.workspaceState.update(STORAGE_KEY, stored))
      .catch(() => { void vscode.window.showWarningMessage(vscode.l10n.t('Could not save bookmarks.')); });
    return this._savePromise;
  }

  _onChange(event) {
    const key = event.document.uri.toString();
    const lines = this._bookmarks.get(key);
    if (!lines || !event.contentChanges.length) return;
    this._bookmarks.set(key, moveBookmarks(lines, event.contentChanges, event.document.lineCount));
    this._save();
    this.refreshDecorations();
  }

  _rename(files) {
    for (const { oldUri, newUri } of files) {
      const oldKey = oldUri.toString();
      for (const [key, lines] of [...this._bookmarks]) {
        if (key === oldKey || key.startsWith(oldKey + '/')) {
          const nextKey = newUri.toString() + key.slice(oldKey.length);
          this._bookmarks.set(nextKey, new Set([...(this._bookmarks.get(nextKey) || []), ...lines]));
          this._bookmarks.delete(key);
        }
      }
    }
    this._save();
    this.refreshDecorations();
  }

  _delete(files) {
    for (const uri of files) {
      const prefix = uri.toString();
      for (const key of this._bookmarks.keys()) {
        if (key === prefix || key.startsWith(prefix + '/')) this._bookmarks.delete(key);
      }
    }
    this._save();
    this.refreshDecorations();
  }

  _color(doc) {
    const color = vscode.workspace.getConfiguration('editorToolbar', doc.uri).get('bookmarkColor', '#ff6b35');
    return typeof color === 'string' && /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) ? color : '#ff6b35';
  }

  _createDecoration(color) {
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: this._gutterIcon(color),
      gutterIconSize: '80%',
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  _gutterIcon(color) {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<path d="M3 2h10v12l-5-3-5 3V2z" fill="${color}"/></svg>`
    ).toString('base64');
    return vscode.Uri.parse(`data:image/svg+xml;base64,${svg}`);
  }

  toggle() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const uri = editor.document.uri.toString();
    const line = editor.selection.active.line;
    if (!this._bookmarks.has(uri)) this._bookmarks.set(uri, new Set());
    const lines = this._bookmarks.get(uri);
    lines.has(line) ? lines.delete(line) : lines.add(line);
    this.refreshDecorations();
    return this._save();
  }

  next() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getLines(editor.document);
    if (!lines.length) return;
    const cur = editor.selection.active.line;
    const next = lines.find(l => l > cur) ?? lines[0];
    this._goTo(editor, next);
  }

  prev() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getLines(editor.document);
    if (!lines.length) return;
    const cur = editor.selection.active.line;
    const prev = [...lines].reverse().find(l => l < cur) ?? lines[lines.length - 1];
    this._goTo(editor, prev);
  }

  async list() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getLines(editor.document);
    if (!lines.length) {
      vscode.window.showInformationMessage(vscode.l10n.t('No bookmarks in this file.'));
      return;
    }

    const items = lines.map(line => ({
      label: editor.document.lineAt(line).text.trim() || vscode.l10n.t('(empty line)'),
      description: vscode.l10n.t('line {0}', line + 1),
      line,
    }));

    const version = editor.document.version;
    const picked = await vscode.window.showQuickPick(items, { placeholder: vscode.l10n.t('Go to bookmark…') });
    if (picked && !editor.document.isClosed && editor.document.version === version) {
      const target = await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preview: false });
      this._goTo(target, picked.line);
    }
  }

  refreshDecorations() {
    const used = new Set();
    for (const editor of vscode.window.visibleTextEditors) {
      const color = this._color(editor.document);
      used.add(color);
      if (!this._decorations.has(color)) this._decorations.set(color, this._createDecoration(color));
      for (const [other, decoration] of this._decorations) {
        if (other !== color) editor.setDecorations(decoration, []);
      }
      const lines = this._getLines(editor.document);
      editor.setDecorations(this._decorations.get(color), lines.map(l => ({ range: new vscode.Range(l, 0, l, 0) })));
    }
    for (const [color, decoration] of this._decorations) {
      if (!used.has(color)) { decoration.dispose(); this._decorations.delete(color); }
    }
  }

  _getLines(doc) {
    const key = doc.uri.toString();
    const stored = this._getSorted(key);
    const valid = stored.filter(line => line < doc.lineCount);
    if (valid.length !== stored.length) {
      this._bookmarks.set(key, new Set(valid));
      this._save();
    }
    return valid;
  }

  _getSorted(uri) {
    return [...(this._bookmarks.get(uri) ?? [])].sort((a, b) => a - b);
  }

  _goTo(editor, line) {
    if (editor.document.isClosed || line < 0 || line >= editor.document.lineCount) return;
    const pos = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  dispose() {
    for (const listener of this._listeners) listener.dispose();
    for (const decoration of this._decorations.values()) decoration.dispose();
    this._decorations.clear();
  }
}

module.exports = { BookmarkManager };
