
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UserManagementPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Users className="mr-3 h-7 w-7 text-primary" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            User management is now handled directly via the PocketBase admin interface.
          </p>
          <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
            <p className="text-lg font-semibold">This page is no longer in use.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
