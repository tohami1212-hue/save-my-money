import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { financialConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

/** POST /api/connections — save encrypted bank credentials */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = session.user.householdId;
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 400 });

  const body = await req.json();
  const { scraperCompanyId, id: bankId, password, num, institutionName } = body;

  if (!scraperCompanyId || !bankId || !password) {
    return NextResponse.json({ error: "scraperCompanyId, id, and password are required" }, { status: 400 });
  }

  // Encrypt credentials — never stored in plaintext
  const encryptedCredentials = encrypt(JSON.stringify({ id: bankId, password, num: num ?? "" }));

  // Upsert: one connection per company per household
  const existing = await db.query.financialConnections.findFirst({
    where: and(
      eq(financialConnections.householdId, householdId),
      eq(financialConnections.scraperCompanyId, scraperCompanyId)
    ),
  });

  let connectionId: string;
  if (existing) {
    await db.update(financialConnections)
      .set({ encryptedCredentials, status: "active", lastError: null })
      .where(eq(financialConnections.id, existing.id));
    connectionId = existing.id;
  } else {
    const [created] = await db.insert(financialConnections).values({
      householdId,
      provider: "israeli_scraper",
      scraperCompanyId,
      institutionName: institutionName ?? scraperCompanyId,
      encryptedCredentials,
      status: "active",
    }).returning({ id: financialConnections.id });
    connectionId = created.id;
  }

  return NextResponse.json({ connectionId });
}

/** GET /api/connections — list connections for the household (no credentials) */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = session.user.householdId;
  if (!householdId) return NextResponse.json([]);

  const rows = await db
    .select({
      id: financialConnections.id,
      provider: financialConnections.provider,
      scraperCompanyId: financialConnections.scraperCompanyId,
      institutionName: financialConnections.institutionName,
      status: financialConnections.status,
      lastSyncedAt: financialConnections.lastSyncedAt,
      lastError: financialConnections.lastError,
    })
    .from(financialConnections)
    .where(eq(financialConnections.householdId, householdId));

  return NextResponse.json(rows);
}

/** DELETE /api/connections?id=... — remove a connection and its credentials */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = session.user.householdId;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !householdId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(financialConnections)
    .where(and(
      eq(financialConnections.id, id),
      eq(financialConnections.householdId, householdId)
    ));

  return NextResponse.json({ ok: true });
}
