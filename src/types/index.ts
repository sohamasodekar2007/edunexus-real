export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number; // Index of the correct option
  explanation?: string;
  subject?: string; // e.g., Physics, Chemistry, Math, Biology
  topic?: string; // e.g., Kinematics, Organic Chemistry
}

export interface Test {
  id: string;
  title: string;
  type: 'chapterwise' | 'full-length';
  questions: Question[];
  subject?: string; // For chapterwise tests
  durationMinutes?: number; // Optional: test duration
}

export interface Dpp {
  id: string;
  title: string;
  date: string; // ISO date string
  problems: Question[];
  subject?: string;
}

export interface BookmarkedQuestion {
  id: string; // Bookmark ID
  questionId: string;
  questionText: string; // Store text for quick display
  sourceId: string; // Test ID or DPP ID
  sourceType: 'test' | 'dpp';
}

export interface UserScore {
  id: string; // Could be user ID
  name: string;
  score: number;
  avatarUrl?: string;
  rank?: number;
}

export interface LeaderboardEntry extends UserScore {}
