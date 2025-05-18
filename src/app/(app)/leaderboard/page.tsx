'use client';
import { useState, useEffect } from 'react';
import type { LeaderboardEntry } from '@/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { mockLeaderboard, LOCAL_STORAGE_KEYS } from '@/lib/mock-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Star } from 'lucide-react';
import Image from 'next/image';


export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useLocalStorage<LeaderboardEntry[]>(LOCAL_STORAGE_KEYS.leaderboard, mockLeaderboard);

  // Sort by score descending, then by name ascending for tie-breaking
  const sortedLeaderboard = [...leaderboardData].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  }).map((entry, index) => ({ ...entry, rank: index + 1 }));


  const getRankColor = (rank: number | undefined) => {
    if (rank === 1) return 'text-yellow-500'; // Gold
    if (rank === 2) return 'text-gray-400'; // Silver
    if (rank === 3) return 'text-orange-400'; // Bronze
    return 'text-foreground';
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center bg-gradient-to-r from-primary via-accent to-primary/70 rounded-t-lg p-6">
          <div className="flex justify-center items-center mb-2">
            <Trophy className="h-12 w-12 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary-foreground">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedLeaderboard.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
                <p className="text-lg mb-2">The leaderboard is currently empty.</p>
                <p>Complete tests and DPPs to see your rank!</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center font-semibold">Rank</TableHead>
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="text-right font-semibold">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeaderboard.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className={`text-center font-medium text-lg ${getRankColor(entry.rank)}`}>
                    <div className="flex items-center justify-center">
                      {entry.rank && entry.rank <=3 && <Star className={`mr-1 h-4 w-4 fill-current ${getRankColor(entry.rank)}`} />}
                      {entry.rank}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-primary/50">
                        <AvatarImage src={entry.avatarUrl || `https://placehold.co/40x40.png`} alt={entry.name} data-ai-hint={entry.dataAiHint || "user avatar"}/>
                        <AvatarFallback>{entry.name.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-accent">{entry.score.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
