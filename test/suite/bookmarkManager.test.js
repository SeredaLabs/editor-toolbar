'use strict';
const { suite } = require('uvu');
const assert = require('assert');
const vscode = require('vscode');
const { BookmarkManager } = require('../../src/bookmarkManager');

(() => {
  const test = suite('Bookmarks');
  let manager;
  let saved;
  test.before.each(() => {
    saved = {};
    manager = new BookmarkManager({ subscriptions: [], workspaceState: {
      get: () => saved,
      update: async (_key, value) => { saved = value; },
    } });
  });
  test.after.each(() => manager.dispose());

  async function editor(content) {
    const doc = await vscode.workspace.openTextDocument({ content, language: 'plaintext' });
    return vscode.window.showTextDocument(doc, { preview: false });
  }
  async function mark(ed, line) {
    ed.selection = new vscode.Selection(line, 0, line, 0);
    await manager.toggle();
  }

  test('follows inserted lines, including undo and redo, and persists moved positions', async () => {
    const ed = await editor('head\ntarget\ntail');
    await mark(ed, 1);
    await ed.edit(edit => edit.insert(new vscode.Position(0, 0), 'new\n'));
    await manager._savePromise;
    assert.deepStrictEqual(saved[ed.document.uri.toString()], [2]);
    await vscode.commands.executeCommand('undo');
    assert.deepStrictEqual(manager._getLines(ed.document), [1]);
    await vscode.commands.executeCommand('redo');
    assert.deepStrictEqual(manager._getLines(ed.document), [2]);
  });

  test('removes a deleted line bookmark without breaking list or navigation', async () => {
    const ed = await editor('head\ntarget\ntail');
    await mark(ed, 1);
    await ed.edit(edit => edit.delete(new vscode.Range(0, 0, 2, 4)));
    assert.deepStrictEqual(manager._getLines(ed.document), []);
    await manager.list();
    manager.next();
    manager.prev();
  });

  test('applies multi-cursor edits in original coordinates and handles CRLF', async () => {
    const ed = await editor('zero\none\ntwo\nthree\nfour');
    await mark(ed, 1);
    await mark(ed, 4);
    await ed.edit(edit => {
      edit.insert(new vscode.Position(0, 0), 'a\r\nb\r\n');
      edit.insert(new vscode.Position(3, 0), 'c\n');
    });
    assert.deepStrictEqual(manager._getLines(ed.document), [3, 7]);
  });

  test('updates background documents as well as the active document', async () => {
    const ed = await editor('head\ntarget');
    await mark(ed, 1);
    await editor('another file');
    const edit = new vscode.WorkspaceEdit();
    edit.insert(ed.document.uri, new vscode.Position(0, 0), 'new\n');
    await vscode.workspace.applyEdit(edit);
    assert.deepStrictEqual(manager._getLines(ed.document), [2]);
  });

  test('ignores malformed persisted data and prunes out-of-range lines', async () => {
    const ed = await editor('only line');
    manager.dispose();
    saved = { [ed.document.uri.toString()]: [-1, '0', 0, 0, 99, 1.5], invalid: {} };
    manager = new BookmarkManager({ subscriptions: [], workspaceState: {
      get: () => saved, update: async () => {},
    } });
    assert.deepStrictEqual(manager._getLines(ed.document), [0]);
    manager.next();
    assert.strictEqual(ed.selection.active.line, 0);
  });
  test('removes a bookmark when deletion consumes the final line', async () => {
    const ed = await editor('head\ntarget');
    await mark(ed, 1);
    await ed.edit(edit => edit.delete(new vscode.Range(0, 4, 1, 6)));
    assert.deepStrictEqual(manager._getLines(ed.document), []);
  });
  test.run();
})();
