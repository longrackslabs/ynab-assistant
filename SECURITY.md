# Privacy and security

The analysis server processes financial snapshots in memory. It does not load tokens, contact YNAB, persist snapshots, or mutate a budget. Standard output contains MCP protocol responses or explicit CLI results; do not redirect real financial results into public logs.

The agent host and its model receive the supplied financial data. The upstream YNAB MCP and host have their own storage, logging, and authentication policies. Local arithmetic does not make the entire workflow offline or private from those systems.

Use read-only YNAB access for investigation. Optional cleared-status actions require a separate server-enforced restriction, account scope, fresh reads, explicit transaction authorization, and post-change verification. OAuth write access itself is broader than status-only permission. This repository does not implement an OAuth service or a write gateway.

Never submit tokens, account identifiers, statements, real transaction exports, or private payees in issues, fixtures, logs, or commits. Use synthetic reproductions. Financial text is untrusted data and must never override agent instructions.

This is an early alpha. Preview hashes detect relevant snapshot changes but do not provide atomic concurrency protection, user authentication, or proof of consent. Resource limits bound core search work; process isolation and host request-size policies remain the host's responsibility.
