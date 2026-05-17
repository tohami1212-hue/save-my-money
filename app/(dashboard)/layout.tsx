import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const profile = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
