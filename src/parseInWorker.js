'use strict';
const path = require('path');
const { Worker } = require('worker_threads');

function parseInWorker(snapshot, { signal, timeoutMs = 1000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('Parsing cancelled'), { code: 'ABORTED' }));
    const worker = new Worker(path.join(__dirname, 'parserWorker.js'), {
      workerData: snapshot, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      // terminate() interrupts even a regex stuck inside V8.
      void worker.terminate().catch(() => {});
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(Object.assign(new Error('Parsing cancelled'), { code: 'ABORTED' }));
    const timer = setTimeout(() => finish(Object.assign(new Error('Parsing timed out'), { code: 'TIMEOUT' })), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', result => finish(null, result));
    worker.once('error', error => finish(error));
    worker.once('exit', code => {
      if (!finished) finish(new Error(`Parser exited without results (${code})`));
    });
  });
}

module.exports = { parseInWorker };
