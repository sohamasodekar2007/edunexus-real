
'use client';
import { useState, useEffect, useCallback } from 'react';
// Removed Dpp, Question, BookmarkedQuestion types as they are not used now
// import type { Dpp, Question, BookmarkedQuestion } from '@/types'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bookmark, 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Atom, 
  FlaskConical, 
  Sigma, 
  Leaf,
  BookOpen, // Generic icon for lessons
  Filter,
  ArrowUpDown, // For Sort
  BarChart3, // For stats icon
  Palette, // Example lesson icon 1
  Component, // Example lesson icon 2
  Cpu, // Example lesson icon 3
  Database, // Example lesson icon 4
  FunctionSquare, // Example lesson icon 5
  GitBranch // Example lesson icon 6
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLessonsBySubjectAction } from '@/app/auth/actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { LucideIcon } from 'lucide-react';

interface SubjectInfo {
  name: string;
  icon: LucideIcon;
  dataAiHint: string;
  colorClass: string; // For icon color
}

const subjects: SubjectInfo[] = [
  { name: 'Physics', icon: Atom, dataAiHint: "physics science", colorClass: "text-orange-500" },
  { name: 'Chemistry', icon: FlaskConical, dataAiHint: "chemistry lab", colorClass: "text-green-500" },
  { name: 'Mathematics', icon: Sigma, dataAiHint: "math symbols", colorClass: "text-blue-500" },
  { name: 'Biology', icon: Leaf, dataAiHint: "biology nature", colorClass: "text-emerald-500" },
];

// Placeholder icons for lessons, add more as needed
const lessonIcons: LucideIcon[] = [
  FunctionSquare, Palette, Component, Cpu, Database, GitBranch, BookOpen
];

export default function DppsPage() {
  const { toast } = useToast();

  const [selectedSubject, setSelectedSubject] = useState<SubjectInfo | null>(null);
  const [lessons, setLessons] = useState<string[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const fetchLessons = useCallback(async (subjectName: string) => {
    if (!subjectName) return;
    setIsLoadingLessons(true);
    setLessonsError(null);
    setLessons([]);
    try {
      const result = await getLessonsBySubjectAction(subjectName);
      if (result.success && result.lessons) {
        setLessons(result.lessons);
      } else {
        setLessonsError(result.message || "Failed to load lessons for this subject.");
        toast({
          title: "Error Fetching Lessons",
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
      fetchLessons(selectedSubject.name);
    } else {
      setLessons([]);
      setLessonsError(null);
    }
  }, [selectedSubject, fetchLessons]);


  if (!selectedSubject) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-3xl font-bold mb-8 text-primary">Select a Subject for DPPs</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {subjects.map((subject) => (
            <Card
              key={subject.name}
              className="shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer group"
              onClick={() => setSelectedSubject(subject)}
              data-ai-hint={subject.dataAiHint}
            >
              <CardHeader className="items-center text-center">
                <subject.icon className={`h-16 w-16 ${subject.colorClass} group-hover:scale-110 transition-transform mb-3`} />
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
      </div>
    );
  }

  // Display when a subject is selected
  const CurrentSubjectIcon = selectedSubject.icon;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 flex flex-col h-full">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <CurrentSubjectIcon className={`h-8 w-8 ${selectedSubject.colorClass}`} />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{selectedSubject.name}</h1>
            <p className="text-sm text-muted-foreground">
              {lessons.length > 0 ? `${lessons.length} Lessons` : (isLoadingLessons ? 'Loading lessons...' : 'No lessons found')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden md:inline-flex">
            <Bookmark className="mr-2 h-4 w-4" /> View Bookmarked Qs
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hidden md:inline-flex">
            <Bookmark className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hidden md:inline-flex">
            <BarChart3 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Lessons Grid or Loading/Error State */}
      <div className="flex-grow overflow-y-auto pb-16"> {/* Padding bottom for action bar */}
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
              <Button variant="link" onClick={() => fetchLessons(selectedSubject.name)} className="p-0 h-auto ml-2">Retry</Button>
            </AlertDescription>
          </Alert>
        )}
        
        {!isLoadingLessons && !lessonsError && lessons.length === 0 && (
          <p className="text-muted-foreground text-center py-8 text-lg">No lessons found for {selectedSubject.name} yet. Check back soon!</p>
        )}

        {!isLoadingLessons && !lessonsError && lessons.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lessonName, index) => {
              const LessonIcon = lessonIcons[index % lessonIcons.length]; // Cycle through placeholder icons
              return (
                <Card 
                  key={index} 
                  className="shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => toast({ title: "Coming Soon!", description: `DPPs for lesson "${lessonName}" will be available soon.`})}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <LessonIcon className={`h-8 w-8 ${selectedSubject.colorClass || 'text-primary'} opacity-70`} />
                    <div>
                      <h3 className="font-semibold text-md leading-tight">{lessonName}</h3>
                      {/* Placeholder for question count, can be added later */}
                      {/* <p className="text-xs text-muted-foreground mt-1">XX Qs</p> */}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Action Bar - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 md:ml-60 lg:ml-64 xl:ml-72  bg-background/95 backdrop-blur-sm border-t p-3 z-10"> {/* Adjust ml based on sidebar width */}
        <div className="container mx-auto flex justify-around items-center">
          <Button variant="ghost" className="flex-1 justify-center text-muted-foreground hover:text-primary">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <div className="h-6 border-l mx-2"></div>
          <Button variant="ghost" className="flex-1 justify-center text-muted-foreground hover:text-primary">
            <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
          </Button>
        </div>
      </div>
    </div>
  );
}

