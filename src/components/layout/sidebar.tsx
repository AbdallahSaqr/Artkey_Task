'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CalendarDays, 
  Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/assignments', label: 'Assignments', icon: ClipboardList },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Sidebar"
      className="
        hidden lg:flex flex-col gap-1
        w-56 shrink-0
        m-3 p-3
        rounded-2xl
        bg-card/60 backdrop-blur-md
        shadow-[0_2px_16px_0_rgba(0,0,0,0.1)]
        border border-border/50
        ring-1 ring-inset ring-foreground/[0.04]
        h-[calc(100vh-3.5rem-1.5rem)]
        sticky top-[calc(3.5rem+0.75rem)]
        overflow-y-auto
      "
    >
      <p className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
        Navigation
      </p>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 group active:scale-[0.98]",
              isActive 
                ? "bg-foreground/[0.06] text-foreground font-medium shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
            )}
          >
            <Icon
              size={15}
              strokeWidth={isActive ? 2.25 : 1.75}
              className={cn(
                "transition-colors shrink-0",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="tracking-tight">{label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
