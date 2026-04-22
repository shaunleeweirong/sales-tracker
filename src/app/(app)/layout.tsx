import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const displayName = profile?.full_name ?? user.email ?? "Unknown";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-60 shrink-0 border-r bg-background">
        <div className="p-4 border-b">
          <div className="font-semibold">LinkedIn Ads</div>
          <div className="text-xs text-muted-foreground">Sales Tracker</div>
        </div>
        <AppNav isAdmin={isAdmin} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-background px-6 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-medium">{displayName}</span>
              {isAdmin && (
                <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  admin
                </span>
              )}
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
