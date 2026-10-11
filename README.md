# Model Orchestra

[![License: MIT](https://img.shields.io/github/license/osama-2000236/ai-review-orchestra)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/osama-2000236/ai-review-orchestra?style=social)](https://github.com/osama-2000236/ai-review-orchestra/stargazers)

Model Orchestra reviews an application section by section and coordinates AI workers by role, checked evidence and configurable model, effort and budget choices. A lead model verifies findings and fixes; independent reviewers provide another view before the project's release gate.

Use inexpensive workers where their output is easy to verify. Keep high-risk judgment with the lead. Compare complete-task quality and total cost before choosing a default; no model is promised to be always best or cheapest.

## Install

The public repository is **ai-review-orchestra**. The skill name remains **model-orchestra** so existing invocations stay compatible.

```bash
git clone https://github.com/osama-2000236/ai-review-orchestra
mkdir -p ~/.claude/skills/model-orchestra
cp -r ai-review-orchestra/skill/. ~/.claude/skills/model-orchestra/
```

Windows PowerShell:

```powershell
git clone https://github.com/osama-2000236/ai-review-orchestra
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\model-orchestra" | Out-Null
Copy-Item -Recurse -Force ai-review-orchestra\skill\* "$env:USERPROFILE\.claude\skills\model-orchestra"
```

For Codex, copy `skill/` contents to `~/.codex/skills/model-orchestra/`; the optional `review-agent/` distribution keeps read-only diff review as its default and adds explicit whole-app/coordinating modes. Native tool names and model options differ; the skill discovers the actual runtime. It does not assume every host can launch a Claude subagent.

To install the compatible reviewer, create `~/.codex/skills/review-agent/` and copy `review-agent/` contents into it. If your host already supplies a reviewer, locate its real source and preserve a backup before an owner-authorized update; do not create a second conflicting alias blindly.

Invoke `$model-orchestra` in Codex or `/model-orchestra` in Claude Code, or ask for a section-by-section application review using Model Orchestra. Use `$review-agent` in Codex for the compatible reviewer entry. Installation/update copies files; an invocation writes checked outcomes only to your local ledger. Back up custom instructions before upgrading and merge them deliberately.

## A whole-app review covers more than functionality

Map each product section across correctness, security/permissions, compatibility/recovery, reliability, performance, design/accessibility/RTL, maintainability/test quality and release/documentation. Every cell records source inspection, an executed check or a specific limitation. A wording-only review is not a visual audit, and source review is not a real network or installer test.

The process is: map → bounded workers → lead reproduction → defect-first fixes → independent review → final project gate → authorized publication/cleanup. Preserve a live handoff and other sessions' work. Runtime errors are reported while independent sections continue.

## Customize the model, effort and budget

```bash
node skill/scripts/pair.mjs pick review-ui \
  --config skill/data/config.example.json --effort medium --allow-trial --json
```

`pair.mjs` is offline: it plans without making model calls. Refresh the source-dated pricing in your local configuration, mark unsupported models unavailable, and pass token-shape or per-task budget options. Use runtime spend caps for actual calls. The planner keeps high-risk decisions with the lead and can use exact model/effort outcomes from your ignored local ledger.

The example is an ordinary UI trial whose suggestions the lead can check cheaply. Security, permissions or accounting verdicts require `--risk high` and stay with the lead. Copy the config locally, open its cited provider pricing page, update each per-million token rate and `checkedAt`, and review the long-context/cache tiers. The default private ledger is `<installed-skill>/data/ledger.jsonl`; override it with `MODEL_ORCHESTRA_LEDGER` or `--ledger`.

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
