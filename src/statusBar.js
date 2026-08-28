'use strict';
const vscode = require('vscode');

const ITEMS = [
  { sep: true,                                                                                                       p: -1099 },
  { icon: 'bookmark',         title: 'Toggle Bookmark',   kbd: 'Ctrl+F2',     cmd: 'editorToolbar.addBookmark',    p: -1100 },
  { icon: 'arrow-small-up',   title: 'Prev Bookmark',     kbd: 'Shift+F2',    cmd: 'editorToolbar.prevBookmark',   p: -1101 },
  { icon: 'arrow-small-down', title: 'Next Bookmark',     kbd: 'F2',          cmd: 'editorToolbar.nextBookmark',   p: -1102 },
  { icon: 'wand',             title: 'Format Document',   kbd: 'Shift+Alt+F', cmd: 'editorToolbar.formatDocument', p: -1110 },
  { icon: 'comment',          title: 'Line Comment',      kbd: 'Ctrl+/',      cmd: 'editorToolbar.toggleComment',  p: -1120 },
  { icon: 'gear',             title: 'Toolbar Settings',  kbd: '',            cmd: 'editorToolbar.openSettings',   p: -1130 },
];

class StatusBar {
  constructor(context) {
    this._items = [];
    // правильно підключаємо dispose до context
    context.subscriptions.push(this);
  }

  show() {
    for (const def of ITEMS) {
      if (def.sep) {
        const sep = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, def.p);
        sep.text = '|';
        sep.show();
        this._items.push(sep);
        continue;
      }
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, def.p);
      item.text = `$(${def.icon})`;
      const md = new vscode.MarkdownString('', true);
      md.isTrusted = true;
      md.appendMarkdown(`**${def.title}**`);
      if (def.kbd) md.appendMarkdown(`&nbsp;&nbsp;\`${def.kbd}\``);
      item.tooltip = md;
      item.command = def.cmd;
      item.show();
      this._items.push(item);
    }
  }

  dispose() {
    for (const item of this._items) item.dispose();
    this._items = [];
  }
}

module.exports = { StatusBar };
