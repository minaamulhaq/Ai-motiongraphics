import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// All studio reads and writes pass through Route Handlers, where refreshed
// session cookies can be written to the outgoing response.
export async function createStudioClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing. See SUPABASE.md.");

  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: entries => {
        for (const { name, value, options } of entries) jar.set(name, value, options);
      },
    },
  });
}
