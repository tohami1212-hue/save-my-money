"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, households, householdMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function login(formData: FormData): Promise<void> {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
    }
    throw error; // re-throw redirect errors
  }
}

export async function register(formData: FormData): Promise<void> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  const householdName = formData.get("householdName") as string;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    redirect(`/register?error=${encodeURIComponent("Email already registered")}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name: householdName || `${displayName}'s Household` })
      .returning();

    await tx.insert(users).values({
      email,
      displayName,
      passwordHash,
      householdId: household.id,
    });

    const [newUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    await tx.insert(householdMembers).values({
      householdId: household.id,
      userId: newUser.id,
      role: "owner",
    });
  });

  // Auto sign-in after registration
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // redirect throws — rethrow it
    throw error;
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
  revalidatePath("/", "layout");
}
