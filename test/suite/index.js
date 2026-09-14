'use strict';
const fs = require('fs');
const path = require('path');
const { run: runSuites } = require('uvu/run');

async function run() {
  const previousExitCode = process.exitCode;
  let timer;
  try {
    const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.test.js')).sort();
    await Promise.race([
      runSuites(files.map(file => ({ name: file, file: path.join(__dirname, file) }))),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Test suite timed out after 120 seconds')), 120000); }),
    ]);
    if (process.exitCode) throw new Error('Extension tests failed.');
  } finally {
    clearTimeout(timer);
    process.exitCode = previousExitCode;
  }
}

module.exports = { run };
