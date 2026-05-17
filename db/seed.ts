/**
 * Seeds system-level categories (householdId = null, isSystem = true).
 * Run once: npx tsx db/seed.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./index";
import { categories } from "./schema";

const SYSTEM_CATEGORIES = [
  // Income
  { name: "Salary", nameHe: "משכורת", icon: "briefcase", color: "#22c55e", isIncome: true },
  { name: "Freelance", nameHe: "פרילנס", icon: "laptop", color: "#16a34a", isIncome: true },
  { name: "Investment Income", nameHe: "הכנסות השקעות", icon: "trending-up", color: "#15803d", isIncome: true },
  { name: "Other Income", nameHe: "הכנסות אחרות", icon: "plus-circle", color: "#166534", isIncome: true },

  // Housing
  { name: "Rent / Mortgage", nameHe: "שכר דירה / משכנתא", icon: "home", color: "#6366f1" },
  { name: "Utilities", nameHe: "חשבונות", icon: "zap", color: "#818cf8" },
  { name: "Internet", nameHe: "אינטרנט", icon: "wifi", color: "#a5b4fc" },
  { name: "Home Maintenance", nameHe: "תחזוקת הבית", icon: "wrench", color: "#c7d2fe" },

  // Food
  { name: "Groceries", nameHe: "סופרמרקט", icon: "shopping-cart", color: "#f97316" },
  { name: "Restaurants", nameHe: "מסעדות", icon: "utensils", color: "#ea580c" },
  { name: "Coffee & Cafes", nameHe: "קפה", icon: "coffee", color: "#c2410c" },

  // Transport
  { name: "Fuel", nameHe: "דלק", icon: "fuel", color: "#eab308" },
  { name: "Public Transport", nameHe: "תחבורה ציבורית", icon: "bus", color: "#ca8a04" },
  { name: "Parking", nameHe: "חניה", icon: "parking-circle", color: "#a16207" },
  { name: "Car Maintenance", nameHe: "תחזוקת רכב", icon: "car", color: "#854d0e" },

  // Health
  { name: "Healthcare", nameHe: "בריאות", icon: "heart-pulse", color: "#ec4899" },
  { name: "Pharmacy", nameHe: "בית מרקחת", icon: "pill", color: "#db2777" },
  { name: "Gym & Fitness", nameHe: "כושר", icon: "dumbbell", color: "#be185d" },

  // Financial
  { name: "Insurance", nameHe: "ביטוח", icon: "shield", color: "#0ea5e9" },
  { name: "Loan Repayment", nameHe: "החזר הלוואה", icon: "landmark", color: "#0284c7" },
  { name: "Savings Transfer", nameHe: "העברה לחסכון", icon: "piggy-bank", color: "#0369a1" },

  // Subscriptions
  { name: "Streaming", nameHe: "סטרימינג", icon: "play-circle", color: "#8b5cf6" },
  { name: "Software & Apps", nameHe: "תוכנה", icon: "smartphone", color: "#7c3aed" },
  { name: "News & Media", nameHe: "מדיה", icon: "newspaper", color: "#6d28d9" },

  // Lifestyle
  { name: "Shopping & Clothing", nameHe: "קניות", icon: "shopping-bag", color: "#f43f5e" },
  { name: "Entertainment", nameHe: "בידור", icon: "ticket", color: "#e11d48" },
  { name: "Education", nameHe: "חינוך", icon: "graduation-cap", color: "#be123c" },
  { name: "Travel", nameHe: "טיול", icon: "plane", color: "#14b8a6" },
  { name: "Gifts & Donations", nameHe: "מתנות", icon: "gift", color: "#0d9488" },
  { name: "Luxury", nameHe: "יוקרה", icon: "gem", color: "#0f766e" },

  // Misc
  { name: "Taxes & Government", nameHe: "מסים", icon: "building-2", color: "#64748b" },
  { name: "Bank Fees", nameHe: "עמלות בנק", icon: "credit-card", color: "#475569" },
  { name: "Uncategorized", nameHe: "לא מקוטלג", icon: "circle-help", color: "#94a3b8" },
];

async function seed() {
  console.log("Seeding system categories...");

  for (const cat of SYSTEM_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        ...cat,
        isSystem: true,
        isIncome: cat.isIncome ?? false,
        householdId: null,
      })
      .onConflictDoNothing();
  }

  console.log(`Done — ${SYSTEM_CATEGORIES.length} categories seeded.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
