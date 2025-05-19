
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

export type UserClass = "11th Grade" | "12th Grade" | "Dropper" | "Teacher";
export type UserModel = "Free" | "Chapterwise" | "Full_length" | "Dpp" | "Combo" | "Teacher";
export type UserRole = "User" | "Admin" | "Teacher";

// User type aligned with PocketBase fields and app needs
export interface User {
  id: string; 
  email: string;
  name: string; 
  phone?: string | null;
  class?: UserClass | null;
  model?: UserModel | null;
  role?: UserRole | null;
  expiry_date?: string | null; 
  created?: string; 
  updated?: string; 
  avatar?: string | File | null; // Can be filename (string from PB), File (for upload), or null
  avatarUrl?: string | null; // Derived URL for display
  totalPoints?: number | null;
  targetYear?: number | null;
  referralCode?: string | null; 
  referredByCode?: string | null; 
  referralStats?: {
    referred_free: number;
    referred_chapterwise: number;
    referred_full_length: number;
    referred_combo: number;
  } | null;
  collectionId?: string;
  collectionName?: string;
  username?: string; 
  verified?: boolean;
}


export interface UserScore {
  id: string; 
  name: string;
  score: number;
  avatarUrl?: string;
  rank?: number;
}

export interface LeaderboardEntry extends UserScore {
  dataAiHint?: string;
}
