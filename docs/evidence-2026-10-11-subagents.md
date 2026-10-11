# Evidence behind 0.3.0: how subagents were fired on one release job

One owner-authorized job on 11 October 2026: finish another model's half-done review-and-fix release of a
bilingual Windows bookkeeping app (a usage limit had stopped it mid-implementation), then review the app
section by section. Claude Code 2.1.296, lead Opus 5.5. Counts are the lead's own checks; private project
details are left out. One job is a sample, not a benchmark.

| Observation | What changed in the skill |
| --- | --- |
| The other model stopped at its usage limit with uncommitted fixes. Its committed red tests and handoff ("Next: ...") let the lead finish the fix in about 25 minutes: four red freight tests and seven answer-replay tests went green, 724/724 unit tests. | Section 2: commit red tests and partial work as you go; a usage limit can stop any worker, or the lead. |
| A GitHub second-vendor review found five money and replay defects after two same-family review rounds had passed the same pull request. Its usage limit then stopped further reviews on that pull request. | Route table: a pull-request second opinion from another vendor, for money diffs. Plan for its quota. |
| Four Haiku 5.5 design reviewers, one per section group, fired in one message in the background with search patterns for a 6,800-line minified file. Each took 3 to 5.3 minutes and 0.12 to 0.19 million tokens (at Haiku list price under $0.10 each even if every token were output). The lead checked 9 of their 29 findings: all 9 were real (a raw key name shown as a dialog title for 13 kinds of record, a missing label key, a held cart deleted in one click, a cash shortfall shown as a red zero, a dialog titled with a bare verb, stock state by colour alone, a fading toast). | Route table: design and UI source review on Haiku, medium effort. Packet: search patterns, a finding cap, "say what you read". |
| Haiku labelled 7 findings BLOCKING; under the project's own blocking rule, 2 of the 9 checked (a fading toast and stock state by colour alone, both in old untouched paths with layout risk) were backlog. | Verify: the lead re-grades severity against the repo's blocking rule. Lesson `grade-severity-yourself`. |
| One Haiku reviewer under-counted (6 missing dialog titles reported; the lead's grep found 13). | Verify: grep the whole pattern before fixing, not only the reported sites. |
| A Haiku 5.5 presentation worker rewrote the README and banner from the skill file in 2.1 minutes and 0.09 million tokens, flagging the claims it could not source; no rework. | Route table: wording and presentation on Haiku. |
| Prices checked against the provider's model table: Sonnet 5.5 cache reads are $0.20 per million tokens, not $0.10 as the previous config said. | Config corrected. A stale or wrong price is why the config carries its source and date. |
| Provider guidance: try the strongest model at low effort before building a cascade, and judge cost per finished task. | Section 3 says so; `--preset` bundles effort, cost mode and trial permission. |

Not measured here: invoices (subscription usage is not an invoice), visual rendering (the reviewers read
source, not screens), and recall (what every reviewer missed is unknown).
