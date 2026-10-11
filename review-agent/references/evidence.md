# Evidence, cost controls and bounded improvement

`pair.mjs` is an offline decision aid. It never starts agents, spends money or changes the installed skill. Use `--config`, `--effort`, `--risk`, `--max-task-usd` and token-shape options to customize one plan. Supply exact versioned model IDs in configuration; available effort levels depend on the runtime. A user-selected model takes precedence over a heuristic pick.

The supplied policy thresholds are tunable conservative heuristics, not measured optimal values: quality floor 0.6, anchored near-tie band 0.08, at least three tasks and ten checked claims for the label `observed`. Evidence is grouped by exact model, role and effort; missing-version/missing-effort historical rows are not transferred. Trial use requires `--allow-trial` and full cheap verification. The source and freshness date of pricing are visible in JSON. A stale snapshot makes cost unknown.

The claim score is `(confirmed + 1)/(confirmed + refuted + 2) - 0.1*rework/tasks`. It describes checked-claim precision, not overall correctness or the rate of missed defects. Empty reviews do not generate confirmed claims. Track `missed` defects found later and representative seeded evaluations alongside precision before changing a risk-heavy route. No evidence quantity alone makes a model “proven”.

Cost estimates use separate uncached input, cache read, five-minute cache write and output token rates per million. Token-shape flags describe one hypothetical request, not a whole job. Haiku 5.5 prompts over 100,000 tokens use the higher tier, including cache tokens. Additional tools, taxes, geography, contracted discounts and retries can change actual spend. Refresh [official pricing](https://platform.claude.com/docs/en/about-claude/pricing) before a financial comparison.

Subscriptions are different from API billing: Claude Code's dollar figure may be a local list-price/API-equivalent estimate, while included plan usage consumes quota. An invoice/console charge is `actual`; JSON list-price usage is `api-equivalent`; hypothetical routing is `estimate`; absent accounting is `unknown`. Do not treat an included subscription call as zero-cost evidence or a minutes-times-guessed-weight calculation as a saving. See [official usage accounting](https://code.claude.com/docs/en/costs).

Choose the least estimated expense inside the declared acceptable quality band only when estimates are comparable. Otherwise use quality evidence and disclose unknown cost. For a real Pareto comparison, measure representative complete tasks for each model/effort: worker spend/time, lead verification, retries, rework, missed defects and acceptance checks. A cheaper worker that causes more lead repair can cost more overall. Do not claim the universal highest quality and lowest price; compare the tested configurations and limits.

## Local outcome file

```json
{"project":"local-project","task":"bilingual shipment wording","model":"claude-haiku-5-5","effort":"medium","role":"review-ui","candidate":"<commit>","verified":true,"evidence":"<local report and lead checks>","confirmed":3,"refuted":0,"rework":0,"missed":0,"minutes":0.4,"verificationMinutes":1,"cost":{"basis":"api-equivalent","workerUsd":0.02,"source":"CLI modelUsage costBasis:list"},"note":"A wording-only trial; no layout or overall quality conclusion."}
```

Those example numbers are synthetic schema illustration, not measured job results. Save it locally, then `node <skill-dir>/scripts/pair.mjs log --file <outcome.json>`. The local ledger is ignored and never silently uploaded. Record harness/tool/auth failures in notes without inventing refuted model claims. A no-finding pass records zero claims and its executed checks, not one manufactured success.

## Judgment after each invocation

Write one short retrospective in the project handoff or local evidence: observed outcome, total verification/rework, the narrow proposed improvement, supporting artifact and an expiry/recheck condition. Include “no change justified” when appropriate. Failure paths should improve the packet or capability probe before increasing model effort or fan-out.

Before promoting an improvement: anonymize sensitive data, compare a baseline and candidate on representative fixtures, obtain an independent forward test with only the request and raw artifacts, and review the diff. A tiny sample stays provisional. Keep confirmed scope-specific findings separate from universal workflow instructions. Retire rules contradicted by later evidence; do not accumulate one absolute rule per error.
