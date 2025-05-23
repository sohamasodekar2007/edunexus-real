
import type { Metadata } from 'next';
import { use } from 'react'; // Import use
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Users as UsersIcon, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: 'Admin - User Management',
};

export default function UserManagementPage({
  params: paramsAsProp,
  searchParams: searchParamsAsProp,
}: {
  params?: any;
  searchParams?: any;
}) {
  // Conditionally unwrap params and searchParams
  const params = paramsAsProp ? use(paramsAsProp) : undefined;
  const searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <UsersIcon className="mr-3 h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            User accounts are managed directly via the PocketBase Admin UI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            To manage users (view, create, edit, delete), please use your PocketBase instance's built-in administration interface.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_POCKETBASE_URL ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/_/` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center text-primary hover:underline"
          >
            Go to PocketBase Admin UI <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
