
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
    referred_dpp?: number; // Added for consistency
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

export interface PYQInfo {
  examName?: string;
  year?: string;
  date?: string; // Formatted date string
  shift?: string;
}

export interface QuestionDisplayInfo {
  id: string;
  collectionId: string; // from PocketBase record
  subject: string;
  lessonName: string;
  lessonTopic?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags?: string; // Assuming comma-separated string from PB, can be parsed if needed
  isPYQ: boolean;
  pyqInfo?: PYQInfo;
  questionType: "text" | "image" | "text_image";
  questionText?: string;
  questionImage?: string; // URL
  optionsFormat?: "text_options" | "image_options";
  optionAText?: string;
  optionAImage?: string; // URL
  optionBText?: string;
  optionBImage?: string; // URL
  optionCText?: string;
  optionCImage?: string; // URL
  optionDText?: string;
  optionDImage?: string; // URL
  correctOption: "A" | "B" | "C" | "D" | "";
  explanationText?: string;
  explanationImage?: string; // URL
}

export interface QuestionAttemptDetail {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  status: 'correct' | 'incorrect' | 'skipped' | 'unattempted';
}

export interface DppAttemptPayload {
  userId: string | null; // User's ID from PocketBase, or null for anonymous
  subject: string;
  lessonName: string;
  attemptDate?: string; // Will be set on the server
  questionsAttempted: QuestionAttemptDetail[];
  score: number;
  totalQuestions: number;
  timeTakenSeconds?: number; // Optional
}

export interface College {
  id: string;
  name: string;
  district: string;
  stream: 'PCM' | 'PCB' | 'Both';
  establishedYear?: number;
  collegeType?: 'Government' | 'Private' | 'Autonomous' | 'Deemed' | 'University Department';
  annualFees?: string; // e.g., "Approx. ₹1.5 Lakhs"
  campusSizeAcres?: number;
  rating?: number; // e.g., 4.5 (out of 5)
  logoPlaceholder?: string; // e.g., first letter or initials for placeholder
  website?: string;
  courses?: string[]; // A few popular courses for the card
  // For detailed view later, to be populated by Gemini or other AI
  branches?: Array<{
    name: string;
    intake?: number;
    durationYears?: number;
    mhtCetCutoff?: string; // e.g., "98.5 percentile" or "Rank: 1500"
    jeeMainCutoff?: string; // e.g., "Rank: 20000"
    neetCutoff?: string; // e.g., "Score: 600"
    description?: string;
  }>;
}
