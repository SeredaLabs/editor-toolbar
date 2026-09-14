'use strict';
const { suite } = require('uvu');
const assert = require('assert');
const vscode = require('vscode');

(() => {
  const test = suite('Extension activation');
  test('activates and registers all expected commands', async () => {
    const ext = vscode.extensions.getExtension('seredalabs.editor-toolbar');
    assert.ok(ext, 'extension not found — is it loaded as the development extension?');

    await ext.activate();
    const commands = await vscode.commands.getCommands(true);

    const expected = [
      'editorToolbar.addBookmark',
      'editorToolbar.prevBookmark',
      'editorToolbar.nextBookmark',
      'editorToolbar.listBookmarks',
      'editorToolbar.foldAll',
      'editorToolbar.unfoldAll',
      'editorToolbar.openSettings',
      'editorToolbar.showFunctionList',
    ];
    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `expected command ${cmd} to be registered`);
    }

    // The proxy commands removed in 1.0.2 must stay gone — the status bar now calls the
    // built-in commands directly instead.
    assert.ok(!commands.includes('editorToolbar.formatDocument'));
    assert.ok(!commands.includes('editorToolbar.toggleComment'));
  });
  test.run();
})();
