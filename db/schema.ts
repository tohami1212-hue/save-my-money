import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  real,
  inet,
  integer,
  primaryKey,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// bytea is not exported by this drizzle version; define it via customType
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ─── Households ───────────────────────────────────────────────────────────────

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("ILS"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  displayName: text("display_name"),
  passwordHash: text("password_hash"), // bcrypt hash; null for OAuth users
  image: text("image"),
  householdId: uuid("household_id").references(() => households.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// NextAuth uses JWT sessions (cookie-based) — no DB tables needed for auth sessions.

// ─── Household Members ─────────────────────────────────────────────────────────

export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // 'owner' | 'member'
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] })]
);

// ─── Household Invites ─────────────────────────────────────────────────────────

export const householdInvites = pgTable("household_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  inviteEmail: text("invite_email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Categories ────────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id), // NULL = system category
  name: text("name").notNull(),
  nameHe: text("name_he"), // Hebrew name for Israeli users
  icon: text("icon"),
  color: text("color"),
  parentId: uuid("parent_id"), // self-reference set up in relations
  isIncome: boolean("is_income").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Merchants ─────────────────────────────────────────────────────────────────

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    rawName: text("raw_name").notNull(), // original string from bank
    normalizedName: text("normalized_name"), // cleaned display name
    categoryId: uuid("category_id").references(() => categories.id),
    isSubscription: boolean("is_subscription").notNull().default(false),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("merchants_household_raw_name_idx").on(t.householdId, t.rawName)]
);

// ─── Financial Connections ─────────────────────────────────────────────────────

export const financialConnections = pgTable("financial_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  // 'israeli_scraper' | 'manual_csv' | 'salt_edge' | 'mock'
  provider: text("provider").notNull(),
  // For israeli_scraper: 'discount' | 'hapoalim' | 'leumi' | etc.
  scraperCompanyId: text("scraper_company_id"),
  institutionName: text("institution_name"),
  // 'active' | 'error' | 'disconnected' | 'syncing'
  status: text("status").notNull().default("active"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  // AES-256-GCM encrypted JSON: { id, password, num } for scraper credentials
  encryptedCredentials: text("encrypted_credentials"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Sync Jobs ─────────────────────────────────────────────────────────────────

export const syncJobs = pgTable("sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => financialConnections.id),
  // 'pending' | 'running' | 'completed' | 'failed'
  status: text("status").notNull().default("pending"),
  txnsImported: integer("txns_imported").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Accounts ──────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  connectionId: uuid("connection_id").references(() => financialConnections.id),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(), // 'checking' | 'savings' | 'credit_card' | 'investment'
  accountMask: text("account_mask"), // last 4 digits only
  currency: text("currency").notNull().default("ILS"),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }),
  balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Transactions ──────────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    merchantId: uuid("merchant_id").references(() => merchants.id),
    categoryId: uuid("category_id").references(() => categories.id),
    // Positive = income, negative = expense
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("ILS"),
    date: date("date").notNull(),
    description: text("description"), // from bank; may contain personal info
    referenceId: text("reference_id"), // bank's own transaction ID for dedup
    isPending: boolean("is_pending").notNull().default(false),
    isExcluded: boolean("is_excluded").notNull().default(false),
    source: text("source").notNull(), // 'csv_import' | 'mock' | 'plaid'
    importBatchId: uuid("import_batch_id"),
    categorizationConfidence: real("categorization_confidence"), // 0-1
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("transactions_account_ref_idx").on(t.accountId, t.referenceId),
  ]
);

// ─── Recurring Expenses ────────────────────────────────────────────────────────

export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  merchantId: uuid("merchant_id").references(() => merchants.id),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  expectedAmount: numeric("expected_amount", { precision: 15, scale: 2 }),
  amountTolerance: real("amount_tolerance").default(0.05), // 5% = still "same"
  frequency: text("frequency").notNull(), // 'monthly' | 'weekly' | 'annual' | 'quarterly'
  nextExpectedDate: date("next_expected_date"),
  lastSeenDate: date("last_seen_date"),
  isSubscription: boolean("is_subscription").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Monthly Snapshots ─────────────────────────────────────────────────────────

export const monthlySnapshots = pgTable(
  "monthly_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    month: date("month").notNull(), // first day of month: 2025-05-01
    totalIncome: numeric("total_income", { precision: 15, scale: 2 }),
    totalExpenses: numeric("total_expenses", { precision: 15, scale: 2 }),
    netSavings: numeric("net_savings", { precision: 15, scale: 2 }),
    savingsRate: real("savings_rate"), // 0-1
    categoryBreakdown: jsonb("category_breakdown"),
    topMerchants: jsonb("top_merchants"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_snapshots_household_month_idx").on(t.householdId, t.month),
  ]
);

// ─── Insights ──────────────────────────────────────────────────────────────────

export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  month: date("month"),
  insightType: text("insight_type").notNull(), // 'anomaly' | 'savings_opportunity' | 'subscription' | 'monthly_summary'
  title: text("title").notNull(),
  body: text("body").notNull(), // household-friendly explanation
  severity: text("severity"), // 'info' | 'warning' | 'positive'
  relatedTransactionIds: uuid("related_transaction_ids").array(),
  relatedRecurringId: uuid("related_recurring_id").references(
    () => recurringExpenses.id
  ),
  amountImpact: numeric("amount_impact", { precision: 15, scale: 2 }),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Recommendations ───────────────────────────────────────────────────────────

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  recommendationType: text("recommendation_type").notNull(), // 'reduce_category' | 'cancel_subscription' | 'negotiate_recurring'
  title: text("title").notNull(),
  body: text("body").notNull(),
  estimatedMonthlySaving: numeric("estimated_monthly_saving", {
    precision: 15,
    scale: 2,
  }),
  relatedCategoryId: uuid("related_category_id").references(() => categories.id),
  relatedRecurringId: uuid("related_recurring_id").references(
    () => recurringExpenses.id
  ),
  status: text("status").notNull().default("active"), // 'active' | 'accepted' | 'dismissed'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Investment Accounts (Phase 2 placeholder) ─────────────────────────────────

export const investmentAccounts = pgTable("investment_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  accountName: text("account_name").notNull(),
  accountType: text("account_type"), // 'pension' | 'study_fund' | 'broker' | 'real_estate'
  providerName: text("provider_name"),
  currentValue: numeric("current_value", { precision: 15, scale: 2 }),
  currency: text("currency").notNull().default("ILS"),
  lastUpdated: timestamp("last_updated", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Audit Logs (immutable — never delete rows) ────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id"),
  userId: uuid("user_id"),
  action: text("action").notNull(), // 'csv_import' | 'transaction_update' | 'login' | 'insight_generated'
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────────

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  accounts: many(accounts),
  transactions: many(transactions),
  categories: many(categories),
  merchants: many(merchants),
  snapshots: many(monthlySnapshots),
  insights: many(insights),
  recommendations: many(recommendations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  memberships: many(householdMembers),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  merchant: one(merchants, {
    fields: [transactions.merchantId],
    references: [merchants.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  household: one(households, {
    fields: [accounts.householdId],
    references: [households.id],
  }),
  connection: one(financialConnections, {
    fields: [accounts.connectionId],
    references: [financialConnections.id],
  }),
  transactions: many(transactions),
}));
