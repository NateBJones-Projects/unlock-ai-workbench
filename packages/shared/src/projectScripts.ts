import type { EnvironmentId, ProjectId, ProjectScript, ThreadId } from "@t3tools/contracts";

export interface ProjectScriptActionContext {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  projectId: ProjectId;
  actionId: ProjectScript["id"];
}

interface ProjectScriptRuntimeEnvInput {
  project: {
    cwd: string;
  };
  worktreePath?: string | null;
  actionContext?: ProjectScriptActionContext;
  extraEnv?: Record<string, string>;
}

export function projectScriptCwd(input: {
  project: {
    cwd: string;
  };
  worktreePath?: string | null;
}): string {
  return input.worktreePath ?? input.project.cwd;
}

export function projectScriptRuntimeEnv(
  input: ProjectScriptRuntimeEnvInput,
): Record<string, string> {
  const env: Record<string, string> = {
    T3CODE_PROJECT_ROOT: input.project.cwd,
  };
  if (input.worktreePath) {
    env.T3CODE_WORKTREE_PATH = input.worktreePath;
  }
  if (input.actionContext) {
    env.T3CODE_ENVIRONMENT_ID = input.actionContext.environmentId;
    env.T3CODE_THREAD_ID = input.actionContext.threadId;
    env.T3CODE_PROJECT_ID = input.actionContext.projectId;
    env.T3CODE_ACTION_ID = input.actionContext.actionId;
    env.T3CODE_ACTION_SOURCE = "workbench";
  }
  if (input.extraEnv) {
    return { ...env, ...input.extraEnv };
  }
  return env;
}

export function setupProjectScript(scripts: readonly ProjectScript[]): ProjectScript | null {
  return scripts.find((script) => script.runOnWorktreeCreate) ?? null;
}
