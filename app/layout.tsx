import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { UserProvider } from "@/components/user-provider";
import "./globals.css";
import "./studio.css";
import "./workspace.css";
import "./settings.css";

export const metadata: Metadata = {
  title: "AI Vid — AI Video Generator",
  description: "Describe a scene, shape a motion study, and explore community projects in AI Vid.",
  icons: { icon: "/studio-icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={{ theme: shadcn }}>
          <UserProvider>
            {children}
          </UserProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
