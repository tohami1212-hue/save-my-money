import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, TrendingDown, Sparkles } from "lucide-react";
import type { insights } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Insight = InferSelectModel<typeof insights>;

const severityConfig = {
  warning: {
    icon: AlertTriangle,
    className: "text-yellow-600",
    badge: "outline" as const,
  },
  info: { icon: Info, className: "text-blue-500", badge: "secondary" as const },
  positive: {
    icon: TrendingDown,
    className: "text-green-600",
    badge: "secondary" as const,
  },
};

const typeIcon: Record<string, typeof Sparkles> = {
  monthly_summary: Sparkles,
  anomaly: AlertTriangle,
  savings_opportunity: TrendingDown,
  subscription: Info,
};

export function InsightCards({ insights }: { insights: Insight[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Insights
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight) => {
          const cfg =
            severityConfig[insight.severity as keyof typeof severityConfig] ??
            severityConfig.info;
          const Icon = typeIcon[insight.insightType] ?? Info;

          return (
            <Card key={insight.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-start gap-2">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.className}`} />
                  <span>{insight.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {insight.body}
                </p>
                {insight.amountImpact && (
                  <Badge variant={cfg.badge} className="text-xs">
                    Est. ₪{Math.abs(Number(insight.amountImpact)).toLocaleString()}/month
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
