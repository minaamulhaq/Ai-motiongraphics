import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function studioDatabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The studio database is not configured.");
  return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
