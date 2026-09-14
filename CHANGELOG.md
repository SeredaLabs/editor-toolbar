# Changelog

## 1.3.0 — Reliability and navigation

- Bookmarks track edits in active and background documents, remove anchors consumed
  by multi-line deletion, validate persisted positions, and follow VS Code file/folder
  renames. Decorations refresh across visible editor groups.
- Fallback/custom regex parsing runs in a cancellable worker with a one-second
  deadline. This replaces the ineffective assumption that a 500-character line
  limit prevents catastrophic backtracking.
- The navigator uses document symbol providers first, with regex fallback and custom
  additions. The fallback supports arrow functions, default exports, class methods,
  one-character names, and English/case-insensitive BSL declarations, and filters
  block comments, multiline strings, and return expressions.
- Cache entries include document identity, version, language, and scoped patterns;
  edits, configuration changes, and document close invalidate pending work. The
  cache is bounded to 32 documents. Stale async results are discarded.
- Symbol navigation activates the original editor group before unfolding. Obsolete
  pickers close on document edits, and highlights clear when jumping between files.
- Bookmark colors and custom patterns honor folder settings. Color changes apply
  immediately; invalid colors fall back to the default before SVG construction.
- Runtime UI is localized into Ukrainian and Russian. Status bar labels no longer
  advertise hard-coded shortcuts and hide when no text editor is active. Editor-title
  actions work for untitled and remote documents.
- Regression tests cover bookmarks, parser cancellation, cache invalidation,
  split-editor navigation, and resource configuration. Tests use uvu instead of
  the vulnerable Mocha/serialize-javascript development dependency chain.
- Isolated test profiles, syntax/localization checks, CI for minimum/stable VS Code
  on three operating systems, and a version-checked VSIX artifact build.

## 1.2.0 — Grouped Navigator (Smart Nav, part 2)

- The Functions & Procedures quick pick now groups symbols by type — `PROCEDURES`, `FUNCTIONS`, `METHODS`, `CUSTOM` — using VS Code's native `QuickPickItemKind.Separator` section headers, instead of one flat list. A section only appears if the file actually has a symbol of that kind.
- Within each group, the existing sort toggle (by line / alphabetical) still applies — grouping and sorting are independent
- The kind→label mapping and the grouping logic are pure, exported functions (`groupByKindLabel`), decoupled from `vscode` — directly unit-tested

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
