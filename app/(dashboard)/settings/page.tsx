import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { households, householdMembers, users, financialConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BankConnect } from "@/components/settings/bank-connect";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const householdId = session.user.householdId;

  const household = householdId
    ? await db.query.households.findFirst({ where: eq(households.id, householdId) })
    : null;

  const members = householdId
    ? await db
        .select({
          userId: householdMembers.userId,
          role: householdMembers.role,
          displayName: users.displayName,
          email: users.email,
        })
        .from(householdMembers)
        .leftJoin(users, eq(users.id, householdMembers.userId))
        .where(eq(householdMembers.householdId, householdId))
    : [];

  // Load connections without credentials (safe to pass to client)
  const connections = householdId
    ? await db
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
        .where(eq(financialConnections.householdId, householdId))
    : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your household and bank connections
        </p>
      </div>

      {/* Household */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household</CardTitle>
          <CardDescription>Your shared financial workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Name</p>
            <p className="text-sm text-muted-foreground mt-0.5">{household?.name ?? "—"}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Members</p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.displayName ?? m.email}</p>
                    {m.displayName && (
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank connections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank connections</CardTitle>
          <CardDescription>
            Connect your Israeli bank accounts for automatic transaction sync.
            Credentials are encrypted with AES-256-GCM and stored on your private server only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankConnect initialConnections={connections.map(c => ({
            ...c,
            lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          }))} />
        </CardContent>
      </Card>

      {/* Security info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Your data lives in your private Railway PostgreSQL database. No third party can access it.</p>
          <p>Bank credentials are encrypted with AES-256-GCM before being stored. The encryption key is in your Railway environment variables, not in the database.</p>
          <p>AI insights receive aggregated totals only — raw transaction descriptions never leave your server.</p>
          <p>The scraper opens a headless browser on your server, logs into the bank using your credentials, downloads transactions, then closes. No credentials are transmitted to external services.</p>
        </CardContent>
      </Card>
    </div>
  );
}
