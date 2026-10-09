# Cost model: reading the ledger and picking models

The ledger (`skill/data/ledger.jsonl`, created by your first `log`) is a list of verified outcomes. One line per task:

```json
{"date":"2026-10-09","project":"example-erp","task":"round-1 core review","model":"haiku","role":"review-core","confirmed":3,"refuted":1,"rework":0,"minutes":2.6,"note":"..."}
```

| Field | Meaning |
| --- | --- |
| `confirmed` | Claims or work the lead checked and found right |
| `refuted` | Claims the lead checked and found wrong, or "defects" that are by design |
| `rework` | Accepted work the lead had to fix afterwards |
| `minutes` | Wall-clock time of the worker's task. The lead's own verification time is not logged |
| `note` | What was right, what was wrong, and why. Orchestrator mistakes go here, not against the model |

Log only what the lead verified. A model's report of its own success is not evidence.

## The score

For each model and role, `pair.mjs` computes:

```
checked = confirmed + refuted
score   = (confirmed + 1) / (checked + 2)  -  0.1 * (rework / tasks)
```

- The `+1` and `+2` are Laplace smoothing. With no evidence the score is 0.5, and it moves only as checked claims arrive.
- Each reworked task costs 0.1 of the rework rate. A model that needs rework often loses ground even when its claims check out.
- `proven` means three or more checked claims. Fewer is `trial`: assign only when the lead can check every claim cheaply.

## Thresholds

| Setting | Value | Effect |
| --- | --- | --- |
| `MIN_EVIDENCE` | 3 | Below this a row is `trial` |
| Score floor | 0.6 | Below this the lead keeps the role or picks the next candidate (a rule in `SKILL.md`, not in the script) |
| `NEAR_TIE` | 0.08 | Scores within this band count as a tie, and the cheaper model wins |
| `COST` | haiku 1, sonnet 3, codex 3, opus 5, fable 8 | Relative cost per unit of work, used only for ties |

Replace the `COST` values with your own price ratio. The ratio changes the tie-breaks, and nothing else.

## Reading `stats`

```
node skill/scripts/pair.mjs stats
```

The output has one row per model and role. Read three things:

1. **`evidence`.** A `trial` row is an assumption. Do not treat its score as a finding.
2. **`rework`.** A high rework count next to a good score means the model's claims check out but its fixes need
   a second pass. Budget for it, or give the work to a reviewer.
3. **Close scores.** Within 0.08, the cheaper model wins. Check the hard rules before you accept that pick.

## Worked example, from the example ledger

`review-core` has two candidates with enough rows:

| Model | Tasks | Confirmed | Refuted | Score |
| --- | --- | --- | --- | --- |
| haiku | 11 | 29 | 4 | 0.857 |
| codex | 3 | 6 | 0 | 0.875 |

The difference is 0.018, inside the 0.08 band, so `pick` returns haiku. That is the intended behaviour. It does not mean the
second vendor is worse. The second vendor is assigned to money and permission diffs by the review playbook, because
it finds different things. Its value shows in the notes: it caught a cost leak that a cheap UI reviewer missed, and
a regression that a round-one fix had introduced. Read the `note` column before you read the score.

## Pitfalls

- **Small samples.** Thirty rows over four roles is not a verdict on a model. Trust the rows you have checked
  yourself, and treat the score as a sort order.
- **Mixed tasks in one row.** Log one row per task. A row that bundles several reviews hides which one went wrong.
- **Recording the self-report.** If the model's count of "confirmed" is logged without the lead's check, the score
  rewards confidence. Log what the lead checked.
- **Time is not cost.** `minutes` is a proxy for the size of the work. Replace it with token counts if you track them.
- **Lead time is missing.** The lead's verification is the expensive part of a cheap-worker setup. The ledger does not
  capture it, so compare costs with that in mind.

## Cost arithmetic from the example ledger

Using the example ledger's minutes and the default weights (haiku 1, codex 3, opus 5), the 44 tasks cost about 45% of
running every task on the lead. The mix is 39 Haiku tasks, 3 second-vendor tasks and 2 lead tasks. That 45% counts
only the worker tasks. The lead's verification time is missing from the ledger, and it adds to the mix's cost. So the
real saving is smaller than the 55% the worker figures suggest. Measure your own verification time before you quote a saving.
