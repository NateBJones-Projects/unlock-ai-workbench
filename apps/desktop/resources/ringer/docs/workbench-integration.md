# Workbench integration contract

Ringer supports an opt-in, exact-run loopback contract for Unlock AI Workbench.
Ordinary manifests and the existing Ringside UI remain compatible.

## Launch metadata

A Workbench launch supplies this top-level manifest object, or the same JSON with
`--origin-json` / `RINGER_ORIGIN_JSON`:

```json
{
  "origin": {
    "client": "unlock-ai-workbench",
    "surface": "t3-code",
    "environment_id": "environment-id",
    "thread_id": "thread-id",
    "turn_id": "optional-turn-id",
    "launch_id": "unique-launch-id"
  }
}
```

Set a high-entropy ownership token with `RINGER_CONTROL_TOKEN`. The
`--control-token` flag exists for manual use, but environment delivery avoids
exposing the token in the process list. The raw token is never written to disk;
run state and the active registry contain only its SHA-256 digest.

Use a unique `--run-id-file` (or `RINGER_RUN_ID_FILE`) for attachment. Ringer
atomically writes JSON containing `run_id`, `run_name`, `created_at`, and
`origin` immediately after registration. It also emits `RINGER_RUN_ID=<run_id>`
on stdout.

```sh
RINGER_CONTROL_TOKEN="$TOKEN" \
python3 /path/to/ringer.py run /path/to/ringer.json \
  --origin-json @/path/to/origin.json \
  --run-id-file /path/to/private/launch.json \
  --no-dashboard
```

Run one persistent loopback server against the same configuration/state
directory:

```sh
python3 /path/to/ringer.py hud --port 8700 --no-open
```

## Scoped loopback API

Every request supplies:

- `Authorization: Bearer <ownership token>`
- `X-Ringer-Client: unlock-ai-workbench`
- `X-Ringer-Environment-Id: <environment id>`
- `X-Ringer-Thread-Id: <thread id>`

Routes are exact-run and return `Cache-Control: no-store`:

- `GET /api/scoped/runs/<run_id>` — safe run/task summary, revision, links, and
  capability flags.
- `POST /api/scoped/runs/<run_id>/cancel` — request cancellation after matching
  run id, origin, token digest, pid, run start time, and OS process birth marker.
- `GET /api/scoped/runs/<run_id>/tasks/<task>/log` — bounded worker-log tail.
- `GET /api/scoped/runs/<run_id>/tasks/<task>/proof` — executed-check proof.
- `GET /api/scoped/runs/<run_id>/tasks/<task>/artifacts` — advertised artifact
  names and exact URLs.
- `GET /api/scoped/runs/<run_id>/tasks/<task>/artifacts/<name>` — one advertised
  task artifact.
- `GET /api/scoped/runs/<run_id>/artifact?kind=live|report` — exact-run HTML.

Run states are `live` and `finished`. Task states are `queued`, `running`,
`retrying`, `verifying`, `pass`, and `fail`; verdicts are empty until known, then
`PASS`, `FAIL`, `ERROR`, or `TIMEOUT`. Cancellation is supported. Retry and gate
controls are explicitly unsupported in this contract.

## Artifact identity and compatibility

`run_id` is the canonical identity for run state, live pages, version pages, and
the `library.json` `runs` map. `library.json` also retains the `artifacts` map
grouped by display `run_name`, including bounded version history, for existing
Ringside consumers. Concurrent runs with the same display name therefore keep
distinct live pages and canonical library entries.

For a no-spend readiness action, configure the existing deterministic
`engines/mock_worker.py` fixture as a custom engine, have it write a declared
file from a `MOCK_FILE` block, and verify that file with an executed shell check.
This exercises launch, state, proof, artifact, and completion behavior without a
model call or changes to normal engine routing.
