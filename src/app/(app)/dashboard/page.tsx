'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, ListChecks, ClipboardList, Bookmark, Trophy } from "lucide-react";
import Image from "next/image";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4 text-primary">Welcome to ExamPrep Pro!</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your one-stop platform to ace competitive exams. Sharpen your skills with our curated test series, daily problems, and track your progress.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="text-accent" />
              <span>Test Series</span>
            </CardTitle>
            <CardDescription>Access chapterwise and full-length mock tests.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Prepare effectively with a wide range of tests designed to simulate exam conditions.</p>
            <Link href="/test-series" passHref>
              <Button variant="default">
                View Tests <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="text-accent" />
              <span>Daily Practice Problems (DPPs)</span>
            </CardTitle>
            <CardDescription>Reinforce concepts with daily problem sets.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Stay consistent with your preparation through our curated DPPs.</p>
            <Link href="/dpps" passHref>
              <Button variant="default">
                View DPPs <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="text-accent" />
              <span>Notebook</span>
            </CardTitle>
            <CardDescription>Review your bookmarked questions anytime.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Keep track of important questions for quick revision and focused study.</p>
            <Link href="/notebook" passHref>
              <Button variant="default">
                Open Notebook <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="bg-card p-8 rounded-lg shadow-lg flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h2 className="text-3xl font-semibold mb-4">Track Your Progress</h2>
          <p className="text-muted-foreground mb-6">
            Monitor your performance, identify areas for improvement, and see how you stack up against others on the leaderboard.
          </p>
          <Link href="/leaderboard" passHref>
            <Button variant="secondary" size="lg">
              <Trophy className="mr-2 h-5 w-5" />
              View Leaderboard
            </Button>
          </Link>
        </div>
        <div className="flex-shrink-0">
           <Image 
            src="https://placehold.co/300x200.png"
            alt="Progress Chart Illustration" 
            width={300} 
            height={200}
            className="rounded-md"
            data-ai-hint="data analytics"
          />
        </div>
      </section>
    </div>
  );
}
