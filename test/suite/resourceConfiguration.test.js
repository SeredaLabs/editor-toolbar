'use strict';
const { suite } = require('uvu');
const assert = require('assert');
const vscode = require('vscode');
const { BookmarkManager } = require('../../src/bookmarkManager');
const { FunctionListProvider } = require('../../src/functionListProvider');

const test = suite('Resource settings and file lifecycle');
let manager;
let provider;
test.before.each(() => {
  manager = new BookmarkManager({ subscriptions: [], workspaceState: { get: () => ({}), update: async () => {} } });
  provider = new FunctionListProvider(vscode.Uri.file(__dirname), { symbolProvider: async () => undefined });
});
test.after.each(() => { manager.dispose(); provider.dispose(); });

async function file(folder, name, text) {
  const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[folder].uri, name);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text));
  return vscode.workspace.openTextDocument(uri);
}

test('reads folder-specific patterns and renders separate bookmark colors', async () => {
  const first = await file(0, 'custom.txt', '@@first(\n%%second(');
  const second = await file(1, 'custom.txt', '@@first(\n%%second(');
  assert.deepStrictEqual((await provider._getFunctions(first)).map(item => item.name), ['first']);
  assert.deepStrictEqual((await provider._getFunctions(second)).map(item => item.name), ['second']);
  await vscode.window.showTextDocument(first, { viewColumn: vscode.ViewColumn.One, preview: false });
  await vscode.window.showTextDocument(second, { viewColumn: vscode.ViewColumn.Two, preview: false });
  manager.refreshDecorations();
  assert.ok(manager._decorations.has('#123456'));
  assert.ok(manager._decorations.has('#abcdef'));
  const config = vscode.workspace.getConfiguration('editorToolbar', second.uri);
  try {
    await config.update('bookmarkColor', '#fedcba', vscode.ConfigurationTarget.WorkspaceFolder);
    assert.ok(manager._decorations.has('#fedcba'), 'color should update without reloading the extension');
  } finally { await config.update('bookmarkColor', '#abcdef', vscode.ConfigurationTarget.WorkspaceFolder); }
});

test('keeps bookmarks when a file is renamed through VS Code', async () => {
  const document = await file(0, 'rename-before.txt', 'head\ntarget');
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(1, 0, 1, 0);
  await manager.toggle();
  const destination = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'rename-after.txt');
  const edit = new vscode.WorkspaceEdit();
  edit.renameFile(document.uri, destination, { overwrite: true });
  assert.ok(await vscode.workspace.applyEdit(edit));
  assert.deepStrictEqual(manager._getSorted(destination.toString()), [1]);
  assert.deepStrictEqual(manager._getSorted(document.uri.toString()), []);
});

test('rejects an invalid color before constructing SVG', async () => {
  const document = await file(1, 'color.txt', 'text');
  const config = vscode.workspace.getConfiguration('editorToolbar', document.uri);
  try {
    await config.update('bookmarkColor', '"><invalid/>', vscode.ConfigurationTarget.WorkspaceFolder);
    assert.strictEqual(manager._color(document), '#ff6b35');
  } finally { await config.update('bookmarkColor', '#abcdef', vscode.ConfigurationTarget.WorkspaceFolder); }
});
test.run();
