'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons';
import { ArrowRight, Rocket, Target, Wand2, BarChartBig, ListChecks } from 'lucide-react';
import { use } from 'react';

export default function LandingPage({
  params,
  searchParams,
}: {
  params: { [key: string]: string | string[] | undefined };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  use(params);
  use(searchParams);
  const router = useRouter();

  useEffect(() => {
    if (pb.authStore.isValid) {
      // If user is already logged in and somehow lands here, redirect to dashboard
      // router.replace('/dashboard');
    }
  }, [router]);

  // The root page.tsx now handles initial redirect logic.
  // This page should just render the landing content.
  // If a logged-in user directly navigates here, they see it unless explicitly redirected.

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="container mx-auto py-4 px-4 md:px-6">
        <div className="flex justify-between items-center">
          <Link href="/landing" className="flex items-center gap-2 text-primary">
            <Logo className="h-8 w-8" />
            <span className="font-bold text-lg sm:text-xl">EduNexus</span>
          </Link>
          <nav className="space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto text-center py-12 sm:py-16 md:py-24 px-4 md:px-6">
          <div className="mb-6">
            <Rocket className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Ace Your Competitive Exams
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            EduNexus provides comprehensive test series, daily practice problems, and AI-powered doubt solving to help you succeed in MHT-CET, JEE, and NEET.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/signup">
                Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/colleges"> {/* Placeholder link */}
                <ListChecks className="mr-2 h-5 w-5" /> View College List
              </Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted py-12 sm:py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="mx-auto bg-primary/10 p-3 sm:p-4 rounded-full w-fit mb-4">
                    <Target className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-semibold">Comprehensive Test Series</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm sm:text-base">
                    Access chapter-wise and full-length mock tests designed by experts to simulate the real exam environment.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="mx-auto bg-primary/10 p-3 sm:p-4 rounded-full w-fit mb-4">
                    <Wand2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-semibold">AI-Powered Doubt Solving</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm sm:text-base">
                    Get instant, step-by-step solutions to your toughest questions with our advanced AI tutor.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="mx-auto bg-primary/10 p-3 sm:p-4 rounded-full w-fit mb-4">
                    <BarChartBig className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-semibold">Track Your Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm sm:text-base">
                    Monitor your performance, identify weak areas, and climb the leaderboard with detailed analytics.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-8 text-center text-muted-foreground">
        <p className="text-sm">&copy; {new Date().getFullYear()} EduNexus. All rights reserved.</p>
      </footer>
    </div>
  );
}
