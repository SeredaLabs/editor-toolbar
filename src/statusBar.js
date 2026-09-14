'use strict';
const vscode = require('vscode');

const ITEMS = [
  { icon: 'bookmark', title: 'Toggle Bookmark', cmd: 'editorToolbar.addBookmark' },
  { icon: 'arrow-small-up', title: 'Previous Bookmark', cmd: 'editorToolbar.prevBookmark' },
  { icon: 'arrow-small-down', title: 'Next Bookmark', cmd: 'editorToolbar.nextBookmark' },
  { icon: 'list-selection', title: 'List Bookmarks', cmd: 'editorToolbar.listBookmarks' },
  { icon: 'wand', title: 'Format Document', cmd: 'editor.action.formatDocument' },
  { icon: 'comment', title: 'Line Comment', cmd: 'editor.action.commentLine' },
  { icon: 'gear', title: 'Toolbar Settings', cmd: 'editorToolbar.openSettings' },
];

class StatusBar {
  constructor(context) {
    this._items = [];
    this._listener = vscode.window.onDidChangeActiveTextEditor(() => this._updateVisibility());
    context.subscriptions.push(this);
  }

  show() {
    if (this._items.length) return;
    for (const [index, def] of ITEMS.entries()) {
      const item = vscode.window.createStatusBarItem(`editorToolbar.${def.cmd}`, vscode.StatusBarAlignment.Left, -1100 - index);
      item.text = `$(${def.icon})`;
      item.name = vscode.l10n.t(def.title);
      // Shortcuts can be rebound and differ by OS; the Keyboard Shortcuts editor owns their display.
      item.tooltip = item.name;
      item.accessibilityInformation = { label: item.name };
      item.command = def.cmd;
      this._items.push(item);
    }
    this._updateVisibility();
  }

  _updateVisibility() {
    for (const item of this._items) {
      if (vscode.window.activeTextEditor) item.show(); else item.hide();
    }
  }

  dispose() {
    this._listener.dispose();
    for (const item of this._items) item.dispose();
    this._items = [];
  }
}

module.exports = { StatusBar };
