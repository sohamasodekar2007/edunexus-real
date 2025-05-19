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
  id: string; // PocketBase record ID
  email: string;
  // Password is not directly stored or retrieved by the app client-side after PocketBase handles it
  name: string; // Combined from signup: name + surname
  // surname is not a direct field in PocketBase, combined into 'name'
  phone?: string | null;
  class?: UserClass | null;
  model?: UserModel | null;
  role?: UserRole | null;
  expiry_date?: string | null; // ISO date string
  created?: string; // PocketBase field
  updated?: string; // PocketBase field
  avatarUrl?: string | null;
  totalPoints?: number | null;
  targetYear?: number | null;
  // telegramId and telegramUsername are not in the provided PocketBase schema, can be added if needed
  // telegramId?: string | null;
  // telegramUsername?: string | null;
  referralCode?: string | null; // The referral code generated for this user
  referredByCode?: string | null; // The referral code this user used during signup
  referralStats?: {
    referred_free: number;
    referred_chapterwise: number;
    referred_full_length: number;
    referred_combo: number;
  } | null;
  // PocketBase specific fields you might need from the record
  collectionId?: string;
  collectionName?: string;
  username?: string; // PocketBase has a username field, often same as email or generated
  verified?: boolean;
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
