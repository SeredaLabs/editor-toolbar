'use strict';
const { suite } = require('uvu');
const assert = require('assert');
const vscode = require('vscode');
const { FunctionListProvider } = require('../../src/functionListProvider');

(() => {
  const test = suite('Navigator regressions');
  let provider;
  test.before.each(() => { provider = new FunctionListProvider(vscode.Uri.file(__dirname), { symbolProvider: async () => undefined }); });
  test.after.each(async () => {
    provider.dispose();
    await vscode.workspace.getConfiguration('editorToolbar').update('customPatterns', undefined, vscode.ConfigurationTarget.Global);
  });
  const doc = (content, language = 'javascript') => vscode.workspace.openTextDocument({ content, language });

  test('invalidates cached results after changing custom patterns', async () => {
    const document = await doc('@@hello(', 'plaintext');
    assert.deepStrictEqual(await provider._getFunctions(document), []);
    await vscode.workspace.getConfiguration('editorToolbar').update('customPatterns', ['^@@(\\w+)\\('], vscode.ConfigurationTarget.Global);
    assert.strictEqual((await provider._getFunctions(document))[0].name, 'hello');
  });

  test('uses the new language even when the document version is unchanged', async () => {
    const document = await doc('def python_func():\nfunction js_func() {}', 'python');
    assert.strictEqual((await provider._getFunctions(document))[0].name, 'python_func');
    const changed = await vscode.languages.setTextDocumentLanguage(document, 'javascript');
    assert.strictEqual((await provider._getFunctions(changed))[0].name, 'js_func');
  });

  test('ignores late results from an obsolete document version', async () => {
    let complete;
    provider.dispose();
    provider = new FunctionListProvider(vscode.Uri.file(__dirname), {
      symbolProvider: async () => undefined,
      parser: () => new Promise(resolve => { complete = resolve; }),
    });
    const document = await doc('function oldName() {}');
    const editor = await vscode.window.showTextDocument(document);
    const pending = provider._getFunctions(document);
    while (!complete) await new Promise(resolve => setTimeout(resolve, 5));
    await editor.edit(edit => edit.replace(new vscode.Range(0, 0, 0, 21), 'function newName() {}'));
    complete([{ name: 'oldName', line: 0, kind: 'function' }]);
    assert.deepStrictEqual(await pending, []);
    assert.strictEqual(provider._cache.has(document.uri.toString()), false);
  });

  test('uses provider symbols, including nested methods, without fallback guesses', async () => {
    const document = await doc('class Example {\n method() {}\n}');
    provider.dispose();
    provider = new FunctionListProvider(vscode.Uri.file(__dirname), {
      symbolProvider: async () => [{ name: 'Example', kind: vscode.SymbolKind.Class,
        children: [{ name: 'method', kind: vscode.SymbolKind.Method,
          selectionRange: new vscode.Range(1, 1, 1, 7) }] }],
      parser: () => { throw new Error('Fallback must not run'); },
    });
    assert.deepStrictEqual(await provider._getFunctions(document), [{ name: 'method', line: 1, character: 1, kind: 'method' }]);
  });

  test('reactivates the captured split editor before unfolding the destination', async () => {
    const original = await doc('function foo() {\n  return 1;\n}\n');
    const left = await vscode.window.showTextDocument(original, { viewColumn: vscode.ViewColumn.One, preview: false });
    await vscode.commands.executeCommand('editor.fold', { selectionLines: [0] });
    const other = await doc('function other() {\n  return 2;\n}\n');
    const right = await vscode.window.showTextDocument(other, { viewColumn: vscode.ViewColumn.Two, preview: false });
    await vscode.commands.executeCommand('editor.fold', { selectionLines: [0] });
    await provider._navigate(left, { line: 0 }, original.version);
    assert.strictEqual(vscode.window.activeTextEditor.document, original);
    assert.ok(left.visibleRanges.some(range => range.start.line <= 1 && range.end.line >= 1));
    assert.ok(!right.visibleRanges.some(range => range.start.line <= 1 && range.end.line >= 1));
  });

  test('does not navigate to a stale line after an edit', async () => {
    const document = await doc('function foo() {}');
    const editor = await vscode.window.showTextDocument(document);
    const version = document.version;
    await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '\n'));
    const before = editor.selection;
    await provider._navigate(editor, { line: 0 }, version);
    assert.deepStrictEqual(editor.selection, before);
  });
  test('loads the picker and closes it when its document changes', async () => {
    const document = await doc('function target() {}');
    const editor = await vscode.window.showTextDocument(document);
    await provider.showQuickPick();
    assert.ok(provider._picker, 'picker should remain open after loading');
    assert.ok(provider._picker.qp.items.some(item => item.label === 'target'));
    await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '\n'));
    assert.strictEqual(provider._picker, null, 'obsolete line numbers must not remain selectable');
  });

  test('retains native symbols when a custom pattern times out', async () => {
    const document = await doc('function native() {}');
    await vscode.workspace.getConfiguration('editorToolbar').update('customPatterns', ['(x)'], vscode.ConfigurationTarget.Global);
    provider.dispose();
    provider = new FunctionListProvider(vscode.Uri.file(__dirname), {
      symbolProvider: async () => [{ name: 'native', kind: vscode.SymbolKind.Function, selectionRange: new vscode.Range(0, 9, 0, 15) }],
      parser: async () => { throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); },
    });
    assert.strictEqual((await provider._getFunctions(document))[0].name, 'native');
    assert.strictEqual(provider._cache.get(document.uri.toString()).error.code, 'TIMEOUT');
  });
  test.run();
})();
