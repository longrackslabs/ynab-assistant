# Reconciliation workflow

## Fetch and normalize

Discover the YNAB data MCP's actual tool schemas. Server names and tool names differ. Fetch the selected account and all relevant transactions, including all uncleared entries. Check pagination, default limits, deleted records, account identity, and whether the response is a delta or a full collection. A short response is not evidence of completeness. Do not fetch only recent entries and label the history complete.

Check implicit date filters separately from row limits. In the tested YNAB data MCP, omitting `since_date` returned only one year of history, even with a high `max_results`. Supply an explicit `since_date` at or before the account's earliest register activity, or use an upstream endpoint verified to return every uncleared entry without a date window. Resolve all row caps or pagination. If the available tools cannot establish full coverage, keep history completeness unverified and explain the limitation.

Build a snapshot with `account`, `transactions`, `history_complete`, and optional `as_of`. Account fields are `id`, `type`, `cleared_balance`, `uncleared_balance`, and optional `balance`. Transaction fields are `id`, `date`, `amount`, `cleared`, and optionally `account_id`, `payee_name`, `memo`, and `deleted`. Preserve integer milliunits from YNAB: 1000 is one currency unit. Preserve signed amounts. Parent split transactions count once; do not also include subtransactions as separate account activity. Scheduled future occurrences are not posted register entries.

All date fields, including `snapshot.as_of`, use `YYYY-MM-DD`, for example `2026-10-17`. Do not pass an ISO timestamp such as `2026-10-17T12:30:00Z`. `as_of` is optional; omit it if the snapshot date is unknown. It describes the snapshot date, not the historical statement cutoff.

Include `retrieval: {date_scope: "explicit_full_history", row_limit_reached: false}` only after establishing full history coverage. Use `date_scope: "default_window"` for an upstream default date filter, or `"unknown"` if unresolved. Set `row_limit_reached: true` if a result cap remains unresolved. Missing provenance, a default window, or a reached row limit prevents the engine from claiming complete input or a unique full-population solution, even when `history_complete` is true and uncleared totals agree. These are caller-provided provenance assertions, not independently verified API evidence.

Set `history_complete` true only after verifying the fetched population covers the task. Account totals and uncleared sums are a consistency check, not proof that pagination is complete. Fetch balances and transactions close together; refresh if concurrent changes make them inconsistent.

## Balance-only investigation

Some banks display a balance that includes pending debits or card payments. Confirm the posted ledger balance before diagnosing missing imports. Pending restaurant charges may change when tips post. Leave pending entries uncleared and verify final posted amounts before clearing them; do not create an adjustment to force agreement.

Pass the snapshot and decimal `bank_balance` string to `analyze_reconciliation`. Positive credit-card debt is converted to a negative YNAB balance by default. Use `bank_balance_convention: signed` for an already signed balance or positive credit balance. The target is bank posted balance minus YNAB cleared balance, not working balance.

Review the search's completeness, truncation, and input-completeness fields before describing a result. No match after a resource limit does not prove no solution exists. Zero difference means the cleared balance agrees; uncleared entries may legitimately remain pending. Do not clear offsetting entries just because they net to zero.

The transposition report tests actual swapped digits. A difference divisible by nine minor units is only a clue, not a diagnosis. A previously reconciled row can still be wrong, but this skill does not change it.

Without the companion tools, use a reliable exact-integer local calculation, preserve the same evidence boundaries, and disclose any search limits. Do not improvise credential extraction or bypass a restricted MCP with direct API calls.

## Statement investigation

Obtain the statement from the user or an explicitly authorized source. Extract dates, signed amounts, payees, posting status, period, and opening/closing balances. Verify extraction against the original statement, especially debit/credit columns and OCR decimals. Do not silently assume an uncertain sign or date.

Call `compare_statement` with `snapshot`, `bank_entries`, `start_date`, and `end_date`. Each bank entry needs a distinct local `id`, `date`, integer `amount`, and `payee`; optional `posting_date` and `posted` defaulting true are supported. Optional opening and closing balances use signed milliunits. The tool checks their arithmetic. Its unique amount/payee/date matches are review aids, not proof of identity. Renamed merchants may remain unmatched; repeated charges remain ambiguous. Partial statements can pass balance arithmetic accidentally, so check page coverage too.

Compare the statement period with historical register activity. A current account balance cannot be compared directly with an old closing balance unless later activity is accounted for. Unmatched rows are investigation leads. Absence from one statement does not establish a duplicate or justify deletion.

## Approved status changes

Use `preview_clear_status` with snapshot, specific `transaction_ids`, and `desired_status` (`cleared` or `uncleared`). Show the affected dates/payees/amounts and resulting cleared balance. Obtain authorization for those specific changes unless already explicit in the user's request.

Re-fetch the account and selected transactions; regenerate the preview and compare its `plan_id` with the approved preview. Stop if it differs. Use only a status-specific tool that rejects other edits and reconciled rows. The companion analysis server cannot apply anything. A broad update tool is not a substitute for server-enforced field restrictions.

Verify selected statuses and cleared/uncleared/working balances after application. On partial failure, report exactly what changed and re-read before proceeding. Do not retry blindly or automatically reverse user changes. The YNAB UI may require a refresh to display API changes.

## Authorized categories and acceptance

When the data MCP exposes `set_transaction_category`, identify the exact authorized transactions and target category. Exclude account transfers that appear uncategorized because they have no expense category. Re-read each entry, verify identity and financial fields, and supply its current expected_category_id (null when uncategorized). The restricted tool can reject transfers, splits, and reconciled entries; respect its scope rather than replacing it with a general update.

Import acceptance uses the approved flag and is separate from categorization or clearing. When acceptance is authorized and `approve_transaction` is exposed, re-read the entry and pass its reviewed expected_category_id. This action sets approved=true and cannot unapprove. Categorization alone does not authorize acceptance.

For either action, process sequentially, track successful IDs, and stop on unexpected state or failure. Re-read uncertain operations before retrying. Verify saved categories/approval and unchanged amounts, dates, payees, account, cleared status, memo, and account balances.

## Previewed transaction reconciliation

When available, use `preview_account_reconciliation` with the exact account and signed posted bank balance in integer milliunits. Card debt is negative. Inspect eligible entries, balance/history consistency, blockers, and operation limits. The current companion data MCP refuses more than 25 eligible entries. Do not clear pending entries or approve transactions to force a preview to pass.

Only apply reconciliation the user has authorized for that account and balance. Call `reconcile_account` with the reviewed plan_id and the same account and bank balance. It rejects changed snapshots and only moves already-cleared, approved entries to reconciled. Existing authorization to reconcile the specified account need not be requested again, but unresolved posting ambiguity must be resolved before writing.

Check the returned status, verified IDs, balance preservation, and untouched transactions. Partial failures and ambiguous timeouts can leave successful writes behind. Re-read before deciding on a retry; never blindly retry or undo a partial reconciliation.

The public YNAB API has no dedicated account reconciliation endpoint or setter for last_reconciled_at. Live validation found that transaction reconciliation flags changed while the account date did not. Report those outcomes separately. The user may finish the native account UI workflow to update that date; do not claim the public API reproduced the complete account button.
