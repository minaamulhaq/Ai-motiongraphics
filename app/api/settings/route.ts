import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const supabase = await studioDatabase();
    const [account, projectCount, usage, grants] = await Promise.all([
      supabase.from("users").select("credit").eq("id", user.id).single(),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("credit_transactions").select("id,generation_type,credits,balance_after,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("subscription_credit_grants").select("id,plan_slug,credits,balance_after,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    const grantsNotMigrated = grants.error?.code === "PGRST205" || grants.error?.code === "42P01";
    if (grantsNotMigrated) console.warn("Subscription credit history is waiting for the billing migration.");
    const error = account.error || projectCount.error || usage.error || (grantsNotMigrated ? null : grants.error);
    if (error) {
      console.error("Settings query failed:", error);
      return NextResponse.json({ error: "Could not load account settings." }, { status: 503 });
    }

    const activity = [
      ...(usage.data || []).map((row) => ({ id: row.id, kind: "usage" as const, label: row.generation_type === "modification" ? "Video modification" : "Video generation", credits: row.credits, balanceAfter: row.balance_after, createdAt: row.created_at })),
      ...(!grantsNotMigrated && grants.data || []).map((row) => ({ id: row.id, kind: "subscription" as const, label: `${row.plan_slug} plan credits`, credits: row.credits, balanceAfter: row.balance_after, createdAt: row.created_at })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);

    return NextResponse.json({ credit: account.data.credit, projectCount: projectCount.count || 0, activity }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/settings failed:", error);
    return NextResponse.json({ error: "Could not load account settings." }, { status: 503 });
  }
}
