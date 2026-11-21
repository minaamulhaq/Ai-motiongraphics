import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { workerDatabase } from "@/lib/supabase/worker";

function planCredits(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(process.env.CLERK_PLAN_CREDITS || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([slug, value]) => Number.isInteger(value) && Number(value) > 0 ? [[slug, Number(value)]] : []));
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Invalid Clerk webhook signature:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "subscriptionItem.active" && event.type !== "subscriptionItem.updated") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const item = event.data;
  const userId = item.payer?.user_id;
  const slug = item.plan?.slug;
  if (!userId || !slug || item.plan?.is_default) return NextResponse.json({ received: true, ignored: true });

  const credits = planCredits()[slug];
  if (!credits) {
    console.warn(`No app-credit mapping configured for Clerk plan ${slug}.`);
    return NextResponse.json({ received: true, ignored: true });
  }

  const periodStart = new Date(item.period_start).toISOString();
  const sourceKey = `clerk:${item.id}:${item.period_start}`;
  const { error } = await workerDatabase().rpc("grant_subscription_credits", {
    target_user: userId,
    source_key_value: sourceKey,
    plan_slug_value: slug,
    credit_amount: credits,
    billing_period_start: periodStart,
  });
  if (error) {
    console.error("Could not grant subscription credits:", error);
    return NextResponse.json({ error: "Credit grant failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
