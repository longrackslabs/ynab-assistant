#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { analyzeReconciliation } from '../src/analyze.js';
import { requireSupportedNode } from '../src/runtime.js';

try {
  requireSupportedNode();
  const command = process.argv[2];
  if (command === 'mcp') {
    const { startServer } = await import('../src/server.js'); await startServer();
  } else if (command === 'demo') {
    const input = JSON.parse(await readFile(new URL('../examples/reconciliation.json', import.meta.url), 'utf8'));
    process.stdout.write(JSON.stringify(analyzeReconciliation(input), null, 2) + '\n');
  } else if (command === 'analyze') {
    const {positionals, values} = parseArgs({args: process.argv.slice(3), allowPositionals: true, options: {'bank-balance': {type: 'string'}, signed: {type: 'boolean', default: false}}});
    if (positionals.length !== 1 || values['bank-balance'] === undefined) throw new Error('Usage: ynab-assistant analyze snapshot.json --bank-balance=123.45 [--signed]');
    const snapshot = JSON.parse(await readFile(positionals[0], 'utf8'));
    process.stdout.write(JSON.stringify(analyzeReconciliation({snapshot, bank_balance: values['bank-balance'], bank_balance_convention: values.signed ? 'signed' : 'card_debt_positive'}), null, 2) + '\n');
  } else throw new Error('Usage: ynab-assistant mcp | demo | analyze snapshot.json --bank-balance=123.45');
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
