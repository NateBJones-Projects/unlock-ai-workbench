import { BookOpenIcon, HomeIcon, LibraryBigIcon, WorkflowIcon } from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../ui/sidebar";

const ITEMS = [
  { label: "Home", to: "/", icon: HomeIcon },
  { label: "Workflows", to: "/workflows", icon: WorkflowIcon },
  { label: "Skills", to: "/skills", icon: LibraryBigIcon },
  { label: "Learn", to: "/learn", icon: BookOpenIcon },
] as const;

export function WorkbenchPrimaryNav() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const handleNavigate = useCallback(
    (to: (typeof ITEMS)[number]["to"]) => {
      if (isMobile) setOpenMobile(false);
      void navigate({ to });
    },
    [isMobile, navigate, setOpenMobile],
  );

  return (
    <div className="border-b border-sidebar-border pb-2">
      <p className="px-2 pb-1 text-[9px] font-black tracking-[0.16em] text-sidebar-muted-foreground/65 uppercase">
        Workbench
      </p>
      <SidebarMenu>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton isActive={isActive} onClick={() => handleNavigate(item.to)}>
                <Icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}
