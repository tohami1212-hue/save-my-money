import type { ScraperScrapingResult } from "israeli-bank-scrapers";
import { db } from "@/db";
import { accounts, transactions, merchants, categories } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Persists a successful scraper result into the database.
 * - Creates accounts if they don't exist yet.
 * - Skips duplicate transactions (same account + referenceId).
 * - Normalises merchant names and attempts rule-based categorisation.
 * Returns the number of new transactions inserted.
 */
export async function ingestScraperResult(
  result: ScraperScrapingResult,
  connectionId: string,
  householdId: string
): Promise<number> {
  if (!result.accounts?.length) return 0;

  let totalInserted = 0;
  const importBatchId = crypto.randomUUID();

  for (const scraperAccount of result.accounts) {
    // Upsert account
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.householdId, householdId),
        eq(accounts.accountMask, scraperAccount.accountNumber)
      ),
    });

    let accountId: string;
    if (existing) {
      accountId = existing.id;
      // Update balance if available
      if (scraperAccount.balance !== undefined) {
        await db.update(accounts)
          .set({ currentBalance: String(scraperAccount.balance), balanceUpdatedAt: new Date() })
          .where(eq(accounts.id, accountId));
      }
    } else {
      const [newAccount] = await db.insert(accounts).values({
        householdId,
        connectionId,
        name: `Bank Discount ${scraperAccount.accountNumber}`,
        accountType: "checking",
        accountMask: scraperAccount.accountNumber,
        currentBalance: scraperAccount.balance !== undefined ? String(scraperAccount.balance) : null,
        balanceUpdatedAt: scraperAccount.balance !== undefined ? new Date() : null,
      }).returning({ id: accounts.id });
      accountId = newAccount.id;
    }

    // Insert transactions
    for (const txn of scraperAccount.txns) {
      const referenceId = txn.identifier
        ? String(txn.identifier)
        : `${txn.date}-${txn.chargedAmount}-${txn.description}`.replace(/\s/g, "");

      // Skip duplicates
      const dup = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.accountId, accountId),
          eq(transactions.referenceId, referenceId)
        ),
      });
      if (dup) continue;

      // Resolve or create merchant
      const rawName = (txn.description ?? "").trim();
      const merchantId = rawName ? await resolveMerchant(rawName, householdId) : null;

      // Rule-based category from merchant
      const categoryId = merchantId ? await getCategoryForMerchant(merchantId) : null;

      // Positive = income (credit), negative = expense (debit)
      const amount = txn.chargedAmount;

      await db.insert(transactions).values({
        householdId,
        accountId,
        merchantId,
        categoryId,
        amount: String(amount),
        currency: txn.originalCurrency ?? "ILS",
        date: txn.date.split("T")[0], // ISO date part only
        description: txn.description ?? null,
        referenceId,
        isPending: txn.status === "pending",
        source: "israeli_scraper",
        importBatchId,
        categorizationConfidence: categoryId ? 0.7 : null,
      });

      totalInserted++;
    }
  }

  return totalInserted;
}

/** Finds or creates a merchant row for the given raw name */
async function resolveMerchant(rawName: string, householdId: string): Promise<string> {
  const existing = await db.query.merchants.findFirst({
    where: and(
      eq(merchants.householdId, householdId),
      eq(merchants.rawName, rawName)
    ),
  });
  if (existing) return existing.id;

  const [created] = await db.insert(merchants).values({
    householdId,
    rawName,
    normalizedName: normalizeMerchantName(rawName),
    isSubscription: looksLikeSubscription(rawName),
  }).returning({ id: merchants.id });

  return created.id;
}

/** Returns the categoryId stored on a merchant (if any) */
async function getCategoryForMerchant(merchantId: string): Promise<string | null> {
  const m = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
  });
  return m?.categoryId ?? null;
}

/** Cleans up common Israeli bank description noise */
function normalizeMerchantName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^\d{4,}\s+/, "") // strip leading reference numbers
    .trim();
}

/** Heuristic: recurring monthly charges are likely subscriptions */
function looksLikeSubscription(name: string): boolean {
  const lower = name.toLowerCase();
  const subscriptionKeywords = [
    "netflix", "spotify", "apple", "google", "amazon", "microsoft",
    "hbo", "disney", "youtube", "dropbox", "adobe", "canva",
    "icloud", "one drive", "office 365",
    // Hebrew-transliterated
    "נטפליקס", "ספוטיפיי", "אפל", "גוגל", "אמאזון",
  ];
  return subscriptionKeywords.some((kw) => lower.includes(kw));
}
