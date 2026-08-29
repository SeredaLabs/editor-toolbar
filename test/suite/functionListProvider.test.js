'use strict';
const assert = require('assert');
const vscode = require('vscode');
const { FunctionListProvider } = require('../../src/functionListProvider');

async function openDoc(content, language) {
  return vscode.workspace.openTextDocument({ content, language });
}

suite('FunctionListProvider._parse', () => {
  const provider = new FunctionListProvider(vscode.Uri.file(__dirname));

  teardown(async () => {
    await vscode.workspace.getConfiguration('editorToolbar')
      .update('customPatterns', undefined, vscode.ConfigurationTarget.Global);
  });

  test('detects PHP function with repeated modifiers', async () => {
    const doc = await openDoc('public static function foo() {\n}\n', 'php');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'foo');
  });

  test('detects plain PHP function with no modifiers', async () => {
    const doc = await openDoc('function bar() {\n}\n', 'php');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'bar');
  });

  test('detects C# method with multiple modifiers', async () => {
    const doc = await openDoc('public static void Foo() {\n}\n', 'csharp');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Foo');
  });

  test('detects C# method with a single modifier and custom return type', async () => {
    const doc = await openDoc('private OrderResult Bar() {\n}\n', 'csharp');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Bar');
  });

  test('does not hang on an adversarial long line (linear-time regression guard)', async () => {
    const adversarial = 'public static '.repeat(2000) + 'function foo() {';
    const doc = await openDoc(adversarial, 'php');
    const start = Date.now();
    provider._parse(doc);
    assert.ok(Date.now() - start < 2000, 'parsing took too long — a pattern may have regressed to catastrophic backtracking');
  });

  // "@@name(" — deliberately doesn't fit the "TYPE NAME(" shape any default pattern looks for,
  // so a match here can only come from the custom pattern itself.
  const CUSTOM_RE = '^\\s*@@\\s*([\\w]+)\\s*\\(';

  test('ignores a custom pattern on lines longer than the safety cap', async () => {
    await vscode.workspace.getConfiguration('editorToolbar')
      .update('customPatterns', [CUSTOM_RE], vscode.ConfigurationTarget.Global);

    const longPadding = ' '.repeat(600);
    const doc = await openDoc(`@@${longPadding}shouldNotMatch(`, 'plaintext');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 0);
  });

  test('still applies a custom pattern on a normal-length line', async () => {
    await vscode.workspace.getConfiguration('editorToolbar')
      .update('customPatterns', [CUSTOM_RE], vscode.ConfigurationTarget.Global);

    const doc = await openDoc('@@shouldMatch(', 'plaintext');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'shouldMatch');
    assert.strictEqual(results[0].kind, 'custom');
  });
});

suite('FunctionListProvider cache', () => {
  test('_getFunctions reuses cached results while the document version is unchanged', async () => {
    const provider = new FunctionListProvider(vscode.Uri.file(__dirname));
    const doc = await openDoc('function foo() {}\n', 'javascript');

    const first = provider._getFunctions(doc);
    const second = provider._getFunctions(doc);
    assert.strictEqual(first, second, 'expected the same cached array instance');
  });

  test('refresh(doc) populates the cache so a later _getFunctions call is a cache hit', async () => {
    const provider = new FunctionListProvider(vscode.Uri.file(__dirname));
    const doc = await openDoc('function foo() {}\n', 'javascript');

    provider.refresh(doc);
    const cached = provider._cache.get(doc.uri.toString());
    assert.strictEqual(cached.version, doc.version);

    const results = provider._getFunctions(doc);
    assert.strictEqual(results, cached.results);
  });

  test('dispose() clears the pending debounce timer and the cache', async () => {
    const provider = new FunctionListProvider(vscode.Uri.file(__dirname));
    const doc = await openDoc('function foo() {}\n', 'javascript');

    provider.refresh(doc);
    provider.refreshDebounced(doc);
    provider.dispose();

    assert.strictEqual(provider._cache.size, 0);
    assert.strictEqual(provider._debounceTimer, null);
  });
});
