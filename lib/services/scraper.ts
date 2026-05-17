import { createScraper, CompanyTypes, type ScraperScrapingResult } from "israeli-bank-scrapers";
import { decrypt } from "@/lib/encryption";
import { db } from "@/db";
import { financialConnections, syncJobs, accounts, transactions, merchants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingestScraperResult } from "./ingest";

export type DiscountCredentials = {
  id: string;       // Israeli ID number
  password: string;
  num: string;      // Bank account number
};

/** Decrypt and parse stored credentials from a financial_connections row */
export function decryptCredentials(encrypted: string): DiscountCredentials {
  return JSON.parse(decrypt(encrypted)) as DiscountCredentials;
}

/**
 * Runs the bank scraper for a given connection and persists the result.
 * Called by the sync API route — runs in the Railway/Vercel Node.js process.
 *
 * OTP note: If Bank Discount requires OTP (e.g. first run from a new IP),
 * the scraper returns a loginFailed result. The sync job status is set to
 * 'failed' with a clear message. Running again a few hours later usually
 * works without OTP once the bank's rate limiting resets.
 */
export async function runSync(jobId: string, connectionId: string, householdId: string): Promise<void> {
  // Mark job as running
  await db.update(syncJobs)
    .set({ status: "running" })
    .where(eq(syncJobs.id, jobId));

  // Load connection
  const connection = await db.query.financialConnections.findFirst({
    where: eq(financialConnections.id, connectionId),
  });

  if (!connection?.encryptedCredentials) {
    await failJob(jobId, connectionId, "No credentials stored for this connection.");
    return;
  }

  let credentials: DiscountCredentials;
  try {
    credentials = decryptCredentials(connection.encryptedCredentials);
  } catch {
    await failJob(jobId, connectionId, "Failed to decrypt stored credentials.");
    return;
  }

  // Scrape from 90 days ago (avoids hitting the 1-year limit on first sync)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const companyId = (connection.scraperCompanyId ?? "discount") as CompanyTypes;

  let result: ScraperScrapingResult;
  try {
    const scraper = createScraper({
      companyId,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      // Required for Puppeteer running inside Docker/Railway containers
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      timeout: 60_000,
    });

    result = await scraper.scrape(credentials);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown scraper error";
    await failJob(jobId, connectionId, `Scraper crashed: ${msg}`);
    return;
  }

  if (!result.success) {
    const msg = buildErrorMessage(result.errorType, result.errorMessage);
    await failJob(jobId, connectionId, msg);
    return;
  }

  // Persist transactions
  let txnsImported = 0;
  try {
    txnsImported = await ingestScraperResult(result, connectionId, householdId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save transactions";
    await failJob(jobId, connectionId, msg);
    return;
  }

  // Mark success
  const now = new Date();
  await db.update(syncJobs)
    .set({ status: "completed", txnsImported, completedAt: now })
    .where(eq(syncJobs.id, jobId));

  await db.update(financialConnections)
    .set({ status: "active", lastSyncedAt: now, lastError: null })
    .where(eq(financialConnections.id, connectionId));
}

function buildErrorMessage(errorType?: string, errorMessage?: string): string {
  if (errorType === "invalidPassword") {
    return "Login failed — check your ID, password and account number.";
  }
  if (errorType === "changePassword") {
    return "Bank Discount is asking you to change your password. Please log in to the bank website and change it first.";
  }
  if (errorType === "timeout") {
    return "Bank website timed out. This can happen during busy hours — try again later.";
  }
  if (errorMessage?.toLowerCase().includes("otp") || errorMessage?.toLowerCase().includes("verification")) {
    return "Bank Discount requested OTP verification. This usually happens on the first scrape from a new server IP. Try again in a few hours, or log in to the bank website from your browser first to verify this device.";
  }
  return errorMessage ?? errorType ?? "Unknown scraper error.";
}

async function failJob(jobId: string, connectionId: string, errorMessage: string): Promise<void> {
  await db.update(syncJobs)
    .set({ status: "failed", errorMessage, completedAt: new Date() })
    .where(eq(syncJobs.id, jobId));

  await db.update(financialConnections)
    .set({ status: "error", lastError: errorMessage })
    .where(eq(financialConnections.id, connectionId));
}
