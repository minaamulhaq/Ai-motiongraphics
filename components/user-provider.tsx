"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export interface StudioUser {
  id: string;
  email: string;
  full_name: string;
  credit: number;
  created_at?: string;
  updated_at?: string;
}

interface UserContextType {
  dbUser: StudioUser | null;
  isNewUser: boolean;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  dbUser: null,
  isNewUser: false,
  isLoading: true,
  refetchUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, user, isLoaded } = useUser();
  const userId = user?.id;
  const [dbUser, setDbUser] = useState<StudioUser | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncAndFetchUser = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setDbUser(null);
      setIsNewUser(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/sync-user", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setIsNewUser(Boolean(data.isNewUser));
      } else {
        const detail = await res.json().catch(() => null);
        console.error("Failed to sync user with Supabase", detail?.error || res.status);
      }
    } catch (err) {
      console.error("Error in UserProvider sync:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (isLoaded) {
      syncAndFetchUser();
    }
  }, [isSignedIn, userId, isLoaded, syncAndFetchUser]);

  return (
    <UserContext.Provider
      value={{
        dbUser,
        isNewUser,
        isLoading,
        refetchUser: syncAndFetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useStudioUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useStudioUser must be used within a UserProvider");
  }
  return context;
}
