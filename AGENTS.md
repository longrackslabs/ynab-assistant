# Development guidance

This repository contains portable software and synthetic fixtures only. Never add account IDs, bank statements, credentials, real payees, personal paths, or live financial records.

Keep calculations deterministic and use signed integer milliunits. Report resource limits and ambiguous matches. A matching sum does not prove posting.

The analysis MCP has no network client, credentials, or write tools. Existing YNAB data MCPs supply account reads and independently restricted writes. Do not weaken this separation without an explicit design decision.

Use feature branches and reviewable commits. Run `npm test`, `npm run demo`, and `npm run benchmark` for changes to the analysis engine. Never push or publish without explicit authorization.
