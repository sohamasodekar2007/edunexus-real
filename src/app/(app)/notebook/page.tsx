'use client';
import { useState, useEffect } from 'react';
import type { BookmarkedQuestion } from '@/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { mockBookmarkedQuestions, LOCAL_STORAGE_KEYS } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NotebookPage() {
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkedQuestion[]>(LOCAL_STORAGE_KEYS.bookmarkedQuestions, mockBookmarkedQuestions);
  const { toast } = useToast();

  const removeBookmark = (bookmarkId: string) => {
    const removedBookmark = bookmarks.find(b => b.id === bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    if (removedBookmark) {
      toast({ title: "Bookmark Removed", description: `"${removedBookmark.questionText.substring(0,30)}..." removed from notebook.` });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">My Notebook</h1>
      {bookmarks.length === 0 ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="mr-2 h-6 w-6 text-accent" />
              Notebook is Empty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You haven't bookmarked any questions yet. Bookmark questions from Test Series or DPPs to review them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {bookmarks.map((bookmark) => (
            <Card key={bookmark.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{bookmark.questionText}</CardTitle>
                  <CardDescription className="mt-1">
                    Bookmarked from: <Badge variant={bookmark.sourceType === 'test' ? 'default' : 'secondary'}>{bookmark.sourceType === 'test' ? 'Test' : 'DPP'}</Badge> (ID: {bookmark.sourceId})
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeBookmark(bookmark.id)}
                  aria-label="Remove bookmark"
                  className="text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                {/* Placeholder for more question details or "View Source" button */}
                <Button variant="outline" size="sm">View Original Question (Coming Soon)</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
