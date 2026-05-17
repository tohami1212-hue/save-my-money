import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { monthlySnapshots, insights } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { DashboardSummary } from "@/components/dashboard/summary";
import { InsightCards } from "@/components/dashboard/insight-cards";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const householdId = session.user.householdId;
  if (!householdId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Setting up your household...</p>
      </div>
    );
  }

  const [snapshot] = await db
    .select()
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.householdId, householdId))
    .orderBy(desc(monthlySnapshots.month))
    .limit(1);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const activeInsights = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.householdId, householdId),
        eq(insights.isDismissed, false),
        gte(insights.createdAt, sixtyDaysAgo)
      )
    )
    .orderBy(desc(insights.createdAt))
    .limit(6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your household financial overview
        </p>
      </div>

      {snapshot ? (
        <>
          <DashboardSummary snapshot={snapshot} />
          {activeInsights.length > 0 && (
            <InsightCards insights={activeInsights} />
          )}
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
