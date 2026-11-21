import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsDashboard } from "@/components/settings-dashboard";

export const instant = false;

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/settings");
  return <SettingsDashboard />;
}
