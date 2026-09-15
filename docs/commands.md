# Command reference

[← Overview](../README.md) · [🇺🇦 Українською](../README.uk.md)

Open the **Command Palette** and search for **Editor Toolbar** to find the extension's
commands. Formatting and commenting are VS Code built-in commands exposed by the
status bar, so they use the formatter and language behavior already configured in your editor.

## Commands and locations

| Action | Command ID | UI location | Extension shortcut |
| --- | --- | --- | --- |
| Toggle Bookmark | `editorToolbar.addBookmark` | Status bar | `Ctrl+F2` |
| Previous Bookmark | `editorToolbar.prevBookmark` | Status bar | `Shift+F2` |
| Next Bookmark | `editorToolbar.nextBookmark` | Status bar | `Ctrl+Shift+F2` |
| List Bookmarks | `editorToolbar.listBookmarks` | Status bar | `Ctrl+Alt+F2` |
| Functions & Procedures | `editorToolbar.showFunctionList` | Editor title bar | `Ctrl+Alt+O` |
| Fold All | `editorToolbar.foldAll` | Editor title bar | Uses native bindings |
| Unfold All | `editorToolbar.unfoldAll` | Editor title bar | Uses native bindings |
| Settings | `editorToolbar.openSettings` | Status bar | None |
| Format Document | `editor.action.formatDocument` | Status bar; built-in command | Uses native bindings |
| Toggle Line Comment | `editor.action.commentLine` | Status bar; built-in command | Uses native bindings |

The extension's shortcuts require `editorTextFocus`. On macOS the contributed
`ctrl` modifier means Control. Function keys may require `Fn`, depending on the keyboard.
Use the Keyboard Shortcuts editor to inspect your effective bindings rather than
assuming Windows, Linux, and macOS use identical built-in shortcuts.

## Bookmarks

- **Toggle** marks or unmarks the cursor's current line.
- **Previous / next** navigates within the current file and wraps around. With no
  bookmarks, these commands do nothing.
- **List** shows the marked lines with a code preview and a line number. Type to
  filter, then select a result to navigate.
- Moving the cursor or switching files does not create or remove a bookmark.
- Bookmarks are workspace-local, not a project file checked into Git.

## Function navigator

1. Open **Functions & Procedures**.
2. Type a name or part of its description to filter the list.
3. Use the sort button to switch between source order and alphabetical order.
   Sorting happens **within each symbol group**.
4. Select a result. The original editor group becomes active, the destination is
   unfolded one level, and the line briefly highlights.

Only nonempty groups appear: **Procedures → Functions → Methods → Custom**.
If the document changes while the picker is open, reopen the picker to get an updated list.

## Customize a shortcut

Use **Preferences: Open Keyboard Shortcuts** and search for a command ID above.
Alternatively, add an entry to `keybindings.json`; for example:

```json
[
  {
    "key": "ctrl+alt+b",
    "command": "editorToolbar.listBookmarks",
    "when": "editorTextFocus"
  }
]
```

Choose an unused combination on your OS. This example adds a binding; it does not
remove the default binding. To remove an existing binding, use the Keyboard Shortcuts editor.

## Built-in actions

**Format Document** needs a formatter for the document's language. Editor Toolbar
does not ship a formatter or change formatting settings. **Line Comment** uses the
language's configured comment syntax. **Fold All / Unfold All** use VS Code's folding
behavior; the extension does not provide a separate folding engine.
