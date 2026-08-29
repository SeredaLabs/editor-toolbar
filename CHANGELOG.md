# Changelog

## 1.1.2 — Visible Navigation on Folded Files

- Jumping to a symbol from the Functions & Procedures quick pick now unfolds the destination procedure/function (`editor.unfold`, one level) instead of leaving it collapsed — on a fully-folded file every folded line looks the same (the theme's `editor.foldBackground` tint), so the destination was indistinguishable from every other collapsed line
- The destination line also gets a brief highlight flash (using the same `editor.symbolHighlightBackground` / `editor.symbolHighlightBorder` theme colors VS Code's own symbol navigation uses) so it's obvious at a glance where you landed

## 1.1.1 — Cross-Language False Positives

- Function/procedure detection patterns are now scoped to the document's actual language (`document.languageId`) instead of being tried against every file regardless of language — e.g. a `.bsl` file only tries the BSL patterns (plus any custom user patterns), not the C#/Java/Go/Python/etc. ones
- Fixes a real-world false positive where the generic C#/Java "`TYPE NAME(`" catch-all pattern matched plain BSL function *calls* without wrapping parens around the condition — e.g. `Если ЗначениеЗаполнено(...)` or `Новый ОписаниеОповещения(...)` — and listed them in the Functions & Procedures quick pick as bogus "Method" entries alongside real `Процедура`/`Функция` declarations
- Files whose language isn't one of the ones with a dedicated pattern set keep the previous "try everything" fallback, so support for less common languages is unaffected

## 1.1.0 — Async Cache (Smart Nav, part 1)

- `FunctionListProvider` now actually caches parse results per document (keyed by URI + document version) instead of `refresh()` being a no-op — opening the Functions & Procedures quick pick on an unchanged document is now a cache hit instead of a full re-parse
- `FunctionListProvider` is registered in `context.subscriptions` so its debounce timer and cache are disposed when the extension deactivates
- The `onDidChangeTextDocument` listener now only schedules a refresh for the currently active document, instead of reacting to background document edits from anywhere in the workspace
- Added a test suite covering extension activation/command registration and the new cache behavior

## 1.0.2 — Hotfix

- Fixed: `F2` (Next Bookmark) conflicted with VS Code's native Rename Symbol — remapped to `Ctrl+Shift+F2`
- Fixed: `Ctrl+/` (Line Comment) and `Ctrl+Shift+[` / `Ctrl+Shift+]` (Fold/Unfold All) silently overrode native VS Code keybindings that do different things (comment toggle already worked natively; fold/unfold single-region vs. fold/unfold all are different actions) — these custom keybindings were removed, native shortcuts now take over unopposed
- Removed the `editorToolbar.formatDocument` / `editorToolbar.toggleComment` proxy commands; the status bar buttons now invoke the built-in `editor.action.formatDocument` / `editor.action.commentLine` commands directly
- Replaced the C#/Java/PHP method-detection regexes with equivalent linear (non-backtracking-prone) patterns as a hygiene measure
- Removed a dead `m[1] || m[2]` fallback in function/procedure parsing (`m[2]` was always `undefined`)
- Capped custom pattern matching to lines under 500 characters, bounding worst-case backtracking time for a pathological user-supplied `editorToolbar.customPatterns` regex
- Fixed a race condition in the Functions & Procedures quick pick: selecting a symbol after switching to a different tab while the picker was open now applies to the file the picker was opened for, not whatever tab happened to be active
- Added an automated test suite (`@vscode/test-electron` + Mocha, `npm test`) covering function/procedure detection and the custom-pattern safety cap

## 1.0.1 — Parsing Performance

- `FunctionListProvider._parse()` no longer reads the `editorToolbar.customPatterns` setting and recompiles custom regexes on every line — configuration is read and custom patterns are compiled once per parse call, before the line loop, instead of on every iteration
- Measured ~5.7x–13x faster parsing on a synthetic ~100k-line file, depending on environment

## 1.0.0 — Initial Release

- Bookmark navigation with gutter icons (Ctrl+F2, F2, Shift+F2), persisted per workspace
- List Bookmarks quick pick (Ctrl+Alt+F2)
- Format document button in status bar
- Line comment toggle (Ctrl+/)
- Functions & Procedures quick pick with sort (Ctrl+Alt+O), with 1C:Configurator-style Fn/Pr icons for BSL
- Fold / Unfold all in editor/title bar (Ctrl+Shift+[ / ])
- Language-agnostic function detection with Cyrillic support
- Localization: English, Ukrainian, Russian
