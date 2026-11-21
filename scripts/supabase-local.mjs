import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cli = require.resolve("supabase/dist/supabase.js");
function run(args) {
  return execFileSync(process.execPath,[cli,...args],{encoding:"utf8",stdio:["ignore","pipe","inherit"]});
}
export function localSettings() {
  const data = JSON.parse(run(["status","--output","json"]));
  if (new URL(data.API_URL).hostname !== "127.0.0.1" && new URL(data.API_URL).hostname !== "localhost") {
    throw new Error("Expected a local Supabase stack.");
  }
  return { url:data.API_URL, key:data.PUBLISHABLE_KEY || data.ANON_KEY, admin:data.SERVICE_ROLE_KEY || data.SECRET_KEY };
}
if (process.argv[2] === "env") {
  const {url,key} = localSettings();
  if (!key) throw new Error("Local publishable key is unavailable.");
  const file=".env.local";
  const existing=existsSync(file)?readFileSync(file,"utf8"):"";
  for (const [name,value] of Object.entries({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key})) {
    const match=existing.match(new RegExp("^"+name+"=(.*)$","m"));
    if(match && match[1].trim()!==value) throw new Error("Existing "+name+" differs. Review .env.local before switching targets.");
  }
  let updated=existing.trimEnd();
  for(const [name,value] of Object.entries({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key})){
    if(!new RegExp("^"+name+"=","m").test(existing)) updated+="\n"+name+"="+value;
  }
  writeFileSync(file,updated.trimStart()+"\n");
  console.log("Local URL and public key configured.");
}
if (process.argv[2] === "types") {
  const target = process.argv[3] === "--linked" ? "--linked" : "--local";
  const types=run(["gen","types","typescript",target,"--schema","public"]);
  if(!types.includes("export type Database") || !types.includes("contact_messages")) throw new Error("The studio schema was missing from the generated types.");
  const path="lib/supabase/database.types.ts";
  writeFileSync(path+".tmp",types);renameSync(path+".tmp",path);
  console.log("Generated client types from the migrated database.");
}
