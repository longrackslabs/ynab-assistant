import { z } from 'zod';

export const amountSchema = z.number().int().safe();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD, not an ISO timestamp').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date').describe('Calendar date in YYYY-MM-DD format, for example 2026-10-17. Do not pass a timestamp.');
export const transactionSchema = z.object({
  id: z.string().min(1), account_id: z.string().optional(), date: dateSchema,
  amount: amountSchema, cleared: z.enum(['cleared', 'uncleared', 'reconciled']),
  payee_name: z.string().nullable().optional(), payee: z.string().nullable().optional(),
  memo: z.string().nullable().optional(), deleted: z.boolean().optional(),
}).passthrough();
export const snapshotSchema = z.object({
  account: z.object({
    id: z.string().min(1), name: z.string().optional(), type: z.string(),
    cleared_balance: amountSchema, uncleared_balance: amountSchema,
    balance: amountSchema.optional(),
  }).passthrough(),
  transactions: z.array(transactionSchema).max(20000),
  history_complete: z.boolean().default(false),
  retrieval: z.object({
    date_scope: z.enum(['explicit_full_history', 'default_window', 'unknown']),
    row_limit_reached: z.boolean(),
  }).strict().optional().describe('Retrieval provenance. Only explicit_full_history with row_limit_reached false permits a completeness claim. Check upstream since_date defaults; a response below the row cap is insufficient.'),
  as_of: dateSchema.optional().describe('Snapshot calendar date in YYYY-MM-DD format, for example 2026-10-17; omit if unknown. ISO timestamps are invalid.'),
}).strict();

export function retrievalScopeVerified(snapshot) {
  return snapshot.retrieval?.date_scope === 'explicit_full_history' && snapshot.retrieval.row_limit_reached === false;
}
export const limitsSchema = z.object({
  max_candidates: z.number().int().min(1).max(20).default(5),
  max_states: z.number().int().min(1).max(100000).default(30000),
  max_operations: z.number().int().min(1).max(2000000).default(1000000),
  max_milliseconds: z.number().int().min(1).max(5000).default(2000),
}).default({max_candidates: 5, max_states: 30000, max_operations: 1000000, max_milliseconds: 2000});
export const analysisInputSchema = z.object({
  snapshot: snapshotSchema,
  bank_balance: z.string().max(40),
  bank_balance_convention: z.enum(['card_debt_positive', 'signed']).default('card_debt_positive'),
  decimal_digits: z.number().int().min(0).max(3).default(2),
  limits: limitsSchema,
}).strict();

export const bankEntrySchema = z.object({
  id: z.string().min(1), date: dateSchema, posting_date: dateSchema.optional(),
  amount: amountSchema, payee: z.string().default(''), posted: z.boolean().default(true),
}).strict();
export const statementInputSchema = z.object({
  snapshot: snapshotSchema,
  bank_entries: z.array(bankEntrySchema).max(5000),
  start_date: dateSchema, end_date: dateSchema,
  opening_balance: amountSchema.optional(), closing_balance: amountSchema.optional(),
  date_tolerance_days: z.number().int().min(0).max(14).default(5),
}).strict();
export const previewInputSchema = z.object({
  snapshot: snapshotSchema,
  transaction_ids: z.array(z.string().min(1)).min(1).max(100),
  desired_status: z.enum(['cleared', 'uncleared']),
}).strict();

export function validateSnapshot(input) {
  const snapshot = snapshotSchema.parse(input);
  const seen = new Set();
  for (const tx of snapshot.transactions) {
    if (seen.has(tx.id)) throw new Error('Duplicate transaction IDs: deduplicate the fetched snapshot first');
    seen.add(tx.id);
    if (tx.account_id !== undefined && tx.account_id !== snapshot.account.id) {
      throw new Error('The snapshot contains transactions from another account');
    }
  }
  return snapshot;
}
