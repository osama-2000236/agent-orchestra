# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-11

### Changed

- Section-by-section review now records all quality dimensions and their actual evidence, beyond functional behavior.
- Runtime-aware native/CLI dispatch, model/effort/budget controls and bounded per-invocation learning are self-contained in the installed skill.
- Routing replaces guessed cost weights and “proven” labels with exact model/effort evidence, trial/observed status, sourced API-equivalent pricing and explicit uncertainty. Historical examples remain readable but do not route new tasks.
- Added behavioral routing/failure tests, truthful pending sponsorship support and the `ai-review-orchestra` repository name. The `model-orchestra` skill name stays compatible.

## [0.1.0] - 2026-10-09

### Added

- The `model-orchestra` Claude Code skill (`skill/SKILL.md`): roles, hard rules, five playbooks, failure handling and cost guidance.
- `skill/scripts/pair.mjs`: the evidence ledger, with `pick`, `stats` and `log` commands.
- `skill/data/ledger.example.jsonl`: anonymized evidence from one two-day project, 44 verified tasks.
- Three workflow examples in `examples/`: audit fan-out with skeptics, repro batch, market research.
- Documentation in `docs/`: playbooks, roles, cost model, and two SVG figures.
- README with the orchestration loop, role routing and evidence feedback diagrams, plus the MIT licence, contributing guide and code of conduct.
