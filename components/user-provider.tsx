"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  const syncedUserId = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const syncAndFetchUser = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setDbUser(null);
      setIsNewUser(false);
      setIsLoading(false);
      syncedUserId.current = null;
      return;
    }

    if (syncedUserId.current === userId) return;
    if (inFlight.current) return inFlight.current;

    setIsLoading(true);
    const request = (async () => { try {
      const res = await fetch("/api/auth/sync-user", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setIsNewUser(Boolean(data.isNewUser));
        syncedUserId.current = userId;
      } else {
        const detail = await res.json().catch(() => null);
        console.error("Failed to sync user with Supabase", detail?.error || res.status);
      }
    } catch (err) {
      console.error("Error in UserProvider sync:", err);
    } finally {
      setIsLoading(false);
      inFlight.current = null;
    } })();
    inFlight.current = request;
    return request;
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
