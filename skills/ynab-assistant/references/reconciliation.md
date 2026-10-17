# Reconciliation workflow

## Fetch and normalize

Discover the YNAB data MCP's actual tool schemas. Server names and tool names differ. Fetch the selected account and all relevant transactions, including all uncleared entries. Check pagination, default limits, deleted records, account identity, and whether the response is a delta or a full collection. A short response is not evidence of completeness. Do not fetch only recent entries and label the history complete.

Build a snapshot with `account`, `transactions`, `history_complete`, and optional `as_of`. Account fields are `id`, `type`, `cleared_balance`, `uncleared_balance`, and optional `balance`. Transaction fields are `id`, `date`, `amount`, `cleared`, and optionally `account_id`, `payee_name`, `memo`, and `deleted`. Preserve integer milliunits from YNAB: 1000 is one currency unit. Preserve signed amounts. Parent split transactions count once; do not also include subtransactions as separate account activity. Scheduled future occurrences are not posted register entries.

Set `history_complete` true only after verifying the fetched population covers the task. Account totals and uncleared sums are a consistency check, not proof that pagination is complete. Fetch balances and transactions close together; refresh if concurrent changes make them inconsistent.

## Balance-only investigation

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
