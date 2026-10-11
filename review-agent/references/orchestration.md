
# Subagent Orchestra

You are the **lead**. You own the plan, every irreversible step and the final verdict. Subagents are cheap
eyes and hands: they find, draft and check; you verify. Repo rules (`AGENTS.md`, `CLAUDE.md`) and the
user's explicit choices (a named model, "no subagents") beat everything here.

`PAIR` means `node "<this skill's folder>/scripts/pair.mjs"`. It is offline: it never calls a model.

## 1. Brief (10 seconds)

Run `PAIR brief`. It prints the best verified route per role from your ledger and the active lessons from
earlier jobs. Apply the active lessons; treat trial ones as hints. No ledger yet: use the starting routes (section 3).

## 2. Scope before you fire

- Freeze **Goal** and **Acceptance** (each check names the command that proves it) in a resumable handoff
  file the next agent can finish from. Commit red tests and partial work as you go: a usage limit can stop any
  worker, or you, mid-step.
- Whole-app review: build the section x dimension matrix first ([app-review.md](app-review.md)).
  "All" means correctness, security, compatibility, reliability, performance, design/accessibility/RTL,
  test quality, maintainability and release/docs, each cell marked inspected, exercised or blocked.

## 3. Route each role

Starting routes, used until your ledger has verified rows for the role. "Why" is evidence, not reputation;
see [evidence.md](evidence.md) and the repository's dated evidence notes.

| Role | Model | Effort | Why |
| --- | --- | --- | --- |
| scout, inventory, log triage | haiku | low | cheap and wide; every claim is checked anyway |
| design / UI / wording review (source) | haiku | medium | real UI defects found at a few cents each; one claim in four needed the lead to correct it |
| small UI fix from an exact spec | haiku | medium | cheap; the lead reads the diff and runs the screen test |
| correctness review of a money, stock or permission diff | sonnet | high | narrower and more careful than haiku on callers; still verified |
| pull-request second opinion | another vendor (Codex review, GPT) | default | caught real money bugs that two same-family reviews passed |
| core implementation, root-cause diagnosis, verdicts | lead | high | a wrong answer costs the most |

Customize with `PAIR pick <role> <models...> --config <your config.json>` plus:

- `--preset frugal|balanced|thorough`: frugal = low effort, per-request price, trials allowed (only for
  cheaply checked work); balanced = medium effort, complete-task cost (worker + verification + rework);
  thorough = high effort, quality ranking only.
- `--effort low..max`, `--cost-mode complete-task|worker-request|quality`, `--max-task-usd <n>`, `--risk high`
  (keeps the decision with the lead) and token-shape flags. Explicit flags beat the preset.
- Prices live in `data/config.example.json` with their source and date; a snapshot older than 30 days makes
  cost "unknown", never "cheap". Copy it, refresh it from the cited page, then point `--config` at the copy.

Before building a cascade of models, try the cheap baseline: your strongest model at **low** effort often
beats a weaker model at high effort, and judge cost per finished task, not per request.

Hard rules, whatever the score: money, stock, permissions, security, old-data migration and release verdicts
stay with the lead. One writer per file at a time. Workers never commit, push, merge, publish or touch secrets.

## 4. Fire

- **One message, many agents**: independent workers go out together, in the background, so you keep working.
- **Packet** for each worker: goal; exact files and line ranges (or the search patterns to start from) for a
  large minified file; the rules file and the rule sections that apply; read-only or the paths it may write;
  its tools; what is out of bounds; the output shape
  `severity (BLOCKING|BACKLOG), file:line, quoted code, defect, concrete scenario, fix, reproduced?` capped
  at about 8 findings; and "end with the model you are and what you actually read".
- Reviewers read a **pinned commit** (`git worktree add --detach <dir> <sha>`), never a moving tree.
- Parallel writers get disjoint files or their own worktrees, and pre-assigned test ids.
- A required secret: say "it is present; do not open it". Never copy it into the packet.
- Second vendor: its read-only sandbox, on the pinned commit. On Windows, if a Codex CLI sandbox fails to start
  (`helper_unknown_error`), `-c windows.sandbox="unelevated"` worked before you give the role to someone else.

## 5. Verify

A claim is a lead fact only after you read the cited line, run the test, or watch it fail. Classify every claim:
**confirmed**, **refuted** (wrong, or by design) or **rework** (right idea, you had to fix it). Money, stock and
permission fixes are defect-first: a test that fails for the real defect, then green, then neighbours and old
data. Fix a round's blockers together; at most two review rounds, the second on the fix commit only. Anything
non-blocking goes to a backlog line with its evidence.

## 6. Learn (before you report)

1. One ledger row per worker task, lead-verified:
   `PAIR log --file outcome.json` (fields in [evidence.md](evidence.md): model, effort, role, candidate,
   confirmed, refuted, rework, missed, minutes, cost with its basis). A tool or quota failure is a note, not a
   refuted claim.
2. One lesson, the single thing that most changed total work this time:
   `PAIR lesson --file lesson.json` with `{"id":"kebab-id","rule":"...","scope":"...","evidence":"...","outcome":"support"}`.
   Reuse an existing id to support it again, or `"outcome":"contradict"` when it failed.
   Two supports make it **active** (the brief shows it to every later run); contradictions that catch up retire it.
   "No change justified" is a fine lesson to skip.

The ledger and lessons stay local and private. Promote an active lesson into this file only by a reviewed pull
request with its evidence; never rewrite the installed skill automatically.

## 7. Failures

Report a worker or runtime failure at once and keep the independent work going. Retry once with a corrected
packet; then hand the role to the next route or keep it, and say which model did it. A CLI report can say
`subtype: success` with `is_error: true` (a quota stop): `PAIR inspect --file report.json` catches it. A shared
quota outage says nothing about a model's reasoning. Never report a check that did not run, and never swap a
model the user asked for without saying so.

## 8. Finish

Do what the repo's rules require to finish (merge, push, package, publish, clean up), preserving other sessions'
work and secrets. Report two lists: **verified by the lead** and **reported by workers**, each with how it was
checked, and anything waiting on the user. Confidence comes from the checks you name, not from "100%".
