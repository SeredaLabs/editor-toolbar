'use strict';
// Record the real VS Code workbench in a disposable profile, using public UI actions.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { _electron: electron } = require('playwright-core');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');

async function main() {
  const root = path.resolve(__dirname, '..');
  const output = path.resolve(process.argv[2] || path.join(os.tmpdir(), `editor-toolbar-capture-${Date.now()}`));
  if (fs.existsSync(output)) throw new Error(`Choose a new capture directory: ${output}`);
  const executablePath = process.env.VSCODE_EXECUTABLE_PATH || await downloadAndUnzipVSCode({
    version: process.env.VSCODE_TEST_VERSION || '1.85.0', cachePath: path.join(root, '.vscode-test', 'downloads'),
  });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-toolbar-demo-'));
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.join(temp, 'user-data', 'User'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'demo'));
  const sample = path.join(temp, 'demo', 'order-service.js');
  fs.copyFileSync(path.join(root, 'docs', 'demo', 'order-service.js'), sample);
  fs.writeFileSync(path.join(temp, 'user-data', 'User', 'settings.json'), JSON.stringify({
    'workbench.startupEditor': 'none', 'workbench.colorTheme': 'Default Dark Modern',
    'editor.fontSize': 18, 'editor.lineHeight': 24, 'editor.minimap.enabled': false,
    'editor.stickyScroll.enabled': false, 'editor.cursorBlinking': 'solid',
    'editor.renderLineHighlight': 'all', 'editor.scrollBeyondLastLine': false,
    'editor.detectIndentation': false, 'editor.tabSize': 2,
    'editor.defaultFormatter': 'vscode.typescript-language-features',
    'breadcrumbs.enabled': false, 'window.commandCenter': false,
    'workbench.activityBar.visible': false, 'workbench.editor.enablePreview': false,
    'window.title': 'Editor Toolbar — Quick Tour', 'telemetry.telemetryLevel': 'off',
    'update.mode': 'none', 'extensions.ignoreRecommendations': true,
    'extensions.autoUpdate': false, 'git.enabled': false,
  }));
  let app, page;
  try {
    app = await electron.launch({ executablePath, timeout: 60000,
      args: [path.join(temp, 'demo'), sample, '--locale=en', '--user-data-dir', path.join(temp, 'user-data'),
        '--extensions-dir', path.join(temp, 'extensions'), `--extensionDevelopmentPath=${root}`,
        '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
      recordVideo: { dir: path.join(output, 'raw'), size: { width: 1280, height: 720 } },
    });
    page = await app.firstWindow();
    const videoEpoch = Date.now();
    page.setDefaultTimeout(15000);
    await (await app.browserWindow(page)).evaluate(window => window.setContentSize(1280, 720));
    const button = name => page.getByRole('button', { name, exact: true });
    const pause = ms => page.waitForTimeout(ms);
    const input = () => page.locator('.quick-input-widget input[type="text"]');
    async function command(name) {
      await page.keyboard.press('F1');
      await input().fill(`>${name}`);
      await pause(350);
      await page.keyboard.press('Enter');
      await pause(400);
    }
    async function go(line) {
      await page.keyboard.press('Control+g');
      await input().fill(`:${line}`);
      await page.keyboard.press('Enter');
      await pause(350);
    }
    async function click(name) {
      await button(name).hover();
      await pause(500);
      await button(name).click();
      await page.mouse.move(1100, 680);
      await pause(400);
    }
    async function atLine(line) {
      await page.waitForFunction(n => document.querySelector('[id="status.editor.selection"]')?.textContent.includes(`Ln ${n},`), line);
    }
    await button('Toggle Bookmark').waitFor();
    await command('View: Toggle Primary Side Bar Visibility');
    await command('Notifications: Clear All Notifications');
    await go(1);
    await pause(1500);
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.deepStrictEqual(viewport, { width: 1280, height: 720 }, 'The recording window must fit on the display.');
    const scenes = [];
    const start = Date.now();
    async function scene(title, caption, action, hold = 1700) {
      const began = Date.now();
      console.log(title);
      await action();
      await pause(300);
      const file = `${String(scenes.length + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(output, file), scale: 'css' });
      await pause(hold);
      scenes.push({ file, title, caption, duration_ms: Date.now() - began });
    }
    await scene('Editor Toolbar', 'Bookmarks, function navigation, and everyday editing — within reach.', async () => {});
    await scene('Keep your place', 'Mark the lines you want to revisit with Toggle Bookmark.', async () => {
      for (const line of [6, 12, 22]) { await go(line); await click('Toggle Bookmark'); }
    });
    await scene('Jump between bookmarks', 'Next and previous wrap around within the current file.', async () => {
      await click('Next Bookmark'); await atLine(6); await pause(600);
      await click('Next Bookmark'); await atLine(12); await pause(600);
      await click('Previous Bookmark'); await atLine(6);
    });
    await scene('Browse marked code', 'Open a searchable list with code previews and line numbers.', async () => {
      await click('List Bookmarks');
      await page.getByRole('option').filter({ hasText: 'sendReceipt' }).waitFor();
      assert.strictEqual(await page.getByRole('option').count(), 3);
    });
    await scene('Find a bookmark', 'Type a name, then press Enter to jump to the marked line.', async () => {
      await input().pressSequentially('sendReceipt', { delay: 100 }); await pause(800);
      await page.keyboard.press('Enter'); await atLine(22);
    });
    await scene('Functions & Procedures', 'Browse functions and methods in separate groups.', async () => {
      await page.getByRole('button', { name: /^Functions & Procedures/ }).click();
      await page.getByRole('option').filter({ hasText: 'createOrder' }).waitFor();
      await page.getByRole('option').filter({ hasText: 'cancel' }).waitFor();
    });
    await scene('Sort and search', 'Sort alphabetically within each group, then filter by name.', async () => {
      await click('Sort A→Z / by line'); await pause(1200);
      await input().pressSequentially('sendReceipt', { delay: 100 });
    });
    await scene('Jump straight to a function', 'The destination is revealed and briefly highlighted.', async () => {
      await page.keyboard.press('Enter'); await atLine(22);
    });
    await scene('Fold the whole file', 'Use Fold All in the editor title bar for a compact overview.', async () => {
      await click('Fold All');
      await page.locator('.codicon-folding-collapsed').first().waitFor();
    });
    await scene('Expand and continue', 'Unfold All restores the function and class bodies.', async () => {
      await click('Unfold All'); await go(4);
      await page.locator('.view-line').filter({ hasText: 'const subtotal' }).waitFor();
    });
    await scene('One-click line comments', 'Toggle the selected line off, then back on.', async () => {
      await click('Line Comment'); await pause(1200);
      await page.locator('.view-line').filter({ hasText: '// const TAX_RATE' }).waitFor();
    });
    await scene('Tidy up your code', 'Format Document uses the language formatter configured in VS Code.', async () => {
      await click('Line Comment'); await go(4); await page.keyboard.press('Home');
      await page.keyboard.press('Shift+End');
      await page.keyboard.insertText('const TAX_RATE=0.2;'); await pause(1000);
      await click('Format Document');
      await page.locator('.view-line').filter({ hasText: 'const TAX_RATE = 0.2;' }).waitFor();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
    });
    await scene('Make it yours', 'Toolbar Settings lets you choose a bookmark color for your workspace.', async () => {
      await click('Toolbar Settings');
      await page.getByText('Workspace', { exact: true }).click();
      const color = page.getByLabel('editorToolbar.bookmarkColor', { exact: true });
      await color.fill('#8b5cf6'); await color.press('Tab'); await pause(800);
    });
    await scene('Ready for your next edit', 'Bookmark colors update immediately. Keep your flow.', async () => {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+w' : 'Control+w');
      await go(6);
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(temp, 'demo', '.vscode', 'settings.json'), 'utf8'))['editorToolbar.bookmarkColor'], '#8b5cf6');
    }, 2300);
    const capture = { version: require('../package.json').version, viewport,
      video_start_seconds: (start - videoEpoch) / 1000,
      duration_seconds: scenes.reduce((sum, scene) => sum + scene.duration_ms, 0) / 1000,
      captured_at: new Date().toISOString(), scenes };
    const raw = await page.video().path();
    capture.video = path.relative(output, raw);
    // The GIF presents selected states; only the MP4 retains real action timings.
    const gifScenes = scenes.map(scene => ({ ...scene, duration_ms: Math.min(2500, scene.duration_ms) }));
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(gifScenes, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
    console.log(`Captured ${scenes.length} scenes in ${output}`);
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'failure.png'), scale: 'css' }).catch(() => {});
      fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => ''));
      fs.writeFileSync(path.join(output, 'controls.json'), JSON.stringify(await page.locator('[aria-label], [id^="status."]').evaluateAll(elements => elements.map(e => ({ id: e.id, role: e.getAttribute('role'), label: e.getAttribute('aria-label'), text: e.textContent?.slice(0, 200) }))).catch(() => []), null, 2));
    }
    throw error;
  } finally {
    try {
      if (app) {
        let timer;
        try {
          await Promise.race([app.close(), new Promise((_, reject) => {
            timer = setTimeout(() => {
              app.process().kill('SIGTERM');
              reject(new Error('VS Code did not close within 15 seconds.'));
            }, 15000);
          })]);
        } finally { clearTimeout(timer); }
      }
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
