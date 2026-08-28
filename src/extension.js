'use strict';
const vscode = require('vscode');
const { StatusBar } = require('./statusBar');
const { BookmarkManager } = require('./bookmarkManager');
const { FunctionListProvider } = require('./functionListProvider');

function activate(context) {
  const bookmarkManager = new BookmarkManager(context);
  const functionListProvider = new FunctionListProvider(context.extensionUri);
  const statusBar = new StatusBar(context);

  const cmds = [
    ['editorToolbar.addBookmark',      () => bookmarkManager.toggle()],
    ['editorToolbar.prevBookmark',     () => bookmarkManager.prev()],
    ['editorToolbar.nextBookmark',     () => bookmarkManager.next()],
    ['editorToolbar.listBookmarks',    () => bookmarkManager.list()],
    ['editorToolbar.formatDocument',   () => vscode.commands.executeCommand('editor.action.formatDocument')],
    ['editorToolbar.toggleComment',    () => vscode.commands.executeCommand('editor.action.commentLine')],
    ['editorToolbar.foldAll',          () => vscode.commands.executeCommand('editor.foldAll')],
    ['editorToolbar.unfoldAll',        () => vscode.commands.executeCommand('editor.unfoldAll')],
    ['editorToolbar.openSettings',     () => vscode.commands.executeCommand('workbench.action.openSettings', 'editorToolbar')],
    ['editorToolbar.showFunctionList', () => functionListProvider.showQuickPick()],
  ];

  for (const [id, fn] of cmds) {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }

  statusBar.show();

  // Оновлюємо закладки при зміні активного файлу
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) bookmarkManager.refreshDecorations();
    }),
    vscode.workspace.onDidChangeTextDocument(() => {
      functionListProvider.refreshDebounced();
    })
  );

  // Відображаємо закладки одразу при старті
  bookmarkManager.refreshDecorations();
}

function deactivate() {}

module.exports = { activate, deactivate };
