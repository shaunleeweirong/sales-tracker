import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  full_name: string | null;
  role: "rep" | "admin";
};

export async function getUserAndProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const profile: Profile = data
    ? {
        id: data.id,
        full_name: data.full_name,
        role: (data.role === "admin" ? "admin" : "rep") as "rep" | "admin",
      }
    : {
        id: user.id,
        full_name: user.email ?? null,
        role: "rep",
      };

  return { userId: user.id, email: user.email ?? null, profile };
}

export async function requireAdmin() {
  const { profile } = await getUserAndProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
