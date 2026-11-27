import { clerkMiddleware } from "@clerk/nextjs/server";

// Preserve Clerk's session middleware without forcing server-side dashboard
// redirects; the application and its APIs handle signed-in state themselves.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Inngest authenticates this endpoint with its own signed requests. Keep
    // Clerk's auth/session middleware out of its streaming PUT sync requests.
    "/((?!_next|api/inngest(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
