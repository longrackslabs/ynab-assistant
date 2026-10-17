# Development roadmap

## Local alpha: reconciliation foundation

Implemented: portable skill, exact milliunit arithmetic, bounded combination search, ambiguity reporting, transposition clues, conservative statement matching, status previews, synthetic fixtures, and real stdio tests.

Acceptance gate: clean dependency install, unit and protocol tests, benchmark, skill validation, private-data scan, and local agent configuration. No production budget mutation is required for these tests.

## Personal pilot

Use the read-only analysis alongside an existing YNAB MCP for a month. Record anonymized failure cases, false candidate suggestions, missed matches, and time saved. Test real statement extraction without committing financial records. Check freshness and population completeness across upstream MCP implementations. Confirm that explanations remain useful when the answer is ambiguous.

Exit gate: repeatable bank-to-register reviews with no unsupported claims of posting, no unsafe writes, and regression fixtures for observed failures. Existing reconciled accounts are useful balance checks but do not substitute for real discrepancy cases.

## Small public beta

Prepare a reviewed public repository, runnable installation guide, license review, two host compatibility tests, and synthetic examples a new user can reproduce. Choose and document a supported upstream YNAB MCP adapter. Validate read-only OAuth setup and server-enforced status-only permissions before documenting optional writes. Do not ship a prompt-only permission boundary as an API restriction.

Exit gate: a second person completes installation and a read-only reconciliation without developer intervention. Remote publication requires the project owner's authorization.

## Later capabilities

Prioritize recurring-payment changes, duplicate investigation, scheduled-versus-imported amount differences, and budget health summaries. Add deterministic calculations and tests before each skill workflow. Expose supported reports rather than trying to clone every Toolkit feature. Fonts, register layout, keyboard shortcuts and browser decorations remain browser-extension territory.

A shared OAuth service, broad transaction editing, automatic adjustments, and deletion are separate product decisions, not defaults in this roadmap.
