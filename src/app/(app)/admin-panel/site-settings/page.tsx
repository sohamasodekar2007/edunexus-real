
import type { Metadata } from 'next';
import { use } from 'react'; // Import use
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: 'Admin - Site Settings',
};

export default function SiteSettingsPage({
  params: paramsAsProp,
  searchParams: searchParamsAsProp,
}: {
  params?: any; 
  searchParams?: any;
}) {
  // Conditionally unwrap params and searchParams
  const _params = paramsAsProp ? use(paramsAsProp) : undefined;
  const _searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
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
