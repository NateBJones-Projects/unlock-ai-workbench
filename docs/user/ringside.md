# Ringside

Ringside is Unlock AI Workbench's live view of agent and workflow execution.
It appears in the right side of a thread and follows that thread automatically.

When one thread starts a six-agent Ringer run and another starts a twelve-agent
run, each thread shows only its own work. If a thread starts several runs, each
run appears as a separate collapsible card in the same Ringside panel.

Each run shows:

- current state and elapsed time;
- worker names, engines, models, attempts, and token usage;
- whether each worker is running, verifying, completed, failed, or stopped;
- the executed verification result;
- produced deliverables and result artifacts; and
- a bounded live log when you explicitly open a worker.

Native subagents started directly by Claude Code or Codex can appear alongside
Ringer runs under a separate label.

## Starting a run

Choose **Ringer Readiness Check** from Quick Actions. Workbench creates the run
for the current thread and opens Ringside. The diagnostic is deterministic,
makes zero provider/model calls, and can continue after the initiating agent
turn has finished.

V1's three subscriber workflows still prepare editable, human-gated prompts for
the selected provider. They are not Ringer templates yet. A workflow will move
to Ringer only after its dependency graph, verification, and human gates have
been reviewed explicitly.

Agents can also use Workbench's scoped diagnostic, status, and control tools.
Those tools are bound to the current thread and cannot inspect or control a
different thread's runs.

## Stopping work

**Stop run** stops the exact selected Ringer run and its worker processes. It
does not stop another run in the thread or a run owned by another thread.

Pause, resume, gates, and retry-one-worker are not available in this V1. They
will appear only for a reviewed template whose installed runtime advertises the
operation.

## Local and remote use

Ringside data travels through the same Workbench server connection as the rest
of the thread. A phone or remote browser does not connect to
`127.0.0.1:8700`. The standalone Ringer browser dashboard remains available for
local diagnostics.
