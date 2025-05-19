
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  SlidersHorizontal,
  Trophy,
  History,
  Target,
  FileQuestion,
  CheckCircle2,
  BarChart3,
  Layers,
  ExternalLink,
  CalendarDays,
} from 'lucide-react';

// Placeholder data for recent tests
const recentTestsData = [
  {
    id: 'test-physics-1',
    title: 'Mathematics in Physics',
    score: '1/3 (33.3%)',
    date: '10/05/2025', // Note: Dates in image are in DD/MM/YYYY format.
  },
  {
    id: 'test-physics-2',
    title: 'Mathematics in Physics',
    score: '0/3 (0.0%)',
    date: '08/05/2025',
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const [userFullName, setUserFullName] = useState<string>('Soham Asodekar');
  const [userEmail, setUserEmail] = useState<string>('sohamasodekar1981@gmail.com');
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>('SA');
  const [userClass, setUserClass] = useState<string | null>('12th Class');
  const [userModel, setUserModel] = useState<string | null>('Full_length');
  const [totalPoints, setTotalPoints] = useState<number>(15); // Placeholder

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedFullName = localStorage.getItem('userFullName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedAvatarFallback = localStorage.getItem('userAvatarFallback');
      const storedClass = localStorage.getItem('userClass');
      const storedModel = localStorage.getItem('userModel');

      if (storedFullName) setUserFullName(storedFullName);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedAvatarFallback) setUserAvatarFallback(storedAvatarFallback);
      if (storedClass) setUserClass(storedClass);
      if (storedModel) setUserModel(storedModel);
      // totalPoints remains placeholder for now
    }
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-muted/30 py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">My Profile</h1>
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </header>

      {/* Profile Info Card */}
      <Card className="shadow-md">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl border-2 border-primary">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${userAvatarFallback}`} alt={userFullName} data-ai-hint="placeholder avatar" />
            <AvatarFallback>{userAvatarFallback}</AvatarFallback>
          </Avatar>
          <div className="flex-grow text-center sm:text-left">
            <h2 className="text-2xl font-semibold">{userFullName}</h2>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
            <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
              {userClass && <Badge variant="secondary">Class: {userClass}</Badge>}
              <Badge variant="secondary">Target: N/A</Badge>
              {userModel && <Badge variant="secondary">Plan: {userModel}</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-center text-center sm:text-left shrink-0 mt-4 sm:mt-0">
            <Trophy className="h-10 w-10 text-yellow-500 mb-1" />
            <p className="text-2xl font-bold">{totalPoints}</p>
            <p className="text-xs text-muted-foreground">Total Points</p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button variant="outline" size="lg" className="justify-start py-6" asChild>
          <Link href="/test-history"> {/* Placeholder link */}
            <History className="mr-3 h-5 w-5" /> My Test History
          </Link>
        </Button>
        <Button variant="outline" size="lg" className="justify-start py-6" asChild>
          <Link href="/leaderboard">
            <Trophy className="mr-3 h-5 w-5" /> View Leaderboard
          </Link>
        </Button>
      </div>

      {/* My Learning Activity Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">My Learning Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-6 w-6 text-primary" />
            <span className="font-medium">My Daily DPP Goal</span>
          </div>
          <Progress value={0} className="w-full h-2.5" />
          <p className="text-xs text-muted-foreground text-right mt-1">0/10 Questions Solved Today (DPP)</p>
        </CardContent>
      </Card>

      {/* This Week's Snapshot Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">This Week&apos;s Snapshot (DPP)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: FileQuestion, label: 'QUESTIONS', value: '0', bgColor: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
            { icon: CheckCircle2, label: 'CORRECT', value: '0', bgColor: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400' },
            { icon: BarChart3, label: 'ACCURACY', value: '0%', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
            { icon: Layers, label: 'DPP SETS', value: '0', bgColor: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400' },
          ].map((item, index) => (
            <Card key={index} className={`p-3 text-center shadow-sm ${item.bgColor}`}>
              <item.icon className={`h-7 w-7 mx-auto mb-1.5 ${item.iconColor}`} />
              <p className="text-xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground uppercase">{item.label}</p>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Recent Tests Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Recent Tests</CardTitle>
          <CardDescription>Your latest test performance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentTestsData.map((test) => (
            <div key={test.id} className="p-3 border rounded-md flex justify-between items-center hover:bg-muted/50">
              <div>
                <h4 className="font-medium text-primary">{test.title}</h4>
                <p className="text-sm text-muted-foreground">Score: {test.score}</p>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <CalendarDays className="h-3 w-3 mr-1" /> {test.date}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/test-details/${test.id}`}> {/* Placeholder link */}
                  View Details <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
          {recentTestsData.length === 0 && (
             <p className="text-sm text-muted-foreground text-center py-4">No recent tests to display.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button className="w-full" asChild>
            <Link href="/test-history">View All Test History</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    