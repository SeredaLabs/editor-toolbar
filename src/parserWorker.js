'use strict';
const { parentPort, workerData } = require('worker_threads');
const { parseFunctions } = require('./functionParser');

parentPort.postMessage(parseFunctions(workerData));
