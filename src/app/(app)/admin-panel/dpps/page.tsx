
import type { Metadata } from 'next';
import { use } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export const metadata: Metadata = {
  title: 'Admin - DPP Management',
};

// Changed props typing to any to resolve PageProps constraint issue
// Next.js passes params and searchParams as "use-able" resources
export default function DppManagementPage({
  params,
  searchParams,
}: { params?: any; searchParams?: any }) { // Use 'any' or a more generic type for the props themselves
  // Ensure params and searchParams are unwrapped before any potential enumeration
  // Also check if they exist before calling use()
  if (params) {
    use(params);
  }
  if (searchParams) {
    use(searchParams);
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <ClipboardList className="mr-3 h-7 w-7 text-primary" />
            DPP Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage Daily Practice Problems (DPPs). Add new DPP sets, edit existing problems, and schedule their release.
          </p>
          <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
            <p className="text-lg font-semibold">DPP management features are coming soon!</p>
            <p className="text-sm text-muted-foreground">Stay tuned for updates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
