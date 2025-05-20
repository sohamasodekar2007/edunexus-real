
import type { Metadata } from 'next';
import { use } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: 'Admin - Site Settings',
};

export default function SiteSettingsPage({
  params,
  searchParams,
}: {
  params: { [key: string]: string | string[] | undefined };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Ensure params and searchParams are unwrapped before any potential enumeration
  use(params);
  use(searchParams);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Settings2 className="mr-3 h-7 w-7 text-primary" />
            Site Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configure global settings for the EduNexus application, such as API keys, feature flags, and maintenance mode.
          </p>
          <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
            <p className="text-lg font-semibold">Site settings features are coming soon!</p>
            <p className="text-sm text-muted-foreground">Stay tuned for updates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
