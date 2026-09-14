# Contributing

[← Product overview](README.md)

Use **Node.js 22 or newer** for the development tools. The extension runs on
VS Code 1.85.0 and newer and has no production npm dependencies.

## Set up

```sh
git clone https://github.com/SeredaLabs/editor-toolbar.git
cd editor-toolbar
npm ci
npm run check
npm test
```

Develop on a branch and keep the lockfile with dependency changes.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/extension.js` | Register commands and connect extension lifecycle events |
| `src/bookmarkManager.js` | Persist bookmarks, handle file events, and render scoped decorations |
| `src/bookmarkPositions.js` | Transform line anchors after document edits |
| `src/functionListProvider.js` | Request symbols, manage async cache, display Quick Pick, and navigate |
| `src/functionParser.js` | Best-effort fallback/custom detection without a VS Code dependency |
| `src/parseInWorker.js`, `src/parserWorker.js` | Isolate parsing, enforce its deadline, and cancel obsolete work |
| `src/symbolGroups.js` | Group symbols independently of VS Code UI |
| `src/statusBar.js` | Create localized status-bar actions and manage their visibility |
| `package.nls*.json` | Manifest translations |
| `l10n/bundle.l10n*.json` | Runtime translations |

Keep regex execution in the worker. A length limit or a Promise timeout around
synchronous regex execution on the extension host does not prevent blocking.

## Validate changes

```sh
npm run check
npm test
npm audit
```

`npm run check` validates JavaScript syntax, translation keys and placeholders,
and package/lockfile version agreement. Tagged CI builds also validate the tag name.

The integration suite uses **uvu** inside a real VS Code extension host. It covers
bookmarks and persistence, parser cancellation, common language syntax, cache
invalidation, split-editor navigation, and per-folder settings. Add regression
coverage for behavior changes; keep tests independent of your personal editor profile.

### Test profiles and versions

By default, `npm test` downloads **VS Code 1.85.0** into `.vscode-test/downloads`.
It creates temporary user-data and extension directories plus a two-folder test
workspace, then removes that temporary profile after the run. Your normal settings
and extensions are not used.

On macOS/Linux, select a version or executable with:

```sh
VSCODE_TEST_VERSION=stable npm test
VSCODE_EXECUTABLE_PATH='/absolute/path/to/VS Code executable' npm test
```

On PowerShell:

```powershell
$env:VSCODE_TEST_VERSION = 'stable'
npm test
Remove-Item Env:VSCODE_TEST_VERSION
```

`VSCODE_EXECUTABLE_PATH` takes precedence over the version. If a cached executable
is missing, the runner identifies the incomplete installation; remove that specific
installation directory and retry the download.

Run GUI suites **serially on one desktop**. Concurrent VS Code windows can steal
focus from command tests. CI matrix jobs use separate runners.

## Build a VSIX

```sh
npm run package
```

This runs the static checks and creates `editor-toolbar-<version>.vsix` with the
pinned VSCE tool. The package includes runtime code, icons, translations, and user
documentation. Development dependencies, tests, workflows, and helper scripts are
excluded. Run `npm test` before packaging a release candidate.

Install the VSIX through **Extensions → … → Install from VSIX…** and confirm the
installed version in the extension details. Record feature demos in an isolated
profile; see [the demo guide](docs/demo/README.md).

## CI and releases

`.github/workflows/ci.yml` defines:

1. Syntax/localization checks and dependency audit.
2. Integration tests on **Linux, macOS, and Windows**, each with minimum and stable VS Code.
3. A VSIX artifact build after all test jobs pass, named for the commit SHA.

The workflow is configured for pull requests, `master`, `codex/**` branches,
`v*` tags, and manual runs. A configured workflow is not evidence of a passing run:
check the corresponding commit's Actions results before releasing.

Release tags must match the manifest version (`v1.3.0` for version `1.3.0`). Keep
`package.json`, `package-lock.json`, and `CHANGELOG.md` aligned. CI uploads a build
artifact; it does **not** publish to Marketplace or create a GitHub release.

## Documentation and media

Keep [README.md](README.md) and [README.uk.md](README.uk.md) aligned with the actual
commands and settings. Keep implementation details in the reference or this guide,
and describe known behavior limits explicitly.

For feature media, capture the actual extension in an isolated VS Code window with
only the public demo file visible. Include a text walkthrough for people who cannot
view animation, and keep source frames outside the VSIX. Do not present a generated
mockup as a screen recording.
