"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { UserRound } from "lucide-react";

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Clerk's host element is client-only. Keep the server and first client render identical.
  if (!hydrated) {
    return (
      <span
        aria-hidden="true"
        className="account-menu-placeholder"
        style={{ width: compact ? 32 : 168, height: 36 }}
      >
        <span className="account-menu-placeholder-avatar" />
        {!compact && <span className="account-menu-placeholder-name" />}
      </span>
    );
  }

  return (
    <UserButton
      showName={!compact}
      userProfileMode="navigation"
      userProfileUrl="/settings"
      appearance={{
        elements: {
          avatarBox: "w-8 h-8",
          userButtonOuterIdentifier: "text-sm font-medium text-neutral-200",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link label="Manage account" href="/settings#profile" labelIcon={<UserRound size={15} />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}
