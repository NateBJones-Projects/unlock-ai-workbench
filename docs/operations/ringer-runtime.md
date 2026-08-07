# Ringer runtime operations

## Development resolution

Use a Python 3.12+ interpreter and select the canonical Ringer checkout with
`UNLOCK_RINGER_ROOT=/absolute/path/to/ringer`. The directory must contain
`ringer.py`, `engines/mock_worker.py`, and a valid `runtime-lock.json`. When that
variable is absent, the local development service may use its documented bundle
discovery; production never relies on a developer path. An explicitly selected
root is authoritative: if it is missing or fails verification, Workbench reports
Ringer unavailable instead of falling back to another checkout.
Development runs must use an isolated Workbench state directory and must not
point tests at a live user's T3 database.

Ringer's own automatic Git updater is disabled when Workbench launches it:

```text
RINGER_NO_SELF_UPDATE=1
```

## Production resolution

Desktop packaging copies the pinned Ringer runtime into Electron resources. A
runtime lock records the upstream repository, revision, exact selected file
list, per-file hashes and sizes, and aggregate content digest. Packaging fails
when the bundled snapshot does not match the lock. The sync step also generates
the trusted aggregate digest compiled into the desktop application. Packaged
desktop backends provide that digest independently of the bundle, and the
Workbench server repeats both checks before advertising the capability or
launching code, so replacing a runtime file—or the runtime and its lock—fails
closed.

Refresh and verify the reviewed snapshot with:

```text
UNLOCK_RINGER_SOURCE=/absolute/path/to/ringer pnpm run sync:ringer
pnpm run check:ringer
```

The sync step records whether any selected source file was dirty. Review that
field before a release. The product bundle intentionally excludes local,
machine-specific engine wrappers and all Ringer test/evaluation data.

The Workbench application updater, rather than Ringer, distributes later
runtime revisions.

## Diagnostics

Check these conditions in order:

1. A Python 3.12+ executable is available.
2. The resolved `ringer.py` and runtime lock agree.
3. The Workbench server can create its Ringer state and work directories.
4. The selected workflow has a valid manifest and available engine binaries.
5. The run attachment belongs to the current environment and thread.
6. A saved HUD answers the nonce-bound Workbench identity handshake before any
   bearer control token is sent to it.

The attachment store contains private control material and is created and
atomically replaced with owner-only (`0600`) permissions. Every state read
revalidates the environment, thread, launch, backend run id, and immutable
origin. Artifact reads resolve canonical paths and stay inside roots belonging
to that attached run; sibling-run and symlink escapes are rejected.

The normal client protocol returns sanitized error codes and user-facing
messages. Absolute paths, process ids, ownership tokens, and unrelated run state
stay in server logs.

Workbench launches the V1 diagnostic with a minimal environment. Ringer removes
its ownership token, origin handoff, run-id handoff, HUD nonce, and known
Workbench server secrets before spawning either a worker or a verification
check. A later provider-backed template must add only the provider credentials
it actually needs; it must not fall back to inheriting the whole server
environment.

## Cancellation

The server and Ringer registry record the exact run id, origin, ownership-token
hash, pid, start timestamp, and OS process-birth marker. Cancellation signals
only an exact match. Never find a Ringer process by matching its command line or
workspace path. After cancellation, the final run projection must settle and
remain inspectable.

## Licensing

Distributed builds retain the T3 Code MIT license, the Ringer/Ringside PolyForm
Shield terms and required notice, and the separate Nate Jones Media product
authorization in the repository root.
