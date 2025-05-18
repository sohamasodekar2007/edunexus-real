'use client';
import { useState, useEffect } from 'react';
import type { Test, Question, BookmarkedQuestion } from '@/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { mockTests, LOCAL_STORAGE_KEYS } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookCheck, Clock, ListChecks, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TestSeriesPage() {
  const [tests, setTests] = useLocalStorage<Test[]>(LOCAL_STORAGE_KEYS.tests, mockTests);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useLocalStorage<BookmarkedQuestion[]>(LOCAL_STORAGE_KEYS.bookmarkedQuestions, []);
  const { toast } = useToast();

  const toggleBookmark = (question: Question, test: Test) => {
    const existingBookmark = bookmarkedQuestions.find(bq => bq.questionId === question.id && bq.sourceId === test.id && bq.sourceType === 'test');
    if (existingBookmark) {
      setBookmarkedQuestions(prev => prev.filter(bq => bq.id !== existingBookmark.id));
      toast({ title: "Bookmark Removed", description: `"${question.text.substring(0,30)}..." removed from notebook.` });
    } else {
      const newBookmark: BookmarkedQuestion = {
        id: `${test.id}-${question.id}-${Date.now()}`,
        questionId: question.id,
        questionText: question.text,
        sourceId: test.id,
        sourceType: 'test',
      };
      setBookmarkedQuestions(prev => [...prev, newBookmark]);
      toast({ title: "Bookmarked!", description: `"${question.text.substring(0,30)}..." added to notebook.` });
    }
  };

  const isBookmarked = (questionId: string, testId: string) => {
    return bookmarkedQuestions.some(bq => bq.questionId === questionId && bq.sourceId === testId && bq.sourceType === 'test');
  };
  
  const chapterwiseTests = tests.filter(test => test.type === 'chapterwise');
  const fullLengthTests = tests.filter(test => test.type === 'full-length');

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Test Series</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center"><ListChecks className="mr-2 h-6 w-6 text-accent" />Chapterwise Tests</h2>
        {chapterwiseTests.length === 0 ? <p className="text-muted-foreground">No chapterwise tests available yet.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chapterwiseTests.map((test) => (
              <Card key={test.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription>
                    {test.subject ? <Badge variant="secondary" className="mr-2">{test.subject}</Badge> : null}
                    {test.questions.length} Questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">
                    Focus on specific chapters to strengthen your understanding.
                  </p>
                  {test.durationMinutes && (
                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                      <Clock className="mr-1 h-4 w-4" /> {test.durationMinutes} minutes
                    </div>
                  )}
                   <h4 className="font-medium mb-2 mt-4">Sample Questions:</h4>
                    <ul className="space-y-2 text-sm">
                      {test.questions.slice(0, 2).map(q => (
                        <li key={q.id} className="flex justify-between items-start">
                          <span className="truncate pr-2" title={q.text}>{q.text.substring(0,50)}{q.text.length > 50 ? '...' : ''}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => toggleBookmark(q, test)}
                            aria-label={isBookmarked(q.id, test.id) ? "Remove bookmark" : "Add bookmark"}
                          >
                            {isBookmarked(q.id, test.id) ? <BookCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </li>
                      ))}
                    </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Start Test</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 flex items-center"><Brain className="mr-2 h-6 w-6 text-accent" />Full-Length Mock Tests</h2>
         {fullLengthTests.length === 0 ? <p className="text-muted-foreground">No full-length tests available yet.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fullLengthTests.map((test) => (
              <Card key={test.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription>{test.questions.length} Questions</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">
                    Simulate the complete exam experience with our full-length mock tests.
                  </p>
                  {test.durationMinutes && (
                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                      <Clock className="mr-1 h-4 w-4" /> {test.durationMinutes} minutes
                    </div>
                  )}
                  <h4 className="font-medium mb-2 mt-4">Sample Questions:</h4>
                    <ul className="space-y-2 text-sm">
                      {test.questions.slice(0, 2).map(q => (
                        <li key={q.id} className="flex justify-between items-start">
                          <span className="truncate pr-2" title={q.text}>{q.text.substring(0,50)}{q.text.length > 50 ? '...' : ''}</span>
                           <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => toggleBookmark(q, test)}
                            aria-label={isBookmarked(q.id, test.id) ? "Remove bookmark" : "Add bookmark"}
                          >
                            {isBookmarked(q.id, test.id) ? <BookCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </li>
                      ))}
                    </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Start Test</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
         )}
      </section>
    </div>
  );
}
