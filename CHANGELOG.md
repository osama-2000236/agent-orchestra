# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-09

### Added

- The `model-orchestra` Claude Code skill (`skill/SKILL.md`): roles, hard rules, five playbooks, failure handling and cost guidance.
- `skill/scripts/pair.mjs`: the evidence ledger, with `pick`, `stats` and `log` commands.
- `skill/data/ledger.example.jsonl`: anonymized evidence from one two-day project, 44 verified tasks.
- Three workflow examples in `examples/`: audit fan-out with skeptics, repro batch, market research.
- Documentation in `docs/`: playbooks, roles, cost model, and two SVG figures.
- README with the orchestration loop, role routing and evidence feedback diagrams, plus the MIT licence, contributing guide and code of conduct.
