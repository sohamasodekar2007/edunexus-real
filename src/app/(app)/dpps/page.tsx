
'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card'; // Removed CardDescription, CardFooter, CardHeader
import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge'; // No longer used in this simplified view
import { 
  Bookmark, 
  ArrowLeft, 
  // ChevronRight, // No longer used in this simplified view
  Loader2, 
  AlertCircle,
  Atom, 
  FlaskConical, 
  Sigma, 
  Leaf,
  BookOpen,
  Filter,
  ArrowUpDown, 
  BarChart3, 
  Palette, 
  Component, 
  Cpu, 
  Database, 
  FunctionSquare, 
  GitBranch
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLessonsBySubjectAction } from '@/app/auth/actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { LucideIcon } from 'lucide-react';

interface SubjectInfo {
  name: string;
  icon: LucideIcon;
  dataAiHint: string;
  colorClass: string; 
}

const subjects: SubjectInfo[] = [
  { name: 'Physics', icon: Atom, dataAiHint: "physics science", colorClass: "text-orange-500" },
  { name: 'Chemistry', icon: FlaskConical, dataAiHint: "chemistry lab", colorClass: "text-green-500" },
  { name: 'Mathematics', icon: Sigma, dataAiHint: "math symbols", colorClass: "text-blue-500" },
  { name: 'Biology', icon: Leaf, dataAiHint: "biology nature", colorClass: "text-emerald-500" },
];

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
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Daily Practice Problems
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Choose a subject to view available lessons and practice sets.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {subjects.map((subject) => (
            <Card
              key={subject.name}
              className="group transform cursor-pointer overflow-hidden rounded-xl border bg-card shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-primary"
              onClick={() => setSelectedSubject(subject)}
              data-ai-hint={subject.dataAiHint}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-3 text-center">
                <div className={`rounded-full p-3 sm:p-4 bg-primary/10 group-hover:bg-primary/20 transition-colors`}>
                  <subject.icon className={`h-10 w-10 sm:h-12 md:h-16 ${subject.colorClass} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                <CardTitle className="text-md sm:text-lg font-semibold text-card-foreground">{subject.name}</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground px-2">
                  View DPPs for {subject.name}.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Display when a subject is selected - This part remains unchanged from previous advanced UI update
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
              const LessonIcon = lessonIcons[index % lessonIcons.length]; 
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
