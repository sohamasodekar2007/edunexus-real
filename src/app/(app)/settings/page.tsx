
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings as SettingsIcon, Construction } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-muted/30 py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="w-9 h-9"></div> {/* Placeholder for alignment */}
      </header>

      <Card className="shadow-md w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Construction className="h-16 w-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">Settings Page</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            This page is currently under construction. Please check back later!
          </p>
          <Button asChild>
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
