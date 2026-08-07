import type { ReactNode } from "react";

import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../../workspaceTitlebar";
import { SidebarInset } from "../ui/sidebar";

export function WorkbenchPageShell({
  title,
  description,
  actions,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "workspace-topbar border-b border-border px-3 transition-[padding-left] duration-200 ease-linear motion-reduce:transition-none sm:px-5",
            isElectron && "drag-region",
            COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 wco:pr-[var(--workspace-native-controls-inset)]">
            <span className="truncate text-sm font-medium text-foreground/80">{title}</span>
            {actions ? <div className="no-drag shrink-0">{actions}</div> : null}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
            <div className="mb-7 max-w-3xl border-b border-border pb-5">
              <h1 className="text-2xl font-black tracking-[-0.025em] text-foreground sm:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {children}
          </div>
        </main>
      </div>
    </SidebarInset>
  );
}

export function WorkbenchSection({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
        <h2 className="text-base font-black tracking-[-0.015em] text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
