import type { Test, Dpp, LeaderboardEntry, Question, BookmarkedQuestion } from '@/types';

export const mockQuestions: Question[] = [
  { id: 'q1', text: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], correctAnswerIndex: 2, subject: 'General Knowledge', topic: 'World Capitals' },
  { id: 'q2', text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswerIndex: 1, subject: 'Mathematics', topic: 'Arithmetic' },
  { id: 'q3', text: 'Which planet is known as the Red Planet?', options: ['Earth', 'Mars', 'Jupiter', 'Saturn'], correctAnswerIndex: 1, subject: 'Science', topic: 'Astronomy' },
  { id: 'q4', text: 'What is the chemical symbol for water?', options: ['O2', 'H2O', 'CO2', 'NaCl'], correctAnswerIndex: 1, subject: 'Chemistry', topic: 'Basic Chemistry' },
  { id: 'q5', text: 'Who wrote "Hamlet"?', options: ['Charles Dickens', 'William Shakespeare', 'Leo Tolstoy', 'Mark Twain'], correctAnswerIndex: 1, subject: 'Literature', topic: 'Classic Plays' },
];

export const mockTests: Test[] = [
  { 
    id: 'test1', 
    title: 'Physics - Kinematics Basics', 
    type: 'chapterwise', 
    questions: [mockQuestions[0], mockQuestions[1]], 
    subject: 'Physics',
    durationMinutes: 30 
  },
  { 
    id: 'test2', 
    title: 'Full Syllabus Mock Test 1', 
    type: 'full-length', 
    questions: mockQuestions.slice(0,4),
    durationMinutes: 180
  },
  { 
    id: 'test3', 
    title: 'Chemistry - Organic Chemistry Fundamentals', 
    type: 'chapterwise', 
    questions: [mockQuestions[3], mockQuestions[4]], 
    subject: 'Chemistry',
    durationMinutes: 45
  },
];

export const mockDpps: Dpp[] = [
  { id: 'dpp1', title: 'Daily Practice Problems - Set 1', date: new Date().toISOString(), problems: [mockQuestions[2], mockQuestions[3]], subject: 'Mixed' },
  { id: 'dpp2', title: 'Mathematics - Algebra Challenge', date: new Date(Date.now() - 86400000).toISOString(), problems: [mockQuestions[1]], subject: 'Mathematics' },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  { id: 'user1', name: 'Alice Wonderland', score: 1500, avatarUrl: 'https://placehold.co/40x40.png', rank: 1, dataAiHint: "woman portrait" },
  { id: 'user2', name: 'Bob The Builder', score: 1450, avatarUrl: 'https://placehold.co/40x40.png', rank: 2, dataAiHint: "man portrait" },
  { id: 'user3', name: 'Charlie Brown', score: 1300, avatarUrl: 'https://placehold.co/40x40.png', rank: 3, dataAiHint: "person smiling" },
  { id: 'user4', name: 'Diana Prince', score: 1250, avatarUrl: 'https://placehold.co/40x40.png', rank: 4, dataAiHint: "woman face" },
  { id: 'user5', name: 'Edward Scissorhands', score: 1100, avatarUrl: 'https://placehold.co/40x40.png', rank: 5, dataAiHint: "man face" },
];

export const mockBookmarkedQuestions: BookmarkedQuestion[] = [
  { id: 'bm1', questionId: 'q1', questionText: 'What is the capital of France?', sourceId: 'test1', sourceType: 'test' },
];


export const LOCAL_STORAGE_KEYS = {
  tests: 'examPrepPro_tests',
  dpps: 'examPrepPro_dpps',
  leaderboard: 'examPrepPro_leaderboard',
  bookmarkedQuestions: 'examPrepPro_bookmarkedQuestions',
};

export function initializeLocalStorageData() {
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.tests)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.tests, JSON.stringify(mockTests));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.dpps)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.dpps, JSON.stringify(mockDpps));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.leaderboard)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.leaderboard, JSON.stringify(mockLeaderboard));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.bookmarkedQuestions)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.bookmarkedQuestions, JSON.stringify(mockBookmarkedQuestions));
    }
  }
}
