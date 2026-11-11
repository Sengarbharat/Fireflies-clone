"use client";

import {
  BarChart3,
  CheckSquare,
  Home,
  LayoutGrid,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { Logo } from "@/components/ui/misc";

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/uploads", label: "Uploads", icon: Upload },
  { href: "/tasks", label: "Action items", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: LayoutGrid },
  { href: "/team", label: "Team", icon: Users },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const item = (href: string, label: string, Icon: typeof Home, active: boolean) => (
    <Link
      key={href}
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          : "text-muted hover:bg-black/[0.04] hover:text-[var(--text)] dark:hover:bg-white/5",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-600 dark:text-brand-300" : "")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <Logo className="h-7 w-7 shrink-0" />
        {!collapsed && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-tight">Fireflies</span>
            <span className="rounded bg-black/5 px-1 text-[10px] font-medium text-muted dark:bg-white/10">clone</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin">
        {NAV.map((n) => item(n.href, n.label, n.icon, isActive(n.href, n.exact)))}
      </nav>

      <div className="space-y-2 px-3 pb-3">
        {!collapsed && (
          <div className="rounded-xl bg-gradient-to-br from-brand-50 to-pink-50 p-3 dark:from-brand-500/10 dark:to-pink-500/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <Zap className="h-3.5 w-3.5" /> Pro workspace
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted">Unlimited transcripts, AI notes and storage.</p>
          </div>
        )}
        {item("/settings", "Settings", Settings, isActive("/settings"))}
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-black/[0.04] dark:hover:bg-white/5",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
