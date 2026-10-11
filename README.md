# Subagent Orchestra

[![License: MIT](https://img.shields.io/github/license/osama-2000236/subagent-orchestra)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/osama-2000236/subagent-orchestra?style=social)](https://github.com/osama-2000236/subagent-orchestra/stargazers)

![Subagent Orchestra: fire subagents on the model that has earned the job](docs/assets/banner.svg)

Fire subagents on the cheapest model that is proven for each job. The lead verifies every claim, and the skill gets sharper every run from a local evidence ledger.

## Why

- **Cheaper workers.** Scouting, UI review and small fixes go to cheaper models. At list price, Haiku 5.5 is $0.10 input and $0.50 output per million tokens, against $4 and $20 for Opus 5.5 ([pricing page](https://platform.claude.com/docs/en/about-claude/pricing)).
- **Checked output.** The lead reads the cited line, runs the test or watches it fail before a worker's claim counts. Money, stock, permission, security and release verdicts stay with the lead, even when a worker reviewed the diff.
- **Learns from its own runs.** Each job logs verified outcomes to a local ledger. A lesson becomes active after two supporting jobs, and it is retired once contradictions catch up with its support.
- **Works with Claude Code subagents and a second vendor.** Claude Code subagents do the work. For a pull request, a second vendor (Codex or GPT) gives an independent read-only review of a pinned commit.

If this saves you review time or model spend, a star helps other people find it.

## Install

Claude Code, bash:

```bash
git clone https://github.com/osama-2000236/subagent-orchestra
mkdir -p ~/.claude/skills/subagent-orchestra
cp -r subagent-orchestra/skill/. ~/.claude/skills/subagent-orchestra/
```

Claude Code, Windows PowerShell:

```powershell
git clone https://github.com/osama-2000236/subagent-orchestra
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\subagent-orchestra" | Out-Null
Copy-Item -Recurse -Force subagent-orchestra\skill\* "$env:USERPROFILE\.claude\skills\subagent-orchestra"
```

For Codex, copy `skill/` contents to `~/.codex/skills/subagent-orchestra/`. The optional `review-agent/` distribution keeps read-only diff review as its default and adds explicit whole-app/coordinating modes. Native tool names and model options differ; the skill discovers the actual runtime. It does not assume every host can launch a Claude subagent.

To install the compatible reviewer, create `~/.codex/skills/review-agent/` and copy `review-agent/` contents into it. If your host already supplies a reviewer, locate its real source and preserve a backup before an owner-authorized update; do not create a second conflicting alias blindly.

Invoke `/subagent-orchestra` in Claude Code or `$subagent-orchestra` in Codex, or ask for a section-by-section application review. Use `$review-agent` in Codex for the compatible reviewer entry. Installation copies files; an invocation writes checked outcomes only to your local ledger (`data/ledger.jsonl` in the installed folder). Back up custom instructions before upgrading and merge them deliberately.

Upgrading from model-orchestra: copy your old skill's `data/ledger.jsonl` into the new folder's `data/` and delete the old folder.

## Quick start

Run these from the repository root. After installing, the same files live in `~/.claude/skills/subagent-orchestra/` (`scripts/pair.mjs`, `data/config.example.json`).

```bash
node skill/scripts/pair.mjs brief
node skill/scripts/pair.mjs pick review-ui claude-haiku-5-5 claude-sonnet-5-5 --config skill/data/config.example.json --preset frugal
node skill/scripts/pair.mjs log --file outcome.json
node skill/scripts/pair.mjs lesson --file lesson.json
```

- `brief` prints the best verified route per role from your ledger, and the active lessons. With no ledger yet, every role starts as a trial.
- `pick` plans a route for a role and estimates its cost offline. It never calls a model.
- `log` records one lead-verified row per worker task. The fields are in [evidence.md](skill/references/evidence.md).
- `lesson` records the one thing that most changed total work this time, for example
  `{"id":"pin-reviewer-commit","rule":"reviewers read a pinned commit","scope":"review","evidence":"<what you checked>","outcome":"support"}`.
  Use `"outcome":"contradict"` when a lesson failed.

### Presets

| Preset | Effort | Ranks routes by |
| --- | --- | --- |
| `frugal` | low | per-request price |
| `balanced` | medium | complete-task cost (worker + verification + rework) |
| `thorough` | high | quality ranking only |

`frugal` also allows trial routes, only for cheaply checked work.

Other knobs:

- `--effort low|medium|high|xhigh|max`. Explicit flags beat the preset.
- `--cost-mode complete-task|worker-request|quality`.
- `--max-task-usd <n>`: a route whose cost is unknown or above this per-task budget is not picked.
- `--risk high`: the decision stays with the lead, and independent reviewers count as evidence only.

Prices live in `data/config.example.json` with their source and date. A snapshot older than 30 days makes the cost "unknown", never "cheap". Copy the file, refresh it from the cited page, and point `--config` at the copy.

## Honest limits

- The planner is a heuristic. Its quality bands and sample sizes are settings to adjust from your own complete-task results.
- An unknown cost is not a cheap cost. API-equivalent estimates, subscription quota and actual invoices are different numbers; the planner's figures are API-equivalent estimates.
- The claimed-precision score cannot measure bugs a reviewer missed. Risky routing needs a representative evaluation and lead checks.
- No model is promised to be always the best or always the cheapest. The evidence notes ([0.3.0](docs/evidence-2026-10-11-subagents.md), [0.2.0](docs/evidence-2026-10-11.md)) separate verified observations from recommendations.

More detail: [cost and evidence controls](docs/cost-model.md), [runtime dispatch](skill/references/dispatch.md), [review coverage](skill/references/app-review.md) and [bounded playbooks](docs/playbooks.md).

## Checks and contribution

```bash
node --test tests/*.test.mjs
node --check skill/scripts/pair.mjs
node skill/scripts/pair.mjs stats
```

Bug reports, representative evaluations and small documented improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). The skill is MIT-licensed.

## Support

GitHub Sponsors is not active for this account yet; sponsorship activation is pending financial onboarding. The repository's funding configuration names the verified owner, but it is not a live payment promise. Until activation, support the project through bug reports, evaluations and contributions; see [SUPPORT.md](SUPPORT.md).
