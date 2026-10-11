# Model, effort and cost controls

The maintained instructions and outcome schema are in [skill/references/evidence.md](../skill/references/evidence.md); CLI runtime choices are in [skill/references/dispatch.md](../skill/references/dispatch.md). Keeping these inside the installed skill makes it self-contained.

`pair.mjs pick <role> [exact-model-ids...]` accepts `--config`, `--ledger`, `--effort`, `--risk ordinary|high`, `--cost-mode complete-task|worker-request|quality`, `--allow-trial`, `--max-task-usd`, `--input-tokens`, `--output-tokens`, `--cache-read-tokens`, `--cache-write-tokens` and `--json`. An unspecified token shape is a synthetic 10,000-input/2,000-output request; override it to describe your workload. The budget filters recorded full-task means in complete-task/quality modes and request estimates in worker-request mode; unknown selected cost refuses the route. It does not enforce future whole-job spend. Native/CLI worker caps enforce their own limits.

The example configuration cites [first-party Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) checked on 11 October 2026 and uses five-minute cache-write rates. Hypothetical calculations have basis `estimate` using API-equivalent rates; reported list-price usage has basis `api-equivalent`, and invoices have basis `actual`. The non-Claude model deliberately has no guessed price. A snapshot older than its maxAgeDays stops request-cost ranking until refreshed. Invalid thresholds/expiry values are refused. Additional fees and provider-specific rates are excluded.

The default uses complete-task means only when matching records include comparable worker, verification and rework costs. Missing accounting falls back to quality evidence. The example config explicitly chooses worker-request estimates for a small pilot; JSON says lead costs are excluded. Override it with `--cost-mode complete-task` for observed complete-task data or `quality` to disable price ranking.

`stats` identifies the historical example separately. Unversioned rows with no recorded effort are not used to select a versioned model. `log --file <outcome.json>` requires lead verification, evidence, candidate and effort; it writes your ignored local ledger. It does not automatically edit the skill.

`inspect --file <CLI-report.json>` checks `is_error` independently of subtype and emits an offline attestation/accounting summary. A weekly-limit response that says `subtype:success` is still unusable. Unknown cost stays unknown and quota/runtime failure is not logged as a model reasoning defect. Inspect partial files and denied tools before any acceptance decision.

Behavioral tests cover exact model/effort separation, trial policy, risk responsibility, unavailable models, sourced/unknown/stale prices, long-context pricing, budget refusal and order-independent quality-band ranking. These establish the planner's behavior, not the reasoning quality of a live model.
