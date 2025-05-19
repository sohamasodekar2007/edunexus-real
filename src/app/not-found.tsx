
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction, AlertTriangle, Home } from 'lucide-react';
import { Logo } from '@/components/icons';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 text-center">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <Construction className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold text-primary">404 - Page Not Found</CardTitle>
          <CardDescription className="mt-2 text-lg text-muted-foreground">
            Oops! This area is still under construction or the page you're looking for doesn't exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            We're working hard to build the best experience for you at EduNexus.
            In the meantime, you can return to a safe place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/landing">
                <Home className="mr-2 h-5 w-5" />
                Go to Homepage
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex justify-center items-center text-sm text-muted-foreground">
            <Logo className="h-6 w-6 mr-2 text-primary/70" /> EduNexus
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
