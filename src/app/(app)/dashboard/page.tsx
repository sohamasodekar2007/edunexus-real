
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  ListChecks, 
  Percent,
  Target,
  Sparkles,
  CalendarDays,
  NotebookText,
  LineChart,
  History,
  User, 
  ChevronRight,
  BarChartHorizontalBig,
  TrendingUp,
  Trophy // Consolidated Trophy import
} from "lucide-react";
import { useEffect, useState } from "react";

const leaderboardSnapshotData = [
  { id: 'user1', name: 'Soham Asodariya', rank: 1, score: '15 pts', avatarFallback: 'SA' },
  { id: 'user2', name: 'Anonymous', rank: 2, score: '2 pts', avatarFallback: 'A' },
];

export default function DashboardPage() {
  const [userFullName, setUserFullName] = useState<string>('User');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userFullName');
      if (storedName) {
        setUserFullName(storedName);
      }
    }
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      {/* Greeting Section */}
      <section className="mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          Hello, {userFullName}! 
          <span role="img" aria-label="waving hand" className="ml-2 text-2xl">👋</span>
        </h1>
        <p className="text-muted-foreground">Let's conquer those exams!</p>
      </section>

      {/* Stats Cards Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TESTS TAKEN</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AVG. SCORE</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">HIGHEST SCORE</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL POINTS</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            {/* <p className="text-xs text-muted-foreground">+2 from last month</p> */}
          </CardContent>
        </Card>
      </section>

      {/* Quick Actions Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-3 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" size="lg" className="w-full justify-start text-left py-6" asChild>
              <Link href="/test-series">
                <ListChecks className="mr-3 h-5 w-5" /> Test Series
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full justify-start text-left py-6" asChild>
              <Link href="/dpps">
                <CalendarDays className="mr-3 h-5 w-5" /> Daily Practice
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full justify-start text-left py-6" asChild>
              <Link href="/my-progress"> 
                <TrendingUp className="mr-3 h-5 w-5" /> My Progress
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full justify-start text-left py-6" asChild>
              <Link href="/notebook">
                <NotebookText className="mr-3 h-5 w-5" /> My Notebooks
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Score Trend & Leaderboard Snapshot Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <LineChart className="mr-2 h-5 w-5 text-primary" />
              Your Score Trend (Last 5 Tests)
            </CardTitle>
            <CardDescription>Percentage score over recent attempts.</CardDescription>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center">
            <p className="text-muted-foreground">No test data yet to show trend.</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-primary" />
              Leaderboard Snapshot
            </CardTitle>
            <Link href="/leaderboard" passHref>
              <Button variant="link" size="sm" className="text-primary">View Full <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span className="font-medium">Your Rank</span>
                </div>
                <span className="font-semibold text-primary">N/A</span>
              </div>
              {leaderboardSnapshotData.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span className="w-6 text-muted-foreground">{entry.rank}.</span>
                     <div className="h-6 w-6 bg-secondary rounded-full flex items-center justify-center text-xs mr-2 shrink-0">{entry.avatarFallback}</div>
                    <span>{entry.name}</span>
                  </div>
                  <span className="text-muted-foreground">{entry.score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Test Activity Section */}
      <section>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <History className="mr-2 h-5 w-5 text-primary" />
              Recent Test Activity
            </CardTitle>
            <CardDescription>Your latest test attempts.</CardDescription>
          </CardHeader>
          <CardContent className="h-32 flex items-center justify-center">
            <p className="text-muted-foreground">No recent test activity to show.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
