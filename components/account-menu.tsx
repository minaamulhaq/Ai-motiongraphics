"use client";

import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { UserRound } from "lucide-react";

export function AccountMenu({ compact = false, avatarUrl, userName, loading = false }: { compact?: boolean; avatarUrl?: string; userName?: string; loading?: boolean }) {
  const { user, isLoaded } = useUser();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Clerk's host element is client-only. Keep the server and first client render identical.
  const resolvedAvatar = avatarUrl ?? user?.imageUrl;
  const resolvedName = userName ?? user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress;
  if (!hydrated || loading || !isLoaded) {
    return (
      <span
        aria-hidden="true"
        className="account-menu-placeholder"
        style={{ width: compact ? 32 : 168, height: 36 }}
      >
        {resolvedAvatar ? <img className="dash-user-avatar" src={resolvedAvatar} alt={resolvedName ? `${resolvedName} avatar` : "User avatar"} /> : <span className="account-menu-placeholder-avatar" />}
        {!compact && <span className="account-menu-placeholder-name" />}
      </span>
    );
  }

  return (
    <UserButton
      showName={!compact}
      userProfileMode="navigation"
      userProfileUrl="/dashboard/settings"
      appearance={{
        elements: {
          avatarBox: "w-8 h-8",
          userButtonOuterIdentifier: "text-sm font-medium text-neutral-200",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link label="Manage account" href="/dashboard/settings#profile" labelIcon={<UserRound size={15} />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}
