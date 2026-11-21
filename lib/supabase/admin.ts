import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function studioDatabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The studio database is not configured.");
  const session=await auth().catch(()=>null);
  return createClient<Database>(url,key,{
    // Clerk's native Supabase integration adds the authenticated role claim
    // to the standard session token. Use that token instead of the deprecated
    // per-request JWT template.
    accessToken:()=>session?.userId ? session.getToken().catch(()=>null) : Promise.resolve(null),
    auth:{persistSession:false,autoRefreshToken:false},
  });
}
