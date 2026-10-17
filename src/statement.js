import { statementInputSchema, validateSnapshot, retrievalScopeVerified } from './schema.js';
import { sum } from './money.js';
import { view } from './analyze.js';

const day = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
export function normalizePayee(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/^(sq|tst)\s*\*\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function compareStatement(input) {
  const args = statementInputSchema.parse(input), snapshot = validateSnapshot(args.snapshot);
  if (args.start_date > args.end_date) throw new Error('Statement start must precede end');
  if (new Set(args.bank_entries.map(row => row.id)).size !== args.bank_entries.length) throw new Error('Duplicate bank entry IDs');
  const bank = args.bank_entries.filter(row => row.posted && (row.posting_date ?? row.date) >= args.start_date && (row.posting_date ?? row.date) <= args.end_date);
  const rows = snapshot.transactions.filter(row => !row.deleted && day(row.date) >= day(args.start_date) - args.date_tolerance_days && day(row.date) <= day(args.end_date) + args.date_tolerance_days);
  const index = new Map();
  for (const row of rows) { const key = row.amount; if (!index.has(key)) index.set(key, []); index.get(key).push(row); }
  const edges = new Map(), references = new Map(); let comparisons = 0, complete = true;
  for (const entry of bank) {
    const candidates = [];
    for (const tx of index.get(entry.amount) ?? []) {
      if (++comparisons > 1000000) { complete = false; break; }
      if (Math.min(Math.abs(day(tx.date) - day(entry.date)), Math.abs(day(tx.date) - day(entry.posting_date ?? entry.date))) > args.date_tolerance_days) continue;
      const name = normalizePayee(entry.payee), other = normalizePayee(tx.payee_name ?? tx.payee ?? '');
      if (name && name === other) candidates.push(tx.id);
    }
    edges.set(entry.id, candidates);
    for (const id of candidates) references.set(id, (references.get(id) ?? 0) + 1);
    if (!complete) break;
  }
  const matches = [], matchedBank = new Set(), matchedYnab = new Set();
  // Require uniqueness on both sides. Never resolve duplicate amounts by row order.
  if (complete) for (const entry of bank) {
    const ids = edges.get(entry.id);
    if (ids.length === 1 && references.get(ids[0]) === 1) {
      matchedBank.add(entry.id); matchedYnab.add(ids[0]);
      matches.push({bank_entry_id: entry.id, transaction: view(rows.find(tx => tx.id === ids[0])), basis: 'exact normalized payee and amount, nearby date', requires_review: true});
    }
  }
  const arithmeticAvailable = args.opening_balance !== undefined && args.closing_balance !== undefined;
  const calculated = arithmeticAvailable ? sum([args.opening_balance, ...bank.map(row => row.amount)]) : null;
  return {
    account_id: snapshot.account.id, comparison_complete: complete, comparisons,
    history_complete: snapshot.history_complete && retrievalScopeVerified(snapshot),
    statement_arithmetic: {checked: arithmeticAvailable, calculated_closing_balance: calculated, matches: arithmeticAvailable ? calculated === args.closing_balance : null},
    matches,
    unmatched_bank_entries: bank.filter(row => !matchedBank.has(row.id)).map(row => ({...row, candidate_transaction_ids: edges.get(row.id) ?? []})),
    unmatched_ynab_transactions: rows.filter(row => !matchedYnab.has(row.id)).map(view),
    excluded_bank_entry_ids: args.bank_entries.filter(row => !bank.includes(row)).map(row => row.id),
    can_auto_clear: false,
    warnings: ['Unmatched entries are investigation leads, not proof of a missing or duplicate transaction.',
      !complete && 'Comparison limit reached. Matches withheld.',
      (!snapshot.history_complete || !retrievalScopeVerified(snapshot)) && 'Full YNAB history is unverified; default date windows and row limits must be checked.',
      snapshot.as_of !== args.end_date && 'Current account balances must not be compared directly with a past statement closing balance.'].filter(Boolean),
  };
}
