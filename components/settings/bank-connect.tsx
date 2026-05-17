"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";

type Connection = {
  id: string;
  institutionName: string | null;
  scraperCompanyId: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type SyncJob = {
  id: string;
  status: string;
  txnsImported: number | null;
  errorMessage: string | null;
};

export function BankConnect({ initialConnections }: { initialConnections: Connection[] }) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ connectionId: string; job: SyncJob } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scraperCompanyId: "discount",
          institutionName: "Bank Discount Israel",
          id: fd.get("bankId"),
          password: fd.get("password"),
          num: fd.get("num"),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Failed to save connection");
        return;
      }

      // Refresh connection list
      const listRes = await fetch("/api/connections");
      setConnections(await listRes.json());
      setShowForm(false);
    } catch {
      setFormError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    setSyncResult(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const { jobId } = await res.json();

      // Poll until done
      let job: SyncJob;
      while (true) {
        await sleep(2000);
        const statusRes = await fetch(`/api/sync/${jobId}`);
        job = await statusRes.json();
        if (job.status === "completed" || job.status === "failed") break;
      }

      setSyncResult({ connectionId, job });

      // Refresh connection list to show updated lastSyncedAt / error
      const listRes = await fetch("/api/connections");
      setConnections(await listRes.json());
    } catch {
      setSyncResult({
        connectionId,
        job: { id: "", status: "failed", txnsImported: 0, errorMessage: "Network error" },
      });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(connectionId: string) {
    if (!confirm("Remove this bank connection? Your existing transactions won't be deleted.")) return;
    await fetch(`/api/connections?id=${connectionId}`, { method: "DELETE" });
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }

  return (
    <div className="space-y-4">
      {/* Existing connections */}
      {connections.map((conn) => {
        const isSyncing = syncingId === conn.id;
        const result = syncResult?.connectionId === conn.id ? syncResult.job : null;

        return (
          <div key={conn.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{conn.institutionName ?? conn.scraperCompanyId}</p>
                <p className="text-xs text-muted-foreground">
                  {conn.lastSyncedAt
                    ? `Last synced: ${new Date(conn.lastSyncedAt).toLocaleString("he-IL")}`
                    : "Never synced"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={conn.status} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSync(conn.id)}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">{isSyncing ? "Syncing…" : "Sync now"}</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(conn.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Last error */}
            {conn.lastError && !result && (
              <div className="flex gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {conn.lastError}
              </div>
            )}

            {/* Sync result */}
            {result && result.status === "completed" && (
              <div className="flex gap-2 rounded-md bg-green-500/10 p-2.5 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Sync complete — {result.txnsImported} new transaction{result.txnsImported !== 1 ? "s" : ""} imported.
              </div>
            )}
            {result && result.status === "failed" && (
              <div className="flex gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {result.errorMessage}
              </div>
            )}
          </div>
        );
      })}

      {/* Add connection */}
      {!showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          + Connect Bank Discount Israel
        </Button>
      )}

      {showForm && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Connect Bank Discount Israel</CardTitle>
            <CardDescription className="text-xs">
              Your credentials are encrypted with AES-256 and stored only on your private server.
              They are never sent to any third party.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-3">
              {formError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{formError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bankId" className="text-xs">Israeli ID (תעודת זהות)</Label>
                  <Input id="bankId" name="bankId" type="text" required placeholder="123456789" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="num" className="text-xs">Account number</Label>
                  <Input id="num" name="num" type="text" placeholder="12-345-67" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs">Online banking password</Label>
                <Input id="password" name="password" type="password" required placeholder="••••••••" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Save connection
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "outline" | "secondary" | "destructive" }> = {
    active: { label: "Active", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
    syncing: { label: "Syncing", variant: "outline" },
    disconnected: { label: "Disconnected", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant} className="text-xs capitalize">{cfg.label}</Badge>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
