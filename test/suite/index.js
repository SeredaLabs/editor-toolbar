'use strict';
const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

function run() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });
  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    const files = fs.readdirSync(testsRoot).filter(f => f.endsWith('.test.js'));
    files.forEach(f => mocha.addFile(path.join(testsRoot, f)));

    try {
      mocha.run(failures => {
        if (failures > 0) reject(new Error(`${failures} tests failed.`));
        else resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { run };
