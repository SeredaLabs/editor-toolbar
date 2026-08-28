'use strict';
const vscode = require('vscode');

const STORAGE_KEY = 'editorToolbar.bookmarks';

class BookmarkManager {
  constructor(context) {
    this._context = context;
    this._bookmarks = this._load(); // uri -> Set<line>
    this._decoration = null;
    this._createDecoration();
    context.subscriptions.push(this);
  }

  _load() {
    const stored = this._context.workspaceState.get(STORAGE_KEY, {});
    const map = new Map();
    for (const [uri, lines] of Object.entries(stored)) {
      map.set(uri, new Set(lines));
    }
    return map;
  }

  _save() {
    const stored = {};
    for (const [uri, lines] of this._bookmarks) {
      if (lines.size) stored[uri] = [...lines];
    }
    this._context.workspaceState.update(STORAGE_KEY, stored);
  }

  _createDecoration() {
    const color = vscode.workspace.getConfiguration('editorToolbar').get('bookmarkColor', '#ff6b35');
    if (this._decoration) this._decoration.dispose();
    this._decoration = vscode.window.createTextEditorDecorationType({
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
    this._save();
    this.refreshDecorations();
  }

  next() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getSorted(editor.document.uri.toString());
    if (!lines.length) return;
    const cur = editor.selection.active.line;
    const next = lines.find(l => l > cur) ?? lines[0];
    this._goTo(editor, next);
  }

  prev() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getSorted(editor.document.uri.toString());
    if (!lines.length) return;
    const cur = editor.selection.active.line;
    const prev = [...lines].reverse().find(l => l < cur) ?? lines[lines.length - 1];
    this._goTo(editor, prev);
  }

  async list() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lines = this._getSorted(editor.document.uri.toString());
    if (!lines.length) {
      vscode.window.showInformationMessage('No bookmarks in this file.');
      return;
    }

    const items = lines.map(line => ({
      label: editor.document.lineAt(line).text.trim() || '(empty line)',
      description: `line ${line + 1}`,
      line,
    }));

    const picked = await vscode.window.showQuickPick(items, { placeholder: 'Go to bookmark…' });
    if (picked) this._goTo(editor, picked.line);
  }

  refreshDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this._decoration) return;
    const lines = this._getSorted(editor.document.uri.toString());
    editor.setDecorations(this._decoration, lines.map(l => ({ range: new vscode.Range(l, 0, l, 0) })));
  }

  _getSorted(uri) {
    return [...(this._bookmarks.get(uri) ?? [])].sort((a, b) => a - b);
  }

  _goTo(editor, line) {
    const pos = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  dispose() {
    this._decoration?.dispose();
  }
}

module.exports = { BookmarkManager };
