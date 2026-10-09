# Contributing

Thank you for your interest. Model Orchestra is small on purpose. Changes that make the skill simpler or more
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
node skill/scripts/pair.mjs stats        # must print the example table without errors
node --check skill/scripts/pair.mjs      # syntax check
```

The files in `examples/` are workflow bodies. They use top-level `return` and `await`, and a workflow runner supplies
their globals (`agent`, `pipeline`, `parallel`, `phase`, `log`, `args`). Plain `node --check` rejects them. To check
their syntax, wrap each body in an async function in a temporary `.mjs` copy and run `node --check` on the copy. Then
run them in your workflow runner.

Also check by hand:

- every relative link in the Markdown files resolves;
- every `mermaid` block renders on GitHub;
- the SVG files still open in a browser.

## Pull request

- Say what changed and why, and paste the output of the checks you ran.
- One change per pull request.

## Conduct

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
