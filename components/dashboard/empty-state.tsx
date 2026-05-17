import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, Database } from "lucide-react";

export function EmptyState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import transactions
          </CardTitle>
          <CardDescription>
            Download your transaction history from Bank Discount Israel and
            upload the CSV file to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings">
            <Button size="sm">Upload CSV</Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Try with mock data
          </CardTitle>
          <CardDescription>
            Load realistic demo data to explore the dashboard before connecting
            your real accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings?tab=mock">
            <Button size="sm" variant="outline">
              Load demo data
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
