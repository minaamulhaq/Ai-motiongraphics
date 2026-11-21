import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Background jobs have no Clerk cookie. This key stays on the server.
export function workerDatabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key)throw new Error("Background generation requires SUPABASE_SERVICE_ROLE_KEY.");
  return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
