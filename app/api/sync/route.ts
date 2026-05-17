import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { syncJobs, financialConnections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { runSync } from "@/lib/services/scraper";

/** POST /api/sync — kick off a sync job for a connection */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId } = await req.json();
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  const householdId = session.user.householdId;
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 400 });

  // Verify connection belongs to this household
  const connection = await db.query.financialConnections.findFirst({
    where: and(
      eq(financialConnections.id, connectionId),
      eq(financialConnections.householdId, householdId)
    ),
  });
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  // Create the job record first so we can poll it
  const [job] = await db.insert(syncJobs).values({
    householdId,
    connectionId,
    status: "pending",
  }).returning();

  // Run sync asynchronously — don't await; respond immediately with job ID.
  // The client polls /api/sync/[jobId] for status.
  // Note: on Vercel this needs maxDuration set; on Railway it runs freely.
  runSync(job.id, connectionId, householdId).catch((err) => {
    console.error("Sync job crashed unexpectedly:", err);
  });

  return NextResponse.json({ jobId: job.id });
}

/** GET /api/sync — list recent sync jobs for the household */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = session.user.householdId;
  if (!householdId) return NextResponse.json([]);

  const jobs = await db.select().from(syncJobs)
    .where(eq(syncJobs.householdId, householdId))
    .orderBy(desc(syncJobs.startedAt))
    .limit(20);

  return NextResponse.json(jobs);
}
