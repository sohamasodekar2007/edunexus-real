
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getQuestionsByLessonAction } from '@/app/auth/actions';
import type { QuestionDisplayInfo, PYQInfo } from '@/types';
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
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';

const difficultyColors: Record<QuestionDisplayInfo['difficulty'], string> = {
  Easy: "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Hard: "bg-red-100 text-red-700 border-red-300",
};

export default function LessonQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const subject = useMemo(() => params.subject ? decodeURIComponent(params.subject as string) : '', [params.subject]);
  const lessonName = useMemo(() => params.lesson ? decodeURIComponent(params.lesson as string) : '', [params.lesson]);

  const [questions, setQuestions] = useState<QuestionDisplayInfo[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null); // 'A', 'B', 'C', 'D'
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

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
        if (result.questions.length > 0) {
          setQuestions(result.questions);
          setCurrentQuestionIndex(0); // Reset to first question
        } else {
          setQuestions([]);
          setError("No questions found for this lesson.");
        }
      } else {
        setError(result.message || "Failed to load questions.");
        toast({ title: "Error", description: result.message || "Could not load questions.", variant: "destructive" });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({ title: "Error", description: `Failed to fetch questions: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [subject, lessonName, toast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleOptionSelect = (optionKey: string) => {
    if (answerChecked) return; // Don't allow changing selection after checking
    setSelectedOption(optionKey);
    setIsCorrect(null); // Reset correctness when a new option is selected
  };

  const handleCheckAnswer = () => {
    if (!selectedOption || !currentQuestion) return;
    setAnswerChecked(true);
    setIsCorrect(selectedOption === currentQuestion.correctOption);
  };

  const resetQuestionState = () => {
    setSelectedOption(null);
    setAnswerChecked(false);
    setIsCorrect(null);
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

  const getOptionKey = (index: number): string => ['A', 'B', 'C', 'D'][index];

  const renderOption = (optionKey: string, text?: string, imageUrl?: string) => {
    const isSelected = selectedOption === optionKey;
    const isActualCorrect = currentQuestion.correctOption === optionKey;
    let optionStyle = "border-border hover:bg-muted/50"; // Default

    if (answerChecked) {
      if (isActualCorrect) {
        optionStyle = "bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300";
      } else if (isSelected && !isCorrect) {
        optionStyle = "bg-red-100 border-red-500 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300";
      }
    } else if (isSelected) {
      optionStyle = "border-primary ring-2 ring-primary";
    }

    return (
      <Button
        key={optionKey}
        variant="outline"
        className={cn("w-full justify-start text-left h-auto py-3 px-4 whitespace-normal", optionStyle)}
        onClick={() => handleOptionSelect(optionKey)}
        disabled={answerChecked}
      >
        <span className="font-semibold mr-3">{optionKey}.</span>
        {text && <span className="whitespace-pre-wrap">{text}</span>}
        {imageUrl && (
          <Image 
            src={imageUrl} 
            alt={`Option ${optionKey}`} 
            width={150} 
            height={100} 
            className="ml-2 rounded-md border object-contain max-h-24"
            data-ai-hint="option diagram" 
          />
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
  
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dpps/${encodeURIComponent(subject)}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center flex-grow">
          <h1 className="text-lg md:text-xl font-semibold truncate max-w-xs sm:max-w-sm md:max-w-md mx-auto" title={lessonName}>
            {lessonName}
          </h1>
          <p className="text-xs text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="w-10"> {/* Spacer to balance back button */} </div>
      </header>

      {/* Main Content Area */}
      <ScrollArea className="flex-grow p-2 md:p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Question Card */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-md md:text-lg font-semibold">
                  Question {currentQuestionIndex + 1}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
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
            <CardContent className="space-y-3 text-sm md:text-base">
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
                    className="rounded-md border object-contain max-h-[350px] w-auto" 
                    data-ai-hint="question illustration"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card className="shadow-md">
            <CardHeader><CardTitle className="text-md">Options</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.optionsFormat === 'text_options' || (!currentQuestion.optionsFormat && optionsData.some(opt => opt.text)) ? (
                optionsData.map(opt => opt.text ? renderOption(opt.key, opt.text) : null)
              ) : currentQuestion.optionsFormat === 'image_options' ? (
                optionsData.map(opt => opt.image ? renderOption(opt.key, undefined, opt.image) : null)
              ) : (
                <p className="text-muted-foreground text-xs">Options not available or format unclear.</p>
              )}
            </CardContent>
          </Card>
          
          {/* Check Answer Button */}
          {!answerChecked && (
            <Button 
              onClick={handleCheckAnswer} 
              disabled={!selectedOption || answerChecked} 
              className="w-full text-md py-3"
              size="lg"
            >
              Check Answer
            </Button>
          )}

          {/* Feedback and Explanation */}
          {answerChecked && (
            <Card className={cn(
              "shadow-md border-2",
              isCorrect ? "border-green-500" : "border-red-500"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center text-lg",
                  isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {isCorrect ? <CheckCircle2 className="mr-2 h-6 w-6" /> : <XCircle className="mr-2 h-6 w-6" />}
                  {isCorrect ? "Correct!" : "Incorrect"}
                </CardTitle>
                <CardDescription>
                  The correct answer is: <span className="font-semibold">{currentQuestion.correctOption}</span>
                </CardDescription>
              </CardHeader>
              {(currentQuestion.explanationText || currentQuestion.explanationImage) && (
                <CardContent className="space-y-2 text-sm md:text-base">
                  <h4 className="font-semibold text-md flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-yellow-500"/>Explanation:</h4>
                  {currentQuestion.explanationText && <p className="whitespace-pre-wrap">{currentQuestion.explanationText}</p>}
                  {currentQuestion.explanationImage && (
                    <div className="my-3 flex justify-center">
                      <Image 
                        src={currentQuestion.explanationImage} 
                        alt="Explanation Image" 
                        width={400} 
                        height={250} 
                        className="rounded-md border object-contain max-h-[250px] w-auto" 
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

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between p-3 border-t sticky bottom-0 bg-background z-10">
        <Button 
          variant="outline" 
          onClick={handlePreviousQuestion} 
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          {currentQuestionIndex + 1} / {questions.length}
        </div>
        <Button 
          onClick={handleNextQuestion} 
          disabled={currentQuestionIndex === questions.length - 1 || !answerChecked && questions.length > 1}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}
