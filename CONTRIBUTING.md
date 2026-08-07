# Contributing

Unlock AI Workbench is a private alpha for subscribers of Nate B. Jones's newsletter. Access to this repository is by invitation; there is no public issue tracker or PR queue yet.

## Reporting a Problem

Report problems through the same subscriber channel where you received access to this repository. The most useful reports include:

- what you clicked or ran, and what you expected;
- what actually happened, including any messages in the Terminal window that `START-WORKBENCH.command` opened;
- your macOS version and, if relevant, the provider you were using (Claude Code, Codex, ...).

Everything gets read. This is an alpha run by a small team, so fixes are prioritized by how badly something blocks real use.

## Development

The Workbench is a fork of the open-source [T3 Code](https://github.com/pingdotgg/t3code) agent harness with a Nate Jones Media product layer on top. If you are set up to work on the code:

- Development setup and upstream tooling: [docs/internals/upstream-t3.md](./docs/internals/upstream-t3.md)
- Architecture: [docs/internals/overview.md](./docs/internals/overview.md)
- Agent rules for this repository: [AGENTS.md](./AGENTS.md)

Changes that belong to the upstream harness rather than the Workbench product layer should be proposed upstream, not here.
