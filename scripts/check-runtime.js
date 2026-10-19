import {requireSupportedNode} from '../src/runtime.js';
try {requireSupportedNode();}
catch (error) {process.stderr.write(`${error.message}\n`); process.exitCode = 1;}
