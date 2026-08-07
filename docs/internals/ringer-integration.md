# Ringer integration

Unlock AI Workbench treats Ringer as an orchestration service above agent
providers. Ringer is not a provider driver and its browser dashboard is not
embedded in a client.

This separation preserves three properties:

- Ringer can run several provider engines in one verified batch.
- A Ringer run can outlive the conversation provider session that started it.
- Web, desktop, and mobile clients see the same typed, thread-scoped state over
  the existing server connection.

## Ownership

Every Workbench-launched run has an immutable origin:

```text
environment id + thread id + launch id
```

The server persists the approved template id beside that origin. Clients and
provider tools never attach an arbitrary run to an arbitrary thread. The public
Workbench run id is the client identity, Ringer's backend run id stays private,
and `runName` is display text only.

The server exposes only runs attached to the requesting thread. Filesystem
paths, process ids, raw machine-wide run indexes, and unrelated specifications
never cross the client protocol.

## Projection

Ringer state maps into a small provider-independent Workbench projection:

| Ringer state      | Workbench projection          |
| ----------------- | ----------------------------- |
| run               | workflow coordinator          |
| manifest task     | workflow member               |
| queued            | pending                       |
| running           | running                       |
| verifying         | running, activity `Verifying` |
| retrying          | running, incremented attempt  |
| pass              | completed                     |
| fail              | failed                        |
| cancelled or dead | interrupted                   |

The server allocates a public run id and stable member/artifact ids while keeping
Ringer's process-bearing backend id private. Ringside renders those typed Ringer
groups before T3's native-agent monitor; it does not fold them into provider
activity. Ending the primary provider session therefore does not falsely
interrupt an independent Ringer run.

The server fingerprints the fields rendered by clients and publishes only
material transitions. Logs, specifications, check output, proofs, and artifacts
are fetched explicitly when the user opens their detail. The global Ringer
polling feed is never proxied to a client. Workbench reads an exact attached
run-state file and sends a typed thread event.

## Launch and control

Workbench Quick Actions call the server-owned run service. Provider agents can
reach the same service through T3's authenticated MCP session. The MCP
invocation supplies the environment, thread, provider session, and provider
instance; a tool argument cannot override that scope.

The initial control boundary is deliberately narrow:

- start the allowlisted, deterministic readiness diagnostic;
- inspect status for the current thread;
- stop an exact, owned run;
- fetch a bounded task log tail or verification proof; and
- open a sanitized artifact.

The three human-gated Workbench workflows remain editable provider prompts in
V1. They have not been relabeled as parallel Ringer jobs. Pause, resume, gates,
and single-member retry are exposed only when a later reviewed template and
runtime implement those operations. Clients must not display simulated controls.

## Surfaces

The existing thread-scoped Agents surface is presented as **Ringside** in the
Unlock shell. One panel may contain several Ringer run groups plus native
Claude, Codex, Cursor, Grok, or OpenCode subagents. A separate global operations
view may aggregate run summaries, but it does not replace the thread filter.

## Runtime packaging

Development may resolve a Ringer checkout explicitly. Production desktop builds
bundle a pinned runtime snapshot and set `RINGER_NO_SELF_UPDATE=1`; Workbench's
signed updater owns runtime upgrades. The bundled snapshot includes its source
revision, content digest, PolyForm Shield terms, and required Nate Jones Media
notice.

Ringer requires Python 3.12 or newer. Runtime discovery reports an actionable
unavailable state when no compatible interpreter exists instead of launching a
partial run.

The source snapshot lives under `apps/desktop/resources/ringer` and is refreshed
only by `scripts/sync-ringer-runtime.mjs`. `runtime-lock.json` covers every
bundled byte; both the desktop artifact builder and the server's capability
probe verify it before execution. The sync script generates a second copy of
the aggregate digest that is compiled into the desktop application. The host
app passes the packaged directory as `UNLOCK_RINGER_ROOT` and that trusted value
as `UNLOCK_RINGER_EXPECTED_SHA256`; it never asks a client or model to provide
an executable path. A configured root is authoritative and cannot fall through
to a development checkout after a verification failure. A random, persisted
HUD nonce and an exact identity response prevent the server from sending run
credentials to an unrelated process on a reused local port.
