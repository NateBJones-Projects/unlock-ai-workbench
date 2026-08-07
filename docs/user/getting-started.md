# Getting Started: Your First Ten Minutes

This walkthrough takes you from double-click to your first completed workflow and your first Ringer run. Each step says what you should see, and what to do when you don't.

If you have not installed anything yet, start with [Install and first run](./install.md).

## 1. Launch the Workbench

Double-click `START-WORKBENCH.command` in the cloned folder. If macOS asks, allow Terminal to run it (right-click → **Open** the first time).

**You should see:** a Terminal window printing "Step 1/2" (first run only, a few minutes) and then "Step 2/2: Starting Unlock AI Workbench…", followed by the Workbench window with the Home screen. Keep the Terminal window open the whole time you use the app.

**If not:** the launcher prints exactly what is missing and the command that fixes it — paste that command into Terminal, then double-click the launcher again. If macOS refuses to open the file at all, use the right-click → **Open** approval described in [Install and first run](./install.md).

## 2. Add Your Folder

The Workbench works inside a project folder — that is where skills read and write files.

1. Create a folder for your Workbench work. A good default: open Finder, go to **Documents**, and make a new folder called **Unlock Workbench** (so the path is `~/Documents/Unlock Workbench`).
2. On the Workbench Home screen, add that folder as a project.

**You should see:** your folder listed on Home, and the readiness view move one step closer to green.

**If not:** make sure you picked a normal folder you own (Documents, Desktop, or your home folder all work). Avoid folders inside cloud-managed paths that ask for special permissions on every access.

## 3. Confirm a Provider

The Workbench does its AI work through a provider CLI you already have — Claude Code or Codex — using your existing subscription.

**You should see:** at least one provider showing as ready on Home. Existing Claude Code, Codex, Cursor, Grok Build, and OpenCode logins are detected automatically.

**If not:**

- Never installed one? Run `npm install -g @anthropic-ai/claude-code` then `claude auth login` (or `npm install -g @openai/codex` then `codex login`) in Terminal, then check Home again.
- Works in Terminal but the app says it is missing? The app sees a different `PATH` than your Terminal. Open **Settings**, choose the provider instance, and set **Binary path** to the result of `which claude` or `which codex`.

## 4. Run The Research Engine

Time for a real workflow. **The Research Engine** turns messy documents into a stress-tested research report — and it is a good first run because you review everything before it happens.

1. From Home or **Workflows**, choose **The Research Engine**.
2. State your research question in a sentence and attach a file — any PDF, notes document, or meeting transcript you would like analyzed.
3. The Workbench prepares a prompt in a new thread for your provider. **Read it.** This is the human gate: nothing runs until you approve it.
4. Press **Send**. The agent ingests your file, builds a claim-and-source ledger, challenges its own assumptions, and produces a self-contained HTML report.
5. When it stops for review, read the report and the unresolved questions it names plainly. That stop is deliberate — the workflow ends at your judgment, not at auto-publish.

**You should see:** a new thread with an editable prepared prompt (step 3), visible agent progress after you send, and a finished report plus open questions at the review gate (step 5). All artifacts stay local.

**If not:**

- The send fails immediately with an authentication error? Run the provider's login command from the error message (for example `claude auth login`) in Terminal and send again.
- The prompt looks wrong for your question? Edit it before sending — the prepared prompt is a starting point, not a contract.

## 5. Run the Ringer Readiness Check

Finally, prove the multi-agent machinery works — without spending a single token.

1. In your thread, open **Quick Actions** and choose **Ringer Readiness Check**.
2. The check launches a deterministic diagnostic run that makes zero provider/model calls.

**You should see:** the **Ringside** panel open immediately on the right side of the thread, showing one run with live worker state, then settle as completed with an executed verification result ("proof") and a `diagnostic.md` artifact.

**If not:**

- Ringside reports Ringer **unavailable — Python missing**: install it with `brew install python@3.13`, then quit the Workbench (close the app and its Terminal window) and relaunch. Only Ringer needs Python; everything you did above works without it.
- Ringside reports the Ringer runtime is **not bundled or failed verification**: the launcher printed the fix at startup — `UNLOCK_RINGER_SOURCE=/path/to/ringer pnpm run sync:ringer` — but on a normal subscriber checkout the runtime ships in the repository, so try `git pull` and relaunch first.
- The run starts but never settles: choose **Stop run** in Ringside (it stops only that run), then launch the Readiness Check again.

## Where to Go Next

- Open **Skills** and browse the catalog — ten hardened packs with explicit requirements and verification, plus the full blueprint library.
- [Using Ringside](./ringside.md) explains everything the panel shows during real multi-agent runs.
- [Permission modes](./permission-modes.md) covers how much the Workbench asks before acting.
- [Remote access](./remote-access.md) connects your phone or another computer to this Workbench.
