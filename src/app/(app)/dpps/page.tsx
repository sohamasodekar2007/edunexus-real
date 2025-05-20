
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Dpp, Question, BookmarkedQuestion } from '@/types';
// import useLocalStorage from '@/hooks/use-local-storage'; // Not used for now
// import { mockDpps, LOCAL_STORAGE_KEYS } from '@/lib/mock-data'; // Not used for now
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookCheck, CalendarDays, Edit3, Atom, FlaskConical, Sigma, Leaf, ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getLessonsBySubjectAction } from '@/app/auth/actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const subjects = [
  { name: 'Physics', icon: Atom, dataAiHint: "physics science" },
  { name: 'Chemistry', icon: FlaskConical, dataAiHint: "chemistry lab" },
  { name: 'Mathematics', icon: Sigma, dataAiHint: "math symbols" },
  { name: 'Biology', icon: Leaf, dataAiHint: "biology nature" },
];

export default function DppsPage() {
  const { toast } = useToast();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [lessons, setLessons] = useState<string[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const fetchLessons = useCallback(async (subject: string) => {
    if (!subject) return;
    setIsLoadingLessons(true);
    setLessonsError(null);
    setLessons([]);
    try {
      const result = await getLessonsBySubjectAction(subject);
      if (result.success && result.lessons) {
        setLessons(result.lessons);
      } else {
        setLessonsError(result.message || "Failed to load lessons.");
        toast({
          title: "Error fetching lessons",
          description: result.message || "Could not retrieve lessons for this subject.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Critical error fetching lessons:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setLessonsError(errorMessage);
      toast({
        title: "Error",
        description: `Could not retrieve lessons: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLessons(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedSubject) {
      fetchLessons(selectedSubject);
    } else {
      // Clear lessons when no subject is selected
      setLessons([]);
      setLessonsError(null);
    }
  }, [selectedSubject, fetchLessons]);


  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {!selectedSubject ? (
        <>
          <h1 className="text-3xl font-bold mb-8 text-primary">Select a Subject for DPPs</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {subjects.map((subject) => (
              <Card
                key={subject.name}
                className="shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer group"
                onClick={() => setSelectedSubject(subject.name)}
                data-ai-hint={subject.dataAiHint}
              >
                <CardHeader className="items-center text-center">
                  <subject.icon className="h-16 w-16 text-primary group-hover:scale-110 transition-transform mb-3" />
                  <CardTitle className="text-xl">{subject.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">View DPPs for {subject.name}</p>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full group-hover:bg-accent">
                        Select {subject.name} <ChevronRight className="ml-2 h-4 w-4"/>
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-primary">Lessons for {selectedSubject}</h1>
            <Button variant="outline" onClick={() => setSelectedSubject(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
            </Button>
          </div>

          {isLoadingLessons && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Loading lessons...</p>
            </div>
          )}

          {!isLoadingLessons && lessonsError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Lessons</AlertTitle>
              <AlertDescription>
                {lessonsError}
                <Button variant="link" onClick={() => fetchLessons(selectedSubject)} className="p-0 h-auto ml-2">Retry</Button>
              </AlertDescription>
            </Alert>
          )}
          
          {!isLoadingLessons && !lessonsError && lessons.length === 0 && (
            <p className="text-muted-foreground text-center py-8 text-lg">No lessons found for {selectedSubject} yet. Check back soon!</p>
          )}

          {!isLoadingLessons && !lessonsError && lessons.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.map((lessonName, index) => (
                <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="truncate">{lessonName}</CardTitle>
                    <CardDescription>DPPs for this lesson</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Select this lesson to view available Daily Practice Problems.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => toast({ title: "Coming Soon!", description: `DPPs for lesson "${lessonName}" will be available soon.`})}
                    >
                      <Edit3 className="mr-2 h-4 w-4" /> View DPPs
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
