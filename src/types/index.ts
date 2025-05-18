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

// Updated User type based on provided JSON
export type UserClass = "11th Grade" | "12th Grade" | "Dropper" | "Teacher";
export type UserModel = "Free" | "Chapterwise" | "Full_length" | "Combo" | "Dpp" | "Teacher";
export type UserRole = "User" | "Admin" | "Teacher";

export interface User {
  id: string;
  email: string;
  password?: string; // Hashed password, optional if fetching for display without sensitive data
  name: string;
  surname: string;
  phone: string;
  referral?: string; // User's own referral code if they entered one during signup (referredByCode)
  class: UserClass;
  model: UserModel;
  role: UserRole;
  expiry_date: string; // ISO date string
  createdAt: string; // ISO date string
  avatarUrl?: string | null;
  totalPoints: number;
  targetYear?: number | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  referralCode: string; // The referral code generated for this user
  referredByCode?: string | null; // The referral code this user used during signup
  referralStats: {
    referred_free: number;
    referred_chapterwise: number;
    referred_full_length: number;
    referred_combo: number;
  };
}


export interface UserScore {
  id: string; // Could be user ID
  name: string;
  score: number;
  avatarUrl?: string;
  rank?: number;
}

export interface LeaderboardEntry extends UserScore {
  dataAiHint?: string;
}
