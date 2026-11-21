import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";

const getSupabase = studioDatabase;

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress || "";
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Creator";
    const supabase = await getSupabase();

    // 1. Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id, email, full_name, credit, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching user from Supabase:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existingUser) {
      // Existing user
      return NextResponse.json({
        isNewUser: false,
        user: existingUser,
      });
    }

    // 2. New user: Insert into public.users with 100 default credits
    const newUserRecord = {
      id: user.id,
      email,
      full_name: fullName,
      credit: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert(newUserRecord)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting user into Supabase:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      isNewUser: true,
      user: insertedUser,
    });
  } catch (err) {
    console.error("User sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const supabase = await getSupabase();
    const { data: dbUser } = await supabase
      .from("users")
      .select("id, email, full_name, credit, created_at")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: dbUser || {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        full_name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Creator",
        credit: 100,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
