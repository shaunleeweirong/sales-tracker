"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PieChart,
  Building2,
  Target,
  Upload,
  Users,
  Wallet,
  Layers,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: PieChart },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/explorer", label: "Explorer", icon: Layers },
  { href: "/admin/import", label: "Import Spend", icon: Upload },
  { href: "/admin/import-opportunities", label: "Import Opportunities", icon: Upload },
];

const ADMIN = [
  { href: "/admin/quotas", label: "Quotas", icon: Wallet },
  { href: "/admin/teams", label: "Teams", icon: Users },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon }) => (
        <NavLink key={href} href={href} active={pathname.startsWith(href)}>
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin
          </div>
          {ADMIN.map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href} active={pathname.startsWith(href)}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </>
      )}
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
