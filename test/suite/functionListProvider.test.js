'use strict';
const assert = require('assert');
const vscode = require('vscode');
const { FunctionListProvider, groupByKindLabel } = require('../../src/functionListProvider');

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

  test('does not misdetect a call inside a condition as a method (cross-language false positive)', async () => {
    // The generic "TYPE NAME(" catch-all (meant for C#/Java) also matches "if
    // checkValue(" — a plain function call, not a declaration. Scoping patterns
    // to the document's actual language (here: Python, which only looks for
    // `def`) must keep this from being misdetected as a method.
    const python = [
      'def choose_period():',
      '    if check_value(period):',
      '        return None',
    ].join('\n');
    const doc = await openDoc(python, 'python');
    const results = provider._parse(doc);
    assert.strictEqual(results.length, 1, 'only the real def declaration should be detected');
    assert.strictEqual(results[0].name, 'choose_period');
    assert.strictEqual(results[0].kind, 'function');
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

suite('groupByKindLabel', () => {
  test('groups symbols under PROCEDURES/FUNCTIONS in a fixed order', () => {
    const fns = [
      { name: 'CalculateTotal', line: 10, kind: 'bsl-function' },
      { name: 'CreateOrder', line: 0, kind: 'bsl-procedure' },
      { name: 'SaveOrder', line: 5, kind: 'bsl-procedure' },
      { name: 'GetPrice', line: 15, kind: 'bsl-function' },
    ];
    const groups = groupByKindLabel(fns);
    assert.deepStrictEqual(groups.map(g => g.title), ['PROCEDURES', 'FUNCTIONS']);
    assert.deepStrictEqual(groups[0].items.map(f => f.name), ['CreateOrder', 'SaveOrder']);
    assert.deepStrictEqual(groups[1].items.map(f => f.name), ['CalculateTotal', 'GetPrice']);
  });

  test('omits a section header for a kind with no symbols', () => {
    const fns = [{ name: 'onlyOne', line: 0, kind: 'function' }];
    const groups = groupByKindLabel(fns);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].title, 'FUNCTIONS');
  });

  test('an unknown kind falls back to the Function group', () => {
    const fns = [{ name: 'weird', line: 0, kind: 'totally-unrecognized' }];
    const groups = groupByKindLabel(fns);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].title, 'FUNCTIONS');
  });
});

suite('FunctionListProvider navigation UX', () => {
  test('unfolding the target line reveals a folded procedure body', async () => {
    // Same mechanism showQuickPick() uses on accept: on a fully-folded file every
    // header line looks identical (editor.foldBackground), so the destination of
    // a jump is invisible unless we unfold it back open.
    const doc = await openDoc('function foo() {\n  return 1;\n}\nfunction bar() {}\n', 'javascript');
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    await vscode.commands.executeCommand('editor.fold', { selectionLines: [0] });
    const foldedLines = editor.visibleRanges.map(r => [r.start.line, r.end.line]);
    assert.ok(!foldedLines.some(([s, e]) => s <= 1 && 1 <= e), 'line 1 should be hidden once folded');

    await vscode.commands.executeCommand('editor.unfold', { selectionLines: [0], levels: 1 });
    const unfoldedLines = editor.visibleRanges.map(r => [r.start.line, r.end.line]);
    assert.ok(unfoldedLines.some(([s, e]) => s <= 1 && 1 <= e), 'line 1 should be visible again after unfold');
  });

  test('_flashLine sets and then clears the reveal-highlight decoration', async () => {
    const provider = new FunctionListProvider(vscode.Uri.file(__dirname));
    const doc = await openDoc('function foo() {}\n', 'javascript');
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    provider._flashLine(editor, 0);
    assert.ok(provider._highlightTimer, 'a clear-highlight timer should be scheduled');

    provider.dispose();
    assert.strictEqual(provider._highlightTimer, null, 'dispose() should cancel the pending highlight timer');
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
