"use client";

import { useEffect, useState } from "react";
import { PricingTable, UserAvatar, UserProfile, useUser } from "@clerk/nextjs";
import { ArrowUpRight, CheckCircle2, Coins, CreditCard, Loader2, LockKeyhole, Sparkles, UserRound } from "lucide-react";

type Activity = {
  id: string;
  kind: "usage" | "subscription";
  label: string;
  credits: number;
  balanceAfter: number;
  createdAt: string;
};
type SettingsData = { credit: number; projectCount: number; activity: Activity[] };
type SettingsSection = "profile" | "security" | "billing";

const clerkBillingEnabled = process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED === "true";
const sectionCopy: Record<SettingsSection, { eyebrow: string; title: string; description: string }> = {
  profile: { eyebrow: "PERSONAL DETAILS", title: "Profile", description: "Manage your identity, email addresses, connected accounts, and profile image." },
  security: { eyebrow: "ACCOUNT PROTECTION", title: "Security", description: "Control your password, active devices, verification methods, and account access." },
  billing: { eyebrow: "CREDITS & SUBSCRIPTION", title: "Billing", description: "Review generation credits, choose a plan, and inspect recent credit activity." },
};

function ClerkAccountPanel({ section }: { section: "profile" | "security" }) {
  return (
    <div className="embedded-clerk-profile">
      <UserProfile
        key={section}
        routing="hash"
        __experimental_startPath={section === "profile" ? "/account" : "/security"}
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full max-w-none shadow-none bg-transparent",
            pageScrollBox: "bg-transparent p-0",
          },
        }}
      />
    </div>
  );
}

function BillingPanel({ data }: { data: SettingsData | null }) {
  return (
    <div className="billing-panel">
      <section className="billing-overview" aria-label="Billing overview">
        <article className="billing-credit-card"><span><Coins size={17} /> Available credits</span>{data ? <strong>{data.credit}</strong> : <Loader2 className="spin" />}<small>Used for new videos and modifications</small></article>
        <article><Sparkles /><span>Generated projects</span><strong>{data?.projectCount ?? "—"}</strong></article>
        <article><CheckCircle2 /><span>Video modification</span><strong>10 credits</strong></article>
      </section>

      <section className="billing-block">
        <div className="billing-block-heading"><div><span>SUBSCRIPTION</span><h3>Choose a credit plan.</h3></div>{clerkBillingEnabled && <span className="billing-secure"><LockKeyhole size={13} /> Secured by Clerk</span>}</div>
        {clerkBillingEnabled ? (
          <div className="pricing-shell"><PricingTable for="user" newSubscriptionRedirectUrl="/dashboard/settings" /></div>
        ) : (
          <div className="billing-unavailable">
            <span><CreditCard size={19} /></span>
            <div>
              <strong>Subscription billing is being configured.</strong>
              <p>Your existing credits and account remain available. Paid plans will appear here after Clerk Billing and the application billing flag are enabled.</p>
              {process.env.NODE_ENV === "development" && <a href="https://dashboard.clerk.com/~/billing/settings" target="_blank" rel="noreferrer">Open Clerk Billing settings <ArrowUpRight size={13} /></a>}
            </div>
          </div>
        )}
      </section>

      <section className="billing-block">
        <div className="billing-block-heading"><div><span>CREDIT HISTORY</span><h3>Recent activity.</h3></div></div>
        {!data ? <div className="activity-empty"><Loader2 className="spin" /> Loading activity…</div> : data.activity.length === 0 ? <div className="activity-empty">No credit activity yet.</div> : (
          <div className="activity-list">
            {data.activity.map((item) => <article key={`${item.kind}-${item.id}`}><div className={`activity-icon ${item.kind}`}><Coins size={15} /></div><div><strong>{item.label}</strong><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</span></div><b className={item.kind === "subscription" ? "positive" : ""}>{item.kind === "subscription" ? "+" : "−"}{item.credits}</b><small>{item.balanceAfter} left</small></article>)}
          </div>
        )}
      </section>
    </div>
  );
}

export function SettingsDashboard() {
  const { user } = useUser();
  const [section, setSection] = useState<SettingsSection>("profile");
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState("");
  const copy = sectionCopy[section];

  useEffect(() => {
    const syncSection = () => { if (window.location.hash === "#billing") setSection("billing"); };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    const controller = new AbortController();
    fetch("/api/settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load settings.");
        setData(result);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Could not load settings.");
      });
    return () => { controller.abort(); window.removeEventListener("hashchange", syncSection); };
  }, []);

  return (
    <main className="settings-page settings-single-route">
      {error && <p className="settings-error" role="alert">{error}</p>}

      <div className="settings-dashboard-shell">
        <aside className="settings-sidebar" aria-label="Settings sections">
          <div className="settings-person">
            <UserAvatar appearance={{ elements: { rootBox: "w-11 h-11", avatarBox: "w-11 h-11" } }} />
            <div><strong>{user?.fullName || user?.firstName || "Your account"}</strong><span>{user?.primaryEmailAddress?.emailAddress}</span></div>
          </div>
          <nav>
            <button className={section === "profile" ? "active" : ""} onClick={() => setSection("profile")}><UserRound size={17} /><span><strong>Profile</strong><small>Personal information</small></span></button>
            <button className={section === "security" ? "active" : ""} onClick={() => setSection("security")}><LockKeyhole size={17} /><span><strong>Security</strong><small>Password and access</small></span></button>
            <button className={section === "billing" ? "active" : ""} onClick={() => setSection("billing")}><CreditCard size={17} /><span><strong>Billing</strong><small>Plans and credits</small></span></button>
          </nav>
          <div className="settings-sidebar-credit"><span><Coins size={14} /> Available credits</span><strong>{data?.credit ?? "—"}</strong></div>
        </aside>

        <section id={section} className="settings-content" aria-live="polite">
          <header className="settings-content-header"><span>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p></header>
          <div className="settings-content-body">
            {section === "billing" ? <BillingPanel data={data} /> : <ClerkAccountPanel section={section} />}
          </div>
        </section>
      </div>
    </main>
  );
}
