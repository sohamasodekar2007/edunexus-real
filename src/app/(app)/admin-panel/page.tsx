
import type { Metadata } from 'next';
import { use } from 'react'; // Import use
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, BarChart3, Users, Settings, ExternalLink } from 'lucide-react';
import Link from "next/link";

export const metadata: Metadata = {
  title: 'Admin - Dashboard',
};

export default function AdminDashboardPage({
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
    <div className="space-y-6">
      <section className="mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <ShieldCheck className="mr-3 h-8 w-8 text-primary" />
          Admin Panel Overview
        </h1>
        <p className="text-muted-foreground">Welcome to the EduNexus control center.</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL USERS</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Placeholder data</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ACTIVE TESTS</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Placeholder data</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SITE STATUS</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Links</CardTitle>
            <CardDescription>Navigate to key admin sections.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/admin-panel/users" className="p-4 border rounded-md hover:bg-muted/50 flex justify-between items-center transition-colors">
              <span>User Management (Handled via PocketBase)</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/admin-panel/tests" className="p-4 border rounded-md hover:bg-muted/50 flex justify-between items-center transition-colors">
              <span>Test Configuration (Coming Soon)</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
             <Link href="/admin-panel/dpps" className="p-4 border rounded-md hover:bg-muted/50 flex justify-between items-center transition-colors">
              <span>DPP Configuration (Coming Soon)</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/admin-panel/site-settings" className="p-4 border rounded-md hover:bg-muted/50 flex justify-between items-center transition-colors">
              <span>Global Settings (Coming Soon)</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
          </