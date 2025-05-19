
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UserManagementPage() {
  return (
    <div className="p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Users className="mr-3 h-7 w-7 text-primary" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage all users of the EduNexus platform. This section will allow you to view, edit, and manage user accounts, roles, and subscriptions.
          </p>
          <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
            <p className="text-lg font-semibold">User management features are coming soon!</p>
            <p className="text-sm text-muted-foreground">Stay tuned for updates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
