import { analysisInputSchema, validateSnapshot, retrievalScopeVerified } from './schema.js';
import { digitSwap, displayMoney, exact, parseMoney, sum } from './money.js';
import { findSubsets } from './search.js';

export function view(tx) {
  return {id: tx.id, date: tx.date, payee: tx.payee_name ?? tx.payee ?? '', amount: tx.amount,
    amount_display: displayMoney(tx.amount), cleared: tx.cleared, memo: tx.memo ?? null};
}
export function analyzeReconciliation(input) {
  const args = analysisInputSchema.parse(input), snapshot = validateSnapshot(args.snapshot);
  let bank = parseMoney(args.bank_balance);
  if (snapshot.account.type.toLowerCase() === 'creditcard' && bank > 0 && args.bank_balance_convention === 'card_debt_positive') bank = -bank;
  const delta = exact(bank - snapshot.account.cleared_balance);
  const rows = snapshot.transactions.filter(tx => !tx.deleted);
  const pending = rows.filter(tx => tx.cleared === 'uncleared');
  const nonzero = pending.filter(tx => tx.amount !== 0);
  if (nonzero.length > 5000) throw new Error('More than 5000 uncleared entries: narrow the problem using posted bank records');
  const pendingSum = sum(pending.map(tx => tx.amount));
  const consistent = pendingSum === snapshot.account.uncleared_balance;
  const retrievalVerified = retrievalScopeVerified(snapshot);
  const inputComplete = snapshot.history_complete && retrievalVerified && consistent;
  const result = findSubsets(nonzero.map(tx => tx.amount), delta, args.limits);
  const candidates = result.masks.map(mask => {
    const selected = nonzero.filter((_, i) => mask & (1n << BigInt(i)));
    if (sum(selected.map(tx => tx.amount)) !== delta) throw new Error('Internal candidate arithmetic error');
    return {transaction_ids: selected.map(tx => tx.id), amount: delta, transactions: selected.map(view)};
  });
  const scale = 10 ** (3 - args.decimal_digits);
  const swaps = delta === 0 ? [] : rows.flatMap(tx => {
    const corrected = tx.cleared === 'uncleared' ? delta : exact(tx.amount + delta);
    return digitSwap(tx.amount, corrected, args.decimal_digits) ? [{transaction: view(tx), possible_correct_amount: corrected,
      possible_correct_amount_display: displayMoney(corrected), proposed_explanation: tx.cleared === 'uncleared' ? 'amount correction followed by clearing' : 'existing posted amount correction',
      requires_bank_evidence: true}] : [];
  }).sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
  return {
    account_id: snapshot.account.id, bank_signed_balance: bank, cleared_balance: snapshot.account.cleared_balance,
    difference: delta, difference_display: displayMoney(delta), already_balanced: delta === 0,
    uncleared_count: pending.length, input_complete: inputComplete, uncleared_sum_matches_account: consistent,
    retrieval_scope_verified: retrievalVerified,
    search: {complete: result.complete, candidate_list_truncated: result.truncated, limit_reason: result.reason, operations: result.operations},
    candidates, unique_within_complete_search: inputComplete && result.complete && !result.truncated && candidates.length === 1,
    difference_divisible_by_nine_minor_units: delta !== 0 && delta % scale === 0 && Math.abs(delta / scale) % 9 === 0,
    transposition_candidates: swaps.slice(0, 20), transposition_candidates_truncated: swaps.length > 20,
    posting_verified: false, can_auto_clear: false,
    warnings: [!inputComplete && 'History completeness or snapshot consistency is unverified.',
      !retrievalVerified && 'Full-history retrieval is unverified. Upstream default date windows can omit older uncleared entries even below the row limit.',
      result.reason && delta !== 0 && 'Search stopped at a resource limit; no-match is not exhaustive.',
      'Arithmetic matches are candidates, not proof of bank posting.'].filter(Boolean),
  };
}
