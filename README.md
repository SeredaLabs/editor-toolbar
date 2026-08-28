# Editor Toolbar

Language-agnostic VS Code extension that adds bookmarks, formatting, commenting and a function/procedure navigator to the editor.

## Features

### 🔖 Bookmarks
Navigate your code with persistent bookmarks per file.

| Action | Keybinding |
|--------|-----------|
| Toggle bookmark on current line | `Ctrl+F2` |
| Jump to next bookmark | `F2` |
| Jump to previous bookmark | `Shift+F2` |
| List all bookmarks in current file | `Ctrl+Alt+F2` |

### ✨ Format Document
Quick access to format the current document (`Shift+Alt+F`).

### 💬 Line Comment
Toggle line comment on current line or selection (`Ctrl+/`).

### 📋 Functions & Procedures (`Ctrl+Alt+O`)
Opens a searchable quick pick list of all functions and procedures in the current file.
- Different icons for functions vs procedures
- Sort alphabetically with the button in the top-right corner
- Supports 1C:BSL, JavaScript, TypeScript, Python, PHP, Go, Rust, Ruby, C#, Java, Kotlin, Swift, Shell and more

### ⊟ Fold / ⊞ Unfold
Fold or unfold all code blocks in the editor (`Ctrl+Shift+[` / `Ctrl+Shift+]`).

## Status Bar

All commands are available in the status bar at the bottom of the window:

```
| $(bookmark) $(↑) $(↓)  $(✨)  $(💬)  $(⚙)
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `editorToolbar.customPatterns` | `[]` | Additional custom patterns |
| `editorToolbar.bookmarkColor` | `#ff6b35` | Bookmark gutter color |

### Custom patterns example
```json
"editorToolbar.customPatterns": [
  "^\\s*myCustomKeyword\\s+([\\w]+)\\s*\\("
]
```

## Language support

| Language | Detection |
|----------|-----------|
| 1C:BSL | `Процедура`, `Функция` |
| JavaScript / TypeScript | `function`, arrow functions |
| Python | `def` |
| PHP | `function` |
| Go | `func` |
| Rust | `fn` |
| Ruby | `def` |
| C# / Java | typed method signatures |
| Kotlin / Swift | `fun` / `func` |
| Shell | `name()` |

## Installation

1. Download the `.vsix` file or install from VS Code Marketplace
2. Open VS Code → Extensions → `...` → Install from VSIX

## License

MIT
