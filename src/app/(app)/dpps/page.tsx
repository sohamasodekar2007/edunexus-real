
'use client';
import { useState, useEffect } from 'react';
import type { Dpp, Question, BookmarkedQuestion } from '@/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { mockDpps, LOCAL_STORAGE_KEYS } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookCheck, CalendarDays, Edit3, Atom, FlaskConical, Sigma, Leaf, ArrowLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const subjects = [
  { name: 'Physics', icon: Atom, dataAiHint: "physics science" },
  { name: 'Chemistry', icon: FlaskConical, dataAiHint: "chemistry lab" },
  { name: 'Mathematics', icon: Sigma, dataAiHint: "math symbols" },
  { name: 'Biology', icon: Leaf, dataAiHint: "biology nature" },
];

export default function DppsPage() {
  const [dpps, setDpps] = useLocalStorage<Dpp[]>(LOCAL_STORAGE_KEYS.dpps, mockDpps);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useLocalStorage<BookmarkedQuestion[]>(LOCAL_STORAGE_KEYS.bookmarkedQuestions, []);
  const { toast } = useToast();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const toggleBookmark = (question: Question, dpp: Dpp) => {
    const existingBookmark = bookmarkedQuestions.find(bq => bq.questionId === question.id && bq.sourceId === dpp.id && bq.sourceType === 'dpp');
    if (existingBookmark) {
      setBookmarkedQuestions(prev => prev.filter(bq => bq.id !== existingBookmark.id));
      toast({ title: "Bookmark Removed", description: `"${question.text.substring(0,30)}..." removed from notebook.` });
    } else {
      const newBookmark: BookmarkedQuestion = {
        id: `${dpp.id}-${question.id}-${Date.now()}`,
        questionId: question.id,
        questionText: question.text,
        sourceId: dpp.id,
        sourceType: 'dpp',
      };
      setBookmarkedQuestions(prev => [...prev, newBookmark]);
      toast({ title: "Bookmarked!", description: `"${question.text.substring(0,30)}..." added to notebook.` });
    }
  };

  const isBookmarked = (questionId: string, dppId: string) => {
    return bookmarkedQuestions.some(bq => bq.questionId === questionId && bq.sourceId === dppId && bq.sourceType === 'dpp');
  };

  const filteredDpps = selectedSubject ? dpps.filter(dpp => dpp.subject === selectedSubject) : [];

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
            <h1 className="text-3xl font-bold text-primary">DPPs for {selectedSubject}</h1>
            <Button variant="outline" onClick={() => setSelectedSubject(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
            </Button>
          </div>

          {filteredDpps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No DPPs available for {selectedSubject} yet. Check back soon!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDpps.map((dpp) => (
                <Card key={dpp.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle>{dpp.title}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center"><CalendarDays className="mr-1 h-4 w-4" /> {format(new Date(dpp.date), 'MMMM d, yyyy')}</span>
                      {dpp.subject && <Badge variant="outline">{dpp.subject}</Badge>}
                      <span>{dpp.problems.length} Problems</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground mb-4">
                      Stay sharp with these daily challenges.
                    </p>
                    <h4 className="font-medium mb-2">Sample Problems:</h4>
                    <ul className="space-y-2 text-sm">
                      {dpp.problems.slice(0, 2).map(problem => (
                        <li key={problem.id} className="flex justify-between items-start">
                          <span className="truncate pr-2" title={problem.text}>{problem.text.substring(0,50)}{problem.text.length > 50 ? '...' : ''}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => toggleBookmark(problem, dpp)}
                            aria-label={isBookmarked(problem.id, dpp.id) ? "Remove bookmark" : "Add bookmark"}
                          >
                            {isBookmarked(problem.id, dpp.id) ? <BookCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </li>
                      ))}
                       {dpp.problems.length === 0 && <li className="text-muted-foreground">No sample problems in this DPP.</li>}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">
                      <Edit3 className="mr-2 h-4 w-4" /> Start Solving
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
