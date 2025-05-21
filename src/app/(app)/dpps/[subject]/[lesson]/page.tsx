
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getQuestionsByLessonAction } from '@/app/auth/actions';
import type { QuestionDisplayInfo, PYQInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  HelpCircle, // Placeholder for Quiz icon
  BarChart3,  // Placeholder for Analysis icon
  Filter,
  ListFilter, // Placeholder for Sort icon
  Eye,
  EyeOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns'; // For PYQ date formatting if needed

const difficultyColors = {
  Easy: "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Hard: "bg-red-100 text-red-700 border-red-300",
};

type DifficultyFilter = "All" | "Easy" | "Medium" | "Hard";

export default function LessonQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const subject = useMemo(() => params.subject ? decodeURIComponent(params.subject as string) : '', [params.subject]);
  const lessonName = useMemo(() => params.lesson ? decodeURIComponent(params.lesson as string) : '', [params.lesson]);

  const [questions, setQuestions] = useState<QuestionDisplayInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDifficultyFilter, setActiveDifficultyFilter] = useState<DifficultyFilter>("All");
  const [showExplanationFor, setShowExplanationFor] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!subject || !lessonName) {
        setError("Subject or Lesson name is missing.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getQuestionsByLessonAction(subject, lessonName);
      if (result.success && result.questions) {
        setQuestions(result.questions);
      } else {
        setError(result.message || "Failed to load questions.");
        toast({ title: "Error", description: result.message || "Could not load questions for this lesson.", variant: "destructive" });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({ title: "Error", description: `Failed to fetch questions: ${errorMessage}`, variant: "destructive" });
      console.error("Critical error fetching questions:", e);
    } finally {
      setIsLoading(false);
    }
  }, [subject, lessonName, toast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    if (activeDifficultyFilter === "All") {
      return questions;
    }
    return questions.filter(q => q.difficulty === activeDifficultyFilter);
  }, [questions, activeDifficultyFilter]);

  const toggleExplanation = (questionId: string) => {
    setShowExplanationFor(prev => (prev === questionId ? null : questionId));
  };

  const getOptionLabel = (index: number) => ['A', 'B', 'C', 'D'][index];

  const formatPYQInfo = (pyqInfo?: PYQInfo): string => {
    if (!pyqInfo) return '';
    let parts = [];
    if (pyqInfo.examName) parts.push(pyqInfo.examName);
    if (pyqInfo.year) parts.push(pyqInfo.year);
    let dateAndShift = [];
    if (pyqInfo.date) dateAndShift.push(pyqInfo.date); // Assumes date is already formatted
    if (pyqInfo.shift && pyqInfo.shift !== 'N/A') dateAndShift.push(pyqInfo.shift);
    if (dateAndShift.length > 0) parts.push(`(${dateAndShift.join(' ')})`);
    return parts.join(' ');
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading questions for {lessonName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
         <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Questions</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="link" onClick={fetchQuestions} className="p-0 h-auto ml-2">Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-2 md:px-4 flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 p-2 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-grow text-center">
          <h1 className="text-xl md:text-2xl font-bold truncate max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto" title={lessonName}>
            {lessonName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {questions.length} Questions | 0 Solved | 0% Accuracy
          </p>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-auto"><HelpCircle className="mr-1 h-3 w-3" />Quiz</Button>
          <Button variant="ghost" size="icon"><Bookmark className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><BarChart3 className="h-5 w-5" /></Button>
        </div>
      </header>

      {/* Tabs & Filters */}
      <Tabs defaultValue="all-questions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="all-questions">All Questions</TabsTrigger>
          <TabsTrigger value="topic-wise" disabled>Topic-Wise (Soon)</TabsTrigger>
        </TabsList>
        <TabsContent value="all-questions">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-sm font-medium mr-2 shrink-0">Difficulty:</span>
              {(["All", "Easy", "Medium", "Hard"] as DifficultyFilter[]).map(diff => (
                <Button
                  key={diff}
                  variant={activeDifficultyFilter === diff ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveDifficultyFilter(diff)}
                  className="text-xs px-2 py-1 h-auto shrink-0"
                >
                  {diff}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-auto mt-2 sm:mt-0 shrink-0">
                <ListFilter className="mr-1 h-3 w-3" /> Sort (Soon)
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-3 px-2">
            Showing {filteredQuestions.length} of {questions.length} questions
            {activeDifficultyFilter !== "All" && ` (Difficulty: ${activeDifficultyFilter})`}
          </p>

          {/* Question List */}
          {filteredQuestions.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-8">
              No questions match the current filter for "{lessonName}".
            </p>
          )}

          <ScrollArea className="h-[calc(100vh-20rem)] md:h-[calc(100vh-18rem)]"> {/* Adjust height as needed */}
            <div className="space-y-4 p-1">
              {filteredQuestions.map((q, index) => (
                <Card key={q.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base font-semibold">Question {index + 1}</CardTitle>
                        <div className="flex items-center gap-2">
                           {q.isPYQ && q.pyqInfo && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {formatPYQInfo(q.pyqInfo)}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`${difficultyColors[q.difficulty]} text-xs`}>
                            {q.difficulty}
                          </Badge>
                        </div>

                    </div>

                  </CardHeader>
                  <CardContent className="space-y-3">
                    {q.questionText && <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.questionText}</p>}
                    {q.questionImage && (
                      <div className="my-2 flex justify-center">
                        <Image src={q.questionImage} alt="Question Image" width={400} height={300} className="rounded-md border object-contain max-h-80" data-ai-hint="question diagram physics" />
                      </div>
                    )}

                    {/* Options */}
                    <div className="space-y-2 text-sm">
                      {q.optionsFormat === 'text_options' || (!q.optionsFormat && (q.optionAText || q.optionBText || q.optionCText || q.optionDText) ) ? ( // Default to text if optionsFormat not set but text options exist
                        (['A', 'B', 'C', 'D'] as const).map((opt, optIndex) => {
                          const optionTextKey = `option${opt}Text` as keyof QuestionDisplayInfo;
                          const optionText = q[optionTextKey] as string | undefined;
                          if (!optionText) return null;
                          return (
                            <div
                              key={opt}
                              className={`p-2 border rounded-md flex items-center ${
                                showExplanationFor === q.id && q.correctOption === opt
                                  ? 'bg-green-100 dark:bg-green-900 border-green-500'
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <span className="font-semibold mr-2">{opt}.</span>
                              <span className="whitespace-pre-wrap">{optionText}</span>
                            </div>
                          );
                        })
                      ) : q.optionsFormat === 'image_options' ? (
                         (['A', 'B', 'C', 'D'] as const).map((opt, optIndex) => {
                          const optionImageKey = `option${opt}Image` as keyof QuestionDisplayInfo;
                          const optionImage = q[optionImageKey] as string | undefined;
                           if (!optionImage) return null;
                          return (
                            <div
                              key={opt}
                              className={`p-2 border rounded-md ${
                                showExplanationFor === q.id && q.correctOption === opt
                                  ? 'bg-green-100 dark:bg-green-900 border-green-500'
                                  : ''
                              }`}
                            >
                              <span className="font-semibold mr-2">{opt}.</span>
                              <Image src={optionImage} alt={`Option ${opt} Image`} width={200} height={150} className="rounded-md border object-contain max-h-40 inline-block" data-ai-hint="option diagram physics" />
                            </div>
                          );
                        })
                      ) : <p className="text-muted-foreground text-xs">Options not available or format unclear.</p>}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExplanation(q.id)}
                      className="text-xs mt-2"
                    >
                      {showExplanationFor === q.id ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                      {showExplanationFor === q.id ? "Hide Solution" : "View Solution"}
                    </Button>

                    {showExplanationFor === q.id && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-md border-l-4 border-primary space-y-2">
                        <h4 className="font-semibold text-sm">Explanation:</h4>
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Correct Option: {q.correctOption}</p>
                        {q.explanationText && <p className="text-sm whitespace-pre-wrap">{q.explanationText}</p>}
                        {q.explanationImage && (
                          <div className="my-2 flex justify-center">
                             <Image src={q.explanationImage} alt="Explanation Image" width={300} height={200} className="rounded-md border object-contain max-h-72" data-ai-hint="solution diagram physics" />
                          </div>
                        )}
                        {!q.explanationText && !q.explanationImage && <p className="text-xs text-muted-foreground">No detailed explanation available.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
