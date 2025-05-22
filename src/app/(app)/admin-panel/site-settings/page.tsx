
import type { Metadata } from 'next';
import { use } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: 'Admin - Site Settings',
};

export default function SiteSettingsPage({
  params: paramsAsProp, // Renamed incoming prop
  searchParams: searchParamsAsProp, // Renamed incoming prop
}: {
  params: any; // Type for the incoming params prop
  searchParams?: any; // Type for the incoming searchParams prop
}) {
  // Ensure params and searchParams are unwrapped before any potential enumeration
  const params = use(paramsAsProp); // params is now the unwrapped object
  const searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined; // searchParams is unwrapped or undefined

  // Now you can use 'params' and 'searchParams' as plain objects if needed,
  // though this page doesn't seem to use their values directly in its content.

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
