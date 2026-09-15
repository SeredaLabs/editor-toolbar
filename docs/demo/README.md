# Demo walkthrough and recording guide

[← Overview](../../README.md) · [🇺🇦 Українською](../../README.uk.md)

Use [order-service.js](order-service.js) to explore the extension without touching
your own application code. The walkthrough is also a text alternative to a feature recording.

[Watch the video](../../images/editor-toolbar-demo.mp4) ·
[View the looping GIF](../../images/editor-toolbar-demo.gif)

The current recording shows Editor Toolbar **1.3.0** in VS Code **1.85.0** on macOS:
14 scenes, about 56 seconds, English captions, no audio. The MP4 is 1280 × 814
(a 1280 × 720 workbench plus captions); the GIF is a shorter sequence of captured states.
The MP4 stays in the repository and is excluded from the VSIX to keep installation small.

## Walkthrough

| Step | Action | What to look for |
| --- | --- | --- |
| 1. Mark your places | Place the cursor on `createOrder`, then `calculateSubtotal`, then `sendReceipt`; use **Toggle Bookmark** each time. | Three gutter markers appear. |
| 2. Jump between bookmarks | Use **Next Bookmark** twice, then **Previous Bookmark**. | The cursor moves between marked lines in the same file. |
| 3. Browse marked code | Choose **List Bookmarks**, type `sendReceipt`, and select it. | A searchable list shows code previews and line numbers. |
| 4. Find a symbol | Open **Functions & Procedures**. | Functions and class methods appear in separate groups. |
| 5. Sort and search | Toggle alphabetical sorting, type `sendReceipt`, and select it. | Sorting stays within groups; the target line is revealed and highlights. |
| 6. Fold and unfold | Use **Fold All** and **Unfold All** in the editor title bar. | Function and class bodies collapse and expand. |
| 7. Format code | Temporarily compress the spacing in a function, then use **Format Document**. | The configured JavaScript formatter restores readable formatting. |
| 8. Toggle a comment | Select the `const TAX_RATE` line; use **Line Comment**, then toggle it back. | The language's line-comment marker is inserted and removed. |
| 9. Change the color | Open **Settings**, set `editorToolbar.bookmarkColor` to `#8b5cf6`, then return to the code. | Existing bookmark markers change color without a reload. |

The extension's default keybindings are listed in the [command reference](../commands.md).
Use buttons when recording on a keyboard where macOS intercepts function keys.

## Capture an actual screen recording

### Automated recording

The recorder opens a real VS Code development window with the current extension,
clicks its toolbar controls, and records the workbench continuously. It uses a
temporary profile and a copy of the sample; it does not change your editor settings.
Keep GUI test runs separate from recording runs.

Install the tools once (Node.js 22+, Python 3.10+):

```sh
npm ci
npx playwright-core install ffmpeg
python3 -m venv .vscode-test/demo-tools
.vscode-test/demo-tools/bin/python -m pip install Pillow imageio-ffmpeg
```

On Windows, use `.vscode-test/demo-tools/Scripts/python.exe` for the Python commands.

Record to a **new directory** outside the repository, then export:

```sh
npm run demo:record -- /absolute/path/to/new-capture
.vscode-test/demo-tools/bin/python scripts/build-demo.py \
  /absolute/path/to/new-capture/manifest.json images/editor-toolbar-demo.gif \
  --video-capture /absolute/path/to/new-capture/capture.json
```

This produces a continuous H.264 MP4 with English captions, a looping GIF of
captured feature states, and a PNG poster. The GIF is a condensed walkthrough;
the MP4 preserves the interactions and typing. Neither redraws the workbench.
Both have a caption strip below the captured UI and no audio.

The recorder defaults to VS Code 1.85.0. `VSCODE_TEST_VERSION` and
`VSCODE_EXECUTABLE_PATH` work as in the integration test runner. It needs a GUI
desktop that can fit a 1280 × 720 content area. Captures include the extension
version, timings, raw WebM, and PNG frames. A failed run keeps diagnostics in
the capture directory and returns a nonzero exit code. Review every scene and
the start/end of the exported MP4 before replacing the published assets.

### Manual recording

- Use a separate VS Code user-data directory and extension directory. Load the current
  source as the development extension and copy the sample file into a temporary workspace.
- Show only the demo file. Hide terminals, notifications, private paths, and unrelated tabs.
- Keep text readable when the animation is displayed at about 1,000 pixels wide.
- Capture the actual UI states after each command. Do not redraw or simulate the interface.
- Give each action enough time to read; prefer a short loop over a long unedited session.
- Capture the same window bounds for every frame. Keep original captures outside the repository.
- If screen-capture or accessibility permission is missing, grant that permission before
  recording. Do not replace a requested real recording with an unlabeled mockup.

## Assemble captured frames into a looping GIF

The optional helper requires Python 3 and Pillow:

```sh
python3 -m pip install Pillow
python3 scripts/build-demo.py /absolute/path/to/frames/manifest.json images/editor-toolbar-demo.gif
```

Use a manifest with relative PNG paths, timing, and short captions:

```json
[
  {
    "file": "01-bookmarks.png",
    "duration_ms": 1800,
    "title": "Keep your place",
    "caption": "Toggle bookmarks on the lines you want to revisit."
  },
  {
    "file": "02-next-bookmark.png",
    "duration_ms": 1500,
    "title": "Jump between bookmarks",
    "caption": "Next and previous navigate within the current file."
  }
]
```

The helper preserves the captured UI, resizes it consistently, adds a caption strip,
and sets the GIF to loop indefinitely. It also saves a PNG poster from the first frame.
Review the resulting animation before adding it to the overview pages. Check the
recording against the current version and keep this text walkthrough synchronized.
