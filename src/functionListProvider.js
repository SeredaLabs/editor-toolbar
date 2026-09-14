'use strict';
const vscode = require('vscode');
const { parseInWorker } = require('./parseInWorker');
const { KIND_LABEL, groupByKindLabel } = require('./symbolGroups');

const CACHE_LIMIT = 32;

function flattenSymbols(symbols, uri, languageId, text) {
  const result = [];
  const lines = text.split(/\r\n|\r|\n/);
  function visit(symbol) {
    const range = symbol.selectionRange || symbol.location?.range || symbol.range;
    if ((!symbol.location || symbol.location.uri.toString() === uri) && range &&
        [vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Constructor].includes(symbol.kind)) {
      let kind = symbol.kind === vscode.SymbolKind.Function ? 'function' : 'method';
      if (languageId === 'bsl') {
        kind = /^\s*(?:Процедура|Procedure)\s/i.test(lines[range.start.line] || '') ? 'bsl-procedure' : 'bsl-function';
      }
      result.push({ name: symbol.name, line: range.start.line, character: range.start.character, kind });
    }
    for (const child of symbol.children || []) visit(child);
  }
  for (const symbol of symbols || []) visit(symbol);
  return result;
}

// Editor language providers are external extensions: stop waiting if they stall.
function boundedSymbols(request, signal, timeoutMs = 1500) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(value);
    };
    const abort = () => finish(undefined);
    const timer = setTimeout(abort, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    Promise.resolve().then(request).then(finish, () => finish(undefined));
  });
}

