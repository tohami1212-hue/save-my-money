import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/** GET /api/sync/[jobId] — poll a specific sync job's status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const householdId = session.user.householdId;

  const job = await db.query.syncJobs.findFirst({
    where: and(
      eq(syncJobs.id, jobId),
      eq(syncJobs.householdId, householdId ?? "")
    ),
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(job);
}
