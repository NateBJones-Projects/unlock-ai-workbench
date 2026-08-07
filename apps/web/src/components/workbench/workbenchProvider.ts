import type { ProviderInstanceId, ServerProvider } from "@t3tools/contracts";

/**
 * Resolve the provider whose native capabilities will actually be used by a
 * prepared Workbench thread. Exact instance identity matters: aggregating
 * skills across providers can incorrectly claim that Claude can use a skill
 * installed only for Codex (or vice versa).
 */
export function resolveWorkbenchProvider(
  providers: ReadonlyArray<ServerProvider>,
  preferredInstanceId: ProviderInstanceId | null | undefined,
): ServerProvider | null {
  if (preferredInstanceId) {
    const exact = providers.find((provider) => provider.instanceId === preferredInstanceId);
    if (exact) return exact;
  }
  return (
    providers.find(
      (provider) =>
        provider.enabled &&
        provider.installed &&
        provider.status === "ready" &&
        provider.availability !== "unavailable",
    ) ??
    providers.find(
      (provider) =>
        provider.enabled && provider.installed && provider.availability !== "unavailable",
    ) ??
    null
  );
}

export function detectedWorkbenchSkillNames(provider: ServerProvider | null): ReadonlySet<string> {
  return new Set(
    (provider?.skills ?? []).filter((skill) => skill.enabled).map((skill) => skill.name),
  );
}