class FunctionListProvider {
  constructor(extensionUri, { symbolProvider, parser = parseInWorker } = {}) {
    this._extensionUri = extensionUri;
    this._symbolProvider = symbolProvider || (uri => vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri));
    this._parser = parser;
    this._cache = new Map();
    this._debounceTimer = null;
    this._debounceDocument = null;
    this._disposed = false;
    this._picker = null;
    this._highlightTimer = null;
    this._highlightEditor = null;
    this._revealHighlight = vscode.window.createTextEditorDecorationType({
      isWholeLine: true, backgroundColor: new vscode.ThemeColor('editor.symbolHighlightBackground'),
      borderColor: new vscode.ThemeColor('editor.symbolHighlightBorder'), borderWidth: '1px', borderStyle: 'solid',
    });
    this._listeners = [
      vscode.workspace.onDidCloseTextDocument(doc => this.invalidate(doc)),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length) this.invalidate(event.document);
      }),
      vscode.workspace.onDidChangeConfiguration(event => {
        for (const entry of [...this._cache.values()]) {
          if (event.affectsConfiguration('editorToolbar.customPatterns', entry.document.uri)) this.invalidate(entry.document);
        }
      }),
      // A newly activated language extension can replace fallback results.
      vscode.extensions.onDidChange(() => {
        for (const entry of [...this._cache.values()]) this.invalidate(entry.document);
      }),
    ];
  }

  invalidate(doc) {
    const key = doc.uri.toString();
    this._cache.get(key)?.controller.abort();
    this._cache.delete(key);
    if (this._debounceDocument === doc) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
      this._debounceDocument = null;
    }
    if (this._picker?.document === doc) {
      const { qp } = this._picker;
      this._picker = null;
      qp.hide();
    }
  }

  refresh(doc) { return doc ? this._getFunctions(doc) : Promise.resolve([]); }

  refreshDebounced(doc) {
    clearTimeout(this._debounceTimer);
    this._debounceDocument = doc;
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._debounceDocument = null;
      if (!this._disposed && !doc.isClosed) void this.refresh(doc);
    }, 500);
  }

  _patterns(doc) {
    const value = vscode.workspace.getConfiguration('editorToolbar', doc.uri).get('customPatterns', []);
    return Array.isArray(value) ? value.filter(pattern => typeof pattern === 'string' && pattern.length <= 1024).slice(0, 32) : [];
  }

  _parse(doc) {
    return this._parser({ text: doc.getText(), languageId: doc.languageId, customPatterns: this._patterns(doc) });
  }

  async _collect(doc, snapshot, signal) {
    const symbols = await boundedSymbols(() => this._symbolProvider(doc.uri), signal);
    if (signal.aborted) return [];
    const native = flattenSymbols(symbols, doc.uri.toString(), snapshot.languageId, snapshot.text);
    // An empty symbol list is also returned when there is no provider. Use fallback then.
    if (native.length && !snapshot.customPatterns.length) return native;
    let parsed;
    try {
      parsed = await this._parser({ ...snapshot, customOnly: native.length > 0 }, { signal });
    } catch (error) {
      error.partialResults = native;
      throw error;
    }
    const seen = new Set(native.map(item => `${item.line}:${item.name}`));
    return [...native, ...parsed.filter(item => !seen.has(`${item.line}:${item.name}`))];
  }

  _getFunctions(doc) {
    if (this._disposed || doc.isClosed) return Promise.resolve([]);
    const key = doc.uri.toString();
    const patterns = this._patterns(doc);
    const configKey = JSON.stringify(patterns);
    const previous = this._cache.get(key);
    if (previous && previous.document === doc && previous.version === doc.version &&
        previous.languageId === doc.languageId && previous.configKey === configKey) {
      this._cache.delete(key);
      this._cache.set(key, previous);
      return previous.promise;
    }
    this.invalidate(doc);
    const entry = { document: doc, version: doc.version, languageId: doc.languageId, configKey,
      controller: new AbortController(), results: [], error: null };
    const snapshot = { text: doc.getText(), languageId: doc.languageId, customPatterns: patterns };
    this._cache.set(key, entry);
    while (this._cache.size > CACHE_LIMIT) {
      const oldest = this._cache.keys().next().value;
      this._cache.get(oldest).controller.abort();
      this._cache.delete(oldest);
    }
    entry.promise = this._collect(doc, snapshot, entry.controller.signal).then(results => {
      if (this._cache.get(key) !== entry || doc.isClosed || doc.version !== entry.version ||
          doc.languageId !== entry.languageId || entry.controller.signal.aborted) return [];
      entry.results = results;
      return results;
    }).catch(error => {
      if (error.code !== 'ABORTED' && this._cache.get(key) === entry) {
        entry.error = error;
        entry.results = error.partialResults || [];
        return entry.results;
      }
      return [];
    });
    return entry.promise;
  }

  async showQuickPick() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || this._disposed) return;
    this._picker?.qp.hide();
    const document = editor.document;
    const version = document.version;
    // Start before assigning _picker: cache replacement invalidates the previous picker.
    const loading = this._getFunctions(document);
    const qp = vscode.window.createQuickPick();
    const picker = { qp, document };
    this._picker = picker;
    qp.placeholder = vscode.l10n.t('Go to function or procedure…');
    qp.matchOnDescription = true;
    qp.busy = true;
    qp.buttons = [{ iconPath: new vscode.ThemeIcon('sort-precedence'), tooltip: vscode.l10n.t('Sort A→Z / by line') }];
    let functions = [];
    let sortedAlpha = false;
    const kindIcons = { procedure: 'symbol-event', function: 'symbol-function', method: 'symbol-property', custom: 'symbol-key' };
    const buildItems = () => groupByKindLabel(functions).flatMap(group => [
      { kind: vscode.QuickPickItemKind.Separator, label: vscode.l10n.t(group.title) },
      ...group.items.slice().sort(sortedAlpha ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.line - b.line)
        .map(fn => ({ ...fn, label: fn.name,
          description: `${vscode.l10n.t(KIND_LABEL[fn.kind] || 'Function')} · ${vscode.l10n.t('line {0}', fn.line + 1)}`,
          iconPath: fn.kind.startsWith('bsl-')
            ? vscode.Uri.joinPath(this._extensionUri, 'images', fn.kind === 'bsl-procedure' ? 'icon-procedure.svg' : 'icon-function.svg')
            : new vscode.ThemeIcon(kindIcons[fn.kind] || 'symbol-function'),
        })),
    ]);
    qp.onDidTriggerButton(() => {
      sortedAlpha = !sortedAlpha;
      qp.placeholder = vscode.l10n.t(sortedAlpha ? 'Sorted A→Z' : 'Sorted by line');
      qp.items = buildItems();
    });
    qp.onDidAccept(() => {
      const picked = qp.selectedItems[0] || qp.activeItems[0];
      if (qp.busy || !picked || !Number.isInteger(picked.line)) return;
      qp.hide();
      void this._navigate(editor, picked, version).catch(() =>
        vscode.window.showWarningMessage(vscode.l10n.t('Could not open the selected symbol.')));
    });
    qp.onDidHide(() => {
      if (this._picker === picker) this._picker = null;
      qp.dispose();
    });
    qp.show();
    functions = await loading;
    if (this._picker !== picker || document.isClosed || document.version !== version) return;
    qp.busy = false;
    const error = this._cache.get(document.uri.toString())?.error;
    if (error) {
      vscode.window.showWarningMessage(vscode.l10n.t('Function detection stopped. Check custom patterns or try a smaller file.'));
    }
    if (!functions.length) {
      qp.hide();
      if (!error) vscode.window.showInformationMessage(vscode.l10n.t('No functions or procedures found in this file.'));
    } else qp.items = buildItems();
  }

  async _navigate(editor, symbol, version) {
    const doc = editor.document;
    if (doc.isClosed || doc.version !== version || symbol.line < 0 || symbol.line >= doc.lineCount) return;
    const target = await vscode.window.showTextDocument(doc, { viewColumn: editor.viewColumn, preview: false, preserveFocus: false });
    if (doc.version !== version || vscode.window.activeTextEditor !== target) return;
    const pos = doc.validatePosition(new vscode.Position(symbol.line, symbol.character || 0));
    target.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand('editor.unfold', { selectionLines: [symbol.line], levels: 1 });
    if (doc.isClosed || doc.version !== version) return;
    target.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    this._flashLine(target, symbol.line);
  }

  _clearHighlight() {
    clearTimeout(this._highlightTimer);
    this._highlightTimer = null;
    if (this._highlightEditor && !this._highlightEditor.document.isClosed) {
      this._highlightEditor.setDecorations(this._revealHighlight, []);
    }
    this._highlightEditor = null;
  }

  _flashLine(editor, line) {
    this._clearHighlight();
    this._highlightEditor = editor;
    editor.setDecorations(this._revealHighlight, [new vscode.Range(line, 0, line, 0)]);
    this._highlightTimer = setTimeout(() => this._clearHighlight(), 700);
  }

  dispose() {
    this._disposed = true;
    for (const listener of this._listeners) listener.dispose();
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    this._debounceDocument = null;
    for (const entry of this._cache.values()) entry.controller.abort();
    this._cache.clear();
    this._picker?.qp.hide();
    this._clearHighlight();
    this._revealHighlight.dispose();
  }
}

module.exports = { FunctionListProvider, groupByKindLabel, flattenSymbols };
