'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { runTests, downloadAndUnzipVSCode } = require('@vscode/test-electron');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-toolbar-tests-'));
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
    for (const [folder, color, pattern] of [['first', '#123456', '^@@(\\w+)\\('], ['second', '#abcdef', '^%%(\\w+)\\(']]) {
      const settings = path.join(temp, folder, '.vscode');
      fs.mkdirSync(settings, { recursive: true });
      fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({
        'editorToolbar.bookmarkColor': color, 'editorToolbar.customPatterns': [pattern],
      }));
    }
    const workspace = path.join(temp, 'test.code-workspace');
    fs.writeFileSync(workspace, JSON.stringify({ folders: [{ path: 'first' }, { path: 'second' }] }));
    const cachePath = path.join(extensionDevelopmentPath, '.vscode-test', 'downloads');
    const version = process.env.VSCODE_TEST_VERSION || '1.85.0';
    const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH ||
      await downloadAndUnzipVSCode({ version, cachePath });
    if (!fs.existsSync(vscodeExecutablePath)) {
      throw new Error(`VS Code executable is missing: ${vscodeExecutablePath}. Remove the incomplete installation in ${cachePath} and retry.`);
    }
    await runTests({ extensionDevelopmentPath, extensionTestsPath, vscodeExecutablePath,
      launchArgs: [workspace, '--user-data-dir', path.join(temp, 'user-data'),
        '--extensions-dir', path.join(temp, 'extensions'), '--disable-extensions',
        '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
        ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exitCode = 1;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main();
