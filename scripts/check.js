'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
function checkDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkDirectory(file);
    else if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
for (const directory of ['src', 'test', 'scripts']) checkDirectory(path.join(root, directory));
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = json('package.json');
assert.strictEqual(json('package-lock.json').version, manifest.version);
for (const prefix of ['package.nls', 'l10n/bundle.l10n']) {
  const english = json(`${prefix}.json`);
  for (const language of ['uk', 'ru']) {
    const translation = json(`${prefix}.${language}.json`);
    assert.deepStrictEqual(Object.keys(translation).sort(), Object.keys(english).sort(), `${prefix}: incomplete ${language} translation`);
    for (const [key, value] of Object.entries(translation)) {
      assert.strictEqual(typeof value, 'string');
      assert.ok(value.length, `Empty translation: ${key}`);
      assert.deepStrictEqual(value.match(/\{\d+\}/g) || [], english[key].match(/\{\d+\}/g) || [], `Invalid placeholders: ${key}`);
    }
  }
}
for (const [, key] of JSON.stringify(manifest).matchAll(/%([^%]+)%/g)) assert.ok(json('package.nls.json')[key], `Missing manifest translation: ${key}`);
if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.strictEqual(process.env.GITHUB_REF_NAME, `v${manifest.version}`, 'Release tag must match package.json');
}
console.log('Syntax, localization, and version checks passed.');
