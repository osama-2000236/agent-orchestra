# Contributing

Thank you for your interest. Agent Orchestra is small on purpose. Changes that make the skill simpler or more
accurate are welcome. Changes that add machinery are less likely to be accepted.

## Before you open a pull request

1. For anything larger than a typo or a broken link, open an issue first. Describe the problem and the evidence for it.
2. Keep the skill project-agnostic. Do not add a real project's names, ids, paths, people or money figures to
   `skill/`, `examples/` or `docs/`. The ledger in `skill/data/ledger.example.jsonl` is anonymized, and it stays that way.
3. Do not commit a real ledger, a signing key, a token or any other secret.
4. Keep the prose short. Say what the skill does and how to use it.

## Checks

Run these from the repository root before you open the pull request:

```bash
node --test                                # unit tests: routing, ledger, lessons, usage, registry, bench
node scripts/sync-review-agent.mjs         # after editing shared skill resources
node skill/scripts/orchestra.mjs stats     # must identify historical/example evidence honestly
node --check skill/scripts/orchestra.mjs   # syntax check
```

The files in `examples/` are workflow sketches. Their top-level `return`/`await` and exported metadata require a runner. The distribution test converts only the metadata export and compiles each async body without executing it. No native-agent or live runner compatibility is implied; run an adapted sketch in your actual runner before relying on it.

Also check by hand:

- every relative link in the Markdown files resolves;
- every `mermaid` block renders on GitHub;
- the SVG files still open in a browser.

New routing defaults need versioned model/effort evidence, cost basis, full verification/rework cost and a representative evaluation. Do not label three claims proof or transfer an old alias's quality to a new model. Runtime failures and absent visual/hardware evidence must stay visible. Keep ledgers private; publish only deliberately anonymized summaries.

## Pull request

- Say what changed and why, and paste the output of the checks you ran.
- One change per pull request.

## Conduct

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
