
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

export default function TestManagementPage() {
  return (
    <div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <ListChecks className="mr-3 h-7 w-7 text-primary" />
            Test Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Create, edit, and manage all test series, including chapterwise and full-length mock tests. Configure questions, subjects, and durations.
          </p>
          <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
            <p className="text-lg font-semibold">Test management features are coming soon!</p>
            <p className="text-sm text-muted-foreground">Stay tuned for updates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
