# Model Orchestra

[![License: MIT](https://img.shields.io/github/license/osama-2000236/ai-review-orchestra)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/osama-2000236/ai-review-orchestra?style=social)](https://github.com/osama-2000236/ai-review-orchestra/stargazers)

Model Orchestra reviews an application section by section and coordinates AI workers by role, checked evidence and configurable model, effort and budget choices. A lead model verifies findings and fixes; independent reviewers provide another view before the project's release gate.

Use inexpensive workers where their output is easy to verify. Keep high-risk judgment with the lead. The goal is good complete-task results at lower measured cost, not a promise that one model is always best or cheapest.

## Install

The public repository is **ai-review-orchestra**. The skill name remains **model-orchestra** so existing invocations stay compatible.

```bash
git clone https://github.com/osama-2000236/ai-review-orchestra
mkdir -p ~/.claude/skills
cp -r ai-review-orchestra/skill ~/.claude/skills/model-orchestra
```

Windows PowerShell:

```powershell
git clone https://github.com/osama-2000236/ai-review-orchestra
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse ai-review-orchestra\skill "$env:USERPROFILE\.claude\skills\model-orchestra"
```

For Codex or another skill-capable host, copy `skill/` into its discoverable skills directory as `model-orchestra`. Native tool names and model options differ; the skill discovers the actual runtime. It does not assume every host can launch a Claude subagent.

Invoke `$model-orchestra` or ask for a section-by-section application review using Model Orchestra. No installed `review-agent` alias was found during this update, so this project does not claim that an existing alias was changed.

## A whole-app review covers more than functionality

Map each product section across correctness, security/permissions, compatibility/recovery, reliability, performance, design/accessibility/RTL, maintainability/test quality and release/documentation. Every cell records source inspection, an executed check or a specific limitation. A wording-only review is not a visual audit, and source review is not a real network or installer test.

The process is: map → bounded workers → lead reproduction → defect-first fixes → independent review → final project gate → authorized publication/cleanup. Preserve a live handoff and other sessions' work. Runtime errors are reported while independent sections continue.

## Customize the model, effort and budget

```bash
node skill/scripts/pair.mjs pick review-ui \
  --config skill/data/config.example.json --effort medium --allow-trial --json
```

`pair.mjs` is offline: it plans without making model calls. Refresh the source-dated pricing in your local configuration, mark unsupported models unavailable, and pass token-shape or per-task budget options. Use runtime spend caps for actual calls. The planner keeps high-risk decisions with the lead and can use exact model/effort outcomes from your ignored local ledger.

- Historical examples do not prove a new model version's quality and are not used for personal routing.
- An unknown cost is not treated as cheap. API-equivalent estimates, subscription quota and actual invoices are distinct.
- The claimed-precision score cannot measure bugs a reviewer missed. Risk-heavy routing needs representative evaluation and lead checks.
- Quality-band and sample-size settings are explicit heuristics. Adjust them from measured complete-task results, including lead verification and rework.

See [cost and evidence controls](docs/cost-model.md), [runtime dispatch](skill/references/dispatch.md), [review coverage](skill/references/app-review.md) and [bounded playbooks](docs/playbooks.md).

## Learn without accumulating rules

Every invocation records checked outcomes and one judgment about what helped or caused rework. No self-reported success, automatic public upload or untested global rewrite counts as learning. Promote a narrow improvement only after a relevant evaluation and independent review; “no change justified” is a valid result.

The [current evidence notes](docs/evidence-2026-10-11.md) distinguish verified job observations from recommendations. The original anonymized ledger is retained as historical data, not a cost benchmark. The previous minutes-times-guessed-weights savings claim has been removed.

## Checks and contribution

```bash
node --test tests/*.test.mjs
node --check skill/scripts/pair.mjs
node skill/scripts/pair.mjs stats
```

Bug reports, representative evaluations and small documented improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). The skill is MIT-licensed.

## Support

GitHub Sponsors is not active for this account yet; sponsorship activation is pending financial onboarding. The repository's funding configuration names the verified owner, but it is not a live payment promise. Until activation, support through bug reports, evaluations and contributions; see [SUPPORT.md](SUPPORT.md).
