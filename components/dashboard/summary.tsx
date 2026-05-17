import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowDown, ArrowUp, PiggyBank, TrendingUp } from "lucide-react";
import type { monthlySnapshots } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Snapshot = InferSelectModel<typeof monthlySnapshots>;

function formatILS(amount: string | number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatSavingsRate(rate: number | null | undefined) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function DashboardSummary({ snapshot }: { snapshot: Snapshot }) {
  const savingsRateNum = snapshot.savingsRate ? snapshot.savingsRate * 100 : 0;
  const savingsColor =
    savingsRateNum >= 20
      ? "text-green-600"
      : savingsRateNum >= 10
      ? "text-yellow-600"
      : "text-red-600";

  const monthLabel = snapshot.month
    ? new Date(snapshot.month + "T12:00:00").toLocaleDateString("en-IL", {
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground font-medium">{monthLabel}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ArrowDown className="h-3.5 w-3.5 text-green-600" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatILS(snapshot.totalIncome)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ArrowUp className="h-3.5 w-3.5 text-red-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatILS(snapshot.totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
              Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatILS(snapshot.netSavings)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
              Savings Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-semibold ${savingsColor}`}>
              {formatSavingsRate(snapshot.savingsRate)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
