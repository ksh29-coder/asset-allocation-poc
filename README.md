# asset-allocation-poc

Starting point for building an asset allocation application.

**`BRIEF.md` is the specification.** Read it first — it is the only statement of
what is being asked for. This README covers logistics only.

## Layout

Three independent workspaces, one per model. Each is self-contained: the brief
and the data live inside it, so work from within your folder.

| folder | port range |
|---|---|
| `claude-opus/` | 4100–4109 |
| `inkling/` | 4200–4209 |
| `kimi3/` | 4300–4309 |

The port ranges are disjoint so all three applications can run at the same time
on one machine. Your folder's `BRIEF.md` states the range that applies to you.

## Getting started

```bash
git clone https://github.com/ksh29-coder/asset-allocation-poc.git
cd asset-allocation-poc/<your-folder>
```

Everything beyond the brief and `data/` is yours to create.

## Working with git

You have read access to this repository, not write access. Nothing you do
locally can affect it, so work freely:

- Commit locally on a branch (`git checkout -b <your-name>`) as often as you like.
- To publish your work, fork this repository and push your branch to your fork.
  Pushing a branch straight to this repository will be rejected.
- Never modify anything under `data/` — treat those files as read-only inputs.
