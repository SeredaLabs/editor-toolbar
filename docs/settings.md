# Settings and language support

[← Overview](../README.md) · [Commands](commands.md)

Open **Editor Toolbar: Settings** from the Command Palette or use the gear button
in the status bar. Both settings support user, workspace, and workspace-folder values.
In a multi-root workspace, each file uses its own folder's configuration. Changes apply
without reloading VS Code.

## Bookmark color

| Setting | Default | Accepted values |
| --- | --- | --- |
| `editorToolbar.bookmarkColor` | `#ff6b35` | `#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa` |

```json
{
  "editorToolbar.bookmarkColor": "#8b5cf6"
}
```

The color applies to gutter markers and the overview ruler. Invalid colors fall
back to the default. Named CSS colors such as `orange` are not supported.

## Custom function patterns

`editorToolbar.customPatterns` defaults to `[]`. Each entry is a JavaScript regex
source string. The **first capture group** supplies the symbol name.

For a file containing:

```text
myCustomKeyword CalculateTotal(items)
myCustomKeyword SendReceipt(order)
```

Use:

```json
{
  "editorToolbar.customPatterns": [
    "^\\s*myCustomKeyword\\s+([\\w]+)\\s*\\("
  ]
}
```

Regex backslashes must be escaped in JSON. This example uses `\w` for ASCII names;
for Cyrillic names, use `[\w\u0400-\u04FF]+` in the regex source and escape its
backslashes in JSON as well.

### Matching behavior

- Configure up to **32 patterns**, each at most **1,024 characters**.
- Supply regex source text, without surrounding `/…/` delimiters or flags.
- Invalid regexes are ignored. A match without a nonempty first capture group adds no symbol.
- Patterns are tried against individual lines with comments and strings blanked out
  by the fallback scanner. Multi-line declarations require a language provider.
- Custom matching skips lines longer than **500 characters**.
- Language-provider symbols take priority over duplicates. During fallback parsing,
  built-in patterns run before custom patterns; the first accepted match per line wins.
- Fallback/custom parsing runs in a worker with a **one-second deadline for the whole
  parse**, not one second per pattern. The worker is terminated on timeout or cancellation.
- The length limits reduce work; the worker deadline provides protection against
  pathological backtracking. Available provider symbols remain usable after a custom-pattern timeout.

## Language support

The navigator first requests document symbols from VS Code. When your language
extension supplies functions or methods, those results provide names and source positions.
If none are returned, Editor Toolbar uses its own best-effort fallback.

| Language | Fallback recognizes common forms of… |
| --- | --- |
| 1C:BSL | Russian and English function/procedure declarations, case-insensitively |
| JavaScript / TypeScript, including JSX / TSX modes | Named functions, default exports, arrow functions, class methods |
| Python | `def` and `async def` |
| PHP | `function`, including common modifiers |
| Go | `func` declarations and simple receivers |
| Rust | `fn`, `pub fn`, and async variants |
| Ruby | `def` |
| C, C++, C#, Java | Simple typed method/function signatures |
| Kotlin / Swift | `fun` / `func` declarations |
| Visual Basic | `Sub` and `Function` declarations |
| Shell | `name() { … }` |

This is **not a full parser for every language**. Generics, decorators, unusual
modifiers, embedded languages, and complex multi-line syntax may require the language
extension's symbol provider. For unknown language modes, the fallback tries the
built-in patterns; false positives remain possible. Custom patterns can cover a
project-specific declaration style.

## State and lifecycle

Bookmarks are persisted in VS Code's workspace state. They follow in-session edits
and VS Code file/folder rename operations. A multi-line deletion that consumes a
bookmark's line-start anchor removes the bookmark; undo does not restore that removed
bookmark. Changes made while the extension is not running cannot be tracked.

Function results are cached for up to **32 documents**. The cache accounts for the
document identity, version, language, and patterns. Edits, configuration changes,
document closure, and extension changes invalidate affected work. Obsolete asynchronous
results are discarded.
