# Section-by-section application review

Map the real product, not a generic checklist of imagined features. Typical sections: inventory/catalog, purchases, sales/returns, accounting/payments, contacts, reports, users/permissions, persistence/recovery, network/devices, settings/licensing/updates and installer/website. Adapt those names to the app and trace cross-section callers.

For each section, maintain a table with dimension, scenario, source/test/artifact, result and remaining uncertainty. The required dimensions are:

| Dimension | Useful evidence |
| --- | --- |
| Correctness and workflow | Normal, empty, invalid, boundary, correction/undo and interrupted lifecycles; reconciliation of conserved values |
| Permissions and security | Actual entry-point authorization, revoked sessions, hostile input, escaping and trust boundaries; no unsolicited attack on live services |
| Compatibility and recovery | Supported old shapes, rollback, atomic-write/acknowledgment split, backup/restore, archive dependencies |
| Reliability and network | Idempotent retry, ordering, concurrency, disconnect/reconnect and failure visibility |
| Performance and capacity | A reproducible representative measurement with before/after output equivalence, scale and limitations |
| Design and accessibility | Real screenshots/screens, interaction states, visual hierarchy, responsive clipping, keyboard/focus, names/roles, contrast, reduced motion, RTL/language rendering |
| Maintainability and test quality | Shared callers, clear ownership, duplicated logic, meaningful assertions, deterministic fixtures, flaky failures and missing coverage |
| Release and documentation | Source/package parity, immutable artifacts, signing/hash checks, installation/update path, truthful help and release record |

“Inspected” is source review. “Exercised” means the named check ran. “Not applicable” needs a reason. “Blocked” identifies the missing browser, credential, hardware or policy; other sections continue. No source-only reviewer can certify layout, production network behavior or installer execution.

Review section by section, then trace joins: delivery note to billed invoice, repeated item lines to returns, purchase receipt to freight after close, posted write to response retry, role changes to queued actions. A finding can arise at the join even if each section looks right alone.

Cheap first passes identify locations and bounded UI issues. Use a focused independent reviewer for risk-heavy lifecycles or uncertain evidence. One skeptical reproduction is often enough; add another viewpoint when the first cannot settle a material claim. Do not spawn two skeptics for every finding by default.

Keep an explicit gate candidate. A review's accepted scope expands only with the user's request or required project rules. The review queue may keep growing while the concrete release completes. Preserve unresolved material money/stock/permission findings in the final report.
