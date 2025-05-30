// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getQuestionsByLessonAction, saveDppAttemptAction } from '@/app/auth/actions';
import type { QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import pb from '@/lib/pocketbase'; // Import client-side PocketBase instance

const difficultyColors: Record<QuestionDisplayInfo['difficulty'], string> = {
  Easy: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/70 dark:text-green-300 dark:border-green-700",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/70 dark:text-yellow-300 dark:border-yellow-700",
  Hard: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/70 dark:text-red-300 dark:border-red-700",
};

type AttemptedAnswersState = Record<string, {
    selectedOption: string | null;
    isCorrect: boolean | null;
    status: 'correct' | 'incorrect' | 'skipped' | 'unattempted';
}>;


export default function LessonQuestionsPage() {
  const router = useRouter();
  const paramsHook = useParams(); // Use a different name to avoid conflict with 'params' prop
  const { toast } = useToast();

  const subject = useMemo(() => paramsHook.subject ? decodeURIComponent(paramsHook.subject as string) : '', [paramsHook.subject]);
  const lessonName = useMemo(() => paramsHook.lesson ? decodeURIComponent(paramsHook.lesson as string) : '', [paramsHook.lesson]);

  const [questions, setQuestions] = useState<QuestionDisplayInfo[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attemptedAnswers, setAttemptedAnswers] = useState<AttemptedAnswersState>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setAnswerChecked(false);
    setIsCorrect(null);
  }, []);

  const fetchQuestions = useCallback(async () => {
    if (!subject || !lessonName) {
      setError("Subject or Lesson name is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setAttemptedAnswers({}); 
    try {
      const result = await getQuestionsByLessonAction(subject, lessonName);
      if (result.success && result.questions) {
        if (result.questions.length > 0) {
          setQuestions(result.questions);
          setCurrentQuestionIndex(0);
          resetQuestionState(); 
        } else {
          setQuestions([]);
          setError("No questions found for this lesson.");
        }
      } else {
        setError(result.message || "Failed to load questions.");
        toast({ title: "Error Loading Questions", description: result.message || "Could not load questions.", variant: "destructive" });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({ title: "Error", description: `Failed to fetch questions: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [subject, lessonName, toast, resetQuestionState]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleOptionSelect = (optionKey: string) => {
    if (answerChecked) return; 
    setSelectedOption(optionKey);
    setIsCorrect(null); 
    if (currentQuestion) {
        setAttemptedAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: { ...(prev[currentQuestion.id] || { status: 'unattempted', isCorrect: null}), selectedOption: optionKey }
        }));
    }
  };

 const triggerSaveAttempt = useCallback(async () => {
    console.log("[Client] triggerSaveAttempt called");
    
    const currentUserId = pb.authStore.model?.id;
    if (!currentUserId) {
        console.warn("[Client] User not logged in. Cannot save DPP attempt.");
        // Optionally show a toast, but primarily this is an anonymous attempt or error.
        // The server action will handle saving with userId: null if appropriate.
    }
    
    setIsSavingAttempt(true);
    let score = 0;
    const questionsAttemptedDetails: QuestionAttemptDetail[] = questions.map(q => {
        const attempt = attemptedAnswers[q.id];
        let status: QuestionAttemptDetail['status'] = 'unattempted';
        if (attempt) {
            if (attempt.isCorrect === true) { // Explicitly check for true
                score++;
                status = 'correct';
            } else if (attempt.selectedOption !== null && attempt.isCorrect === false) { // Explicitly check for false
                status = 'incorrect';
            } else if (attempt.selectedOption !== null && attempt.isCorrect === null) {
                // Answer selected but not checked - still "unattempted" in terms of correctness
                status = 'unattempted'; // Or a new 'attempted_not_checked' status if needed
            } else { 
                status = 'skipped'; 
            }
        }
        return {
            questionId: q.id,
            selectedOption: attempt?.selectedOption || null,
            isCorrect: attempt?.isCorrect || false, // Default to false if null
            status: status, 
        };
    });

    const payload: DppAttemptPayload = {
        userId: currentUserId || null, // Send null if user is not logged in
        subject,
        lessonName,
        questionsAttempted: questionsAttemptedDetails,
        score,
        totalQuestions: questions.length,
    };

    console.log("[DPP Attempt Client] Payload for save/update:", JSON.stringify(payload, null, 2));

    try {
        const result = await saveDppAttemptAction(payload);
        console.log("[DPP Attempt Client] Result from saveDppAttemptAction:", result);
        if (result.success) {
            toast({ title: "Attempt Saved!", description: result.message || "Your progress has been saved." });
        } else {
            toast({ title: "Save Failed", description: result.message || "Could not save your attempt. Please try again.", variant: "destructive" });
        }
    } catch (e) {
        const errMessage = e instanceof Error ? e.message : "An unexpected error occurred during save.";
        console.error("[DPP Attempt Client] Critical error calling saveDppAttemptAction:", e);
        toast({ title: "Save Error", description: errMessage, variant: "destructive" });
    } finally {
        setIsSavingAttempt(false);
    }
  }, [questions, attemptedAnswers, subject, lessonName, toast]);

  const handleCheckAnswer = async () => {
    if (!selectedOption || !currentQuestion) return;
    const correct = selectedOption === currentQuestion.correctOption;
    setAnswerChecked(true);
    setIsCorrect(correct);
    
    setAttemptedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption, // This should already be set by handleOptionSelect
        isCorrect: correct,
        status: correct ? 'correct' : 'incorrect',
      },
    }));
    
    await triggerSaveAttempt();
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      resetQuestionState();
    }
  };
  
  const formatPYQInfo = (pyqInfo?: PYQInfo): string => {
    if (!pyqInfo) return '';
    let parts = [];
    if (pyqInfo.examName) parts.push(pyqInfo.examName);
    if (pyqInfo.year) parts.push(pyqInfo.year);
    let dateAndShift = [];
    if (pyqInfo.date) dateAndShift.push(pyqInfo.date);
    if (pyqInfo.shift && pyqInfo.shift !== 'N/A') dateAndShift.push(pyqInfo.shift);
    if (dateAndShift.length > 0) parts.push(`(${dateAndShift.join(' ')})`);
    return parts.join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading questions for {lessonName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
         <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Questions</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="link" onClick={fetchQuestions} className="p-0 h-auto ml-2">Retry</Button>
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  if (!currentQuestion) {
     return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Alert className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Questions Available</AlertTitle>
          <AlertDescription>There are no questions currently available for this lesson.</AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const renderOption = (optionKey: string, text?: string, imageUrl?: string) => {
    const isSelected = selectedOption === optionKey;
    const isActualCorrect = currentQuestion.correctOption === optionKey;
    let optionStyle = "border-border hover:bg-muted/50 dark:hover:bg-muted/20";

    if (answerChecked) {
      if (isActualCorrect) {
        optionStyle = "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300";
      } else if (isSelected && !isCorrect) {
        optionStyle = "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300";
      } else {
        optionStyle = "border-border opacity-70"; 
      }
    } else if (isSelected) {
      optionStyle = "border-primary ring-2 ring-primary dark:ring-offset-background";
    }

    return (
      <Button
        key={optionKey}
        variant="outline"
        className={cn("w-full justify-start text-left h-auto py-3 px-4 whitespace-normal text-sm sm:text-base", optionStyle)}
        onClick={() => handleOptionSelect(optionKey)}
        disabled={answerChecked || isLoading || isSavingAttempt}
      >
        <span className="font-semibold mr-3">{optionKey}.</span>
        {text && <span className="whitespace-pre-wrap">{text}</span>}
        {imageUrl && (
          <div className="w-full flex justify-center my-1">
            <Image 
              src={imageUrl} 
              alt={`Option ${optionKey}`} 
              width={200} 
              height={120} 
              className="rounded-md border object-contain max-h-32 sm:max-h-40" 
              data-ai-hint="option diagram" 
            />
          </div>
        )}
      </Button>
    );
  };

  const optionsData = [
    { key: 'A', text: currentQuestion.optionAText, image: currentQuestion.optionAImage },
    { key: 'B', text: currentQuestion.optionBText, image: currentQuestion.optionBImage },
    { key: 'C', text: currentQuestion.optionCText, image: currentQuestion.optionCImage },
    { key: 'D', text: currentQuestion.optionDText, image: currentQuestion.optionDImage },
  ];

  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex items-center justify-between p-3 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dpps/${encodeURIComponent(subject)}`)} aria-label="Go back to lessons">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center flex-grow mx-2">
          <h1 className="text-md sm:text-lg md:text-xl font-semibold truncate" title={lessonName}>
            {lessonName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="w-10"> </div>
      </header>

      <ScrollArea className="flex-grow p-3 sm:p-4">
        <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-5">
          <Card className="shadow-md">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base sm:text-lg font-semibold">
                  Question {currentQuestionIndex + 1}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {currentQuestion.isPYQ && currentQuestion.pyqInfo && (
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      {formatPYQInfo(currentQuestion.pyqInfo)}
                    </Badge>
                  )}
                  <Badge variant="outline" className={`${difficultyColors[currentQuestion.difficulty]} text-xs`}>
                    {currentQuestion.difficulty}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base">
              {currentQuestion.questionText && (
                <p className="leading-relaxed whitespace-pre-wrap">{currentQuestion.questionText}</p>
              )}
              {currentQuestion.questionImage && (
                <div className="my-3 flex justify-center">
                  <Image 
                    src={currentQuestion.questionImage} 
                    alt="Question Image" 
                    width={500} 
                    height={350} 
                    className="rounded-md border object-contain max-h-[250px] sm:max-h-[350px] w-auto" 
                    data-ai-hint="question illustration"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="text-base sm:text-lg">Options</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {optionsData.map(opt => {
                if (currentQuestion.optionsFormat === 'image_options' && opt.image) {
                  return renderOption(opt.key, undefined, opt.image);
                } else if ((currentQuestion.optionsFormat === 'text_options' || !currentQuestion.optionsFormat) && opt.text) {
                  // Ensure text options are rendered if optionsFormat is 'text_options' or if it's undefined (as a fallback)
                  return renderOption(opt.key, opt.text, (currentQuestion.optionsFormat === 'image_options' && opt.image) ? opt.image : undefined);
                } else if(currentQuestion.optionsFormat === 'image_options' && !opt.image && opt.text) {
                     // Fallback for image_options format where an image might be missing but text is present
                     return renderOption(opt.key, opt.text);
                }
                return null;
              })}
               {optionsData.every(opt => 
                    !(opt.text && (currentQuestion.optionsFormat === 'text_options' || !currentQuestion.optionsFormat)) &&
                    !(opt.image && currentQuestion.optionsFormat === 'image_options')
                ) && (
                 <p className="text-muted-foreground text-xs">Options not available for the current format.</p>
               )}
            </CardContent>
          </Card>
          
          {!answerChecked && (
            <Button 
              onClick={handleCheckAnswer} 
              disabled={!selectedOption || isLoading || isSavingAttempt} 
              className="w-full text-base sm:text-lg py-3"
              size="lg"
            >
              {isSavingAttempt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Check Answer")}
            </Button>
          )}

          {answerChecked && (
            <Card className={cn(
              "shadow-md border-2",
              isCorrect ? "border-green-500 dark:border-green-600" : "border-red-500 dark:border-red-600"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center text-lg sm:text-xl",
                  isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {isCorrect ? <CheckCircle2 className="mr-2 h-6 w-6" /> : <XCircle className="mr-2 h-6 w-6" />}
                  {isCorrect ? "Correct!" : "Incorrect"}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  The correct answer is: <span className="font-semibold">{currentQuestion.correctOption}</span>
                </CardDescription>
              </CardHeader>
              {(currentQuestion.explanationText || currentQuestion.explanationImage) && (
                <CardContent className="space-y-2 text-sm sm:text-base">
                  <h4 className="font-semibold text-md sm:text-lg flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-yellow-400 dark:text-yellow-500"/>Explanation:</h4>
                  {currentQuestion.explanationText && <p className="whitespace-pre-wrap">{currentQuestion.explanationText}</p>}
                  {currentQuestion.explanationImage && (
                    <div className="my-3 flex justify-center">
                      <Image 
                        src={currentQuestion.explanationImage} 
                        alt="Explanation Image" 
                        width={450} 
                        height={300} 
                        className="rounded-md border object-contain max-h-[200px] sm:max-h-[300px] w-auto" 
                        data-ai-hint="solution diagram"
                      />
                    </div>
                  )}
                </CardContent>
              )}
               {!currentQuestion.explanationText && !currentQuestion.explanationImage && (
                 <CardContent>
                    <p className="text-xs text-muted-foreground">No detailed explanation available for this question.</p>
                 </CardContent>
               )}
            </Card>
          )}
        </div>
      </ScrollArea>

      <footer className="flex items-center justify-between p-3 border-t sticky bottom-0 bg-background z-10">
        <Button 
          variant="outline" 
          onClick={handlePreviousQuestion} 
          disabled={currentQuestionIndex === 0 || isLoading || isSavingAttempt}
          className="px-3 sm:px-4 py-2 text-sm sm:text-base"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          {questions.length > 0 ? `${currentQuestionIndex + 1} / ${questions.length}` : '0 / 0'}
        </div>
        <Button 
            onClick={handleNextQuestion} 
            disabled={isLastQuestion || (!answerChecked && questions.length > 1) || isLoading || isSavingAttempt}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base"
        >
            Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}

    
