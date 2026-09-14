'use strict';
const { suite } = require('uvu');
const assert = require('assert');
const { parseInWorker } = require('../../src/parseInWorker');

(() => {
  const test = suite('Parser safety and syntax');
  test('terminates a short catastrophic regex without blocking the event loop', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    try {
      await assert.rejects(parseInWorker({ text: 'a'.repeat(40) + '!', languageId: 'plaintext',
        customPatterns: ['^(a+)+$'] }, { timeoutMs: 250 }), error => error.code === 'TIMEOUT');
      assert.ok(ticks >= 2, 'the extension host must stay responsive');
      const recovered = await parseInWorker({ text: 'function ok() {}', languageId: 'javascript' });
      assert.strictEqual(recovered[0].name, 'ok');
    } finally { clearInterval(timer); }
  });

  test('cancels a running parser', async () => {
    const controller = new AbortController();
    const pending = parseInWorker({ text: 'a'.repeat(40) + '!', languageId: 'plaintext',
      customPatterns: ['^(a+)+$'] }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, error => error.code === 'ABORTED');
  });

  test('detects arrow functions, default exports, class methods, and one-character names', async () => {
    const result = await parseInWorker({ languageId: 'javascript', text: [
      'const add = (a, b) => a + b;', 'export default function main() {}',
      'function f() {}', 'class Foo {', '  calculate() {}', '}',
    ].join('\n') });
    assert.deepStrictEqual(result.map(item => item.name), ['add', 'main', 'f', 'calculate']);
  });

  test('ignores declarations in block comments and multiline strings', async () => {
    const js = await parseInWorker({ languageId: 'javascript', text:
      '/*\nfunction fake() {}\n*/\nconst text = `\nfunction alsoFake() {}\n`;\nfunction real() {}' });
    assert.deepStrictEqual(js.map(item => item.name), ['real']);
    const python = await parseInWorker({ languageId: 'python', text: '"""\ndef fake():\n"""\ndef real():' });
    assert.deepStrictEqual(python.map(item => item.name), ['real']);
  });

  test('does not list return expressions as C# methods', async () => {
    const result = await parseInWorker({ languageId: 'csharp', text: 'return Calculate();\npublic int Calculate() {' });
    assert.deepStrictEqual(result.map(item => item.line), [1]);
  });

  test('detects case-insensitive Russian and English BSL declarations', async () => {
    const result = await parseInWorker({ languageId: 'bsl', text: 'процедура Обработать()\nProcedure Process()\nFUNCTION Calculate()' });
    assert.deepStrictEqual(result.map(item => item.kind), ['bsl-procedure', 'bsl-procedure', 'bsl-function']);
  });
  test.run();
})();
