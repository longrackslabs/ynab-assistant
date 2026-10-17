import { createHash } from 'node:crypto';
import { previewInputSchema, validateSnapshot } from './schema.js';
import { exact, sum } from './money.js';

function fingerprint(tx) {
  return {id: tx.id, account_id: tx.account_id ?? null, date: tx.date, amount: tx.amount,
    cleared: tx.cleared, deleted: tx.deleted ?? false, payee_id: tx.payee_id ?? null,
    payee: tx.payee_name ?? tx.payee ?? null, memo: tx.memo ?? null};
}
export function previewClearStatus(input) {
  const args = previewInputSchema.parse(input), snapshot = validateSnapshot(args.snapshot);
  if (new Set(args.transaction_ids).size !== args.transaction_ids.length) throw new Error('Duplicate selected transaction IDs');
  const transactions = args.transaction_ids.slice().sort().map(id => {
    const tx = snapshot.transactions.find(row => row.id === id);
    if (!tx || tx.deleted) throw new Error('Selected transaction is missing or deleted');
    if (tx.cleared === 'reconciled') throw new Error('Reconciled transactions cannot be changed by this workflow');
    return fingerprint(tx);
  });
  const delta = sum(transactions.map(tx => tx.cleared === args.desired_status ? 0 : args.desired_status === 'cleared' ? tx.amount : -tx.amount));
  const base = {account_id: snapshot.account.id, desired_status: args.desired_status, transactions,
    expected_cleared_balance: snapshot.account.cleared_balance, expected_uncleared_balance: snapshot.account.uncleared_balance};
  return {...base, plan_id: createHash('sha256').update(JSON.stringify(base)).digest('hex'),
    cleared_balance_delta: delta, resulting_cleared_balance: exact(snapshot.account.cleared_balance + delta),
    resulting_uncleared_balance: exact(snapshot.account.uncleared_balance - delta),
    working_balance_changed: false, requires_user_confirmation: true, applied: false,
    warning: 'This preview neither proves bank posting nor grants permission. Re-fetch and compare before using a separately restricted YNAB write tool.'};
}
export function verifyFreshPreview(plan, snapshot) {
  const fresh = previewClearStatus({snapshot, transaction_ids: plan.transactions.map(tx => tx.id), desired_status: plan.desired_status});
  if (fresh.plan_id !== plan.plan_id) throw new Error('Stale preview: account or transaction data changed');
  return true;
}
