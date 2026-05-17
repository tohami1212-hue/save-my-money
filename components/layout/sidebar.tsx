"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Tag,
  RefreshCw,
  Lightbulb,
  Sparkles,
  Settings,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth";
import type { users } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type User = InferSelectModel<typeof users>;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/savings", label: "Savings", icon: Lightbulb },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/ai-summary", label: "AI Summary", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: { user: User | null | undefined }) {
  const pathname = usePathname();
  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-background shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b">
        <span className="font-semibold text-base tracking-tight">
          Save My Money
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <span
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </span>
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t flex items-center gap-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {user?.displayName ?? "You"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <form action={logout}>
          <Button variant="ghost" size="icon" type="submit" className="h-7 w-7">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
