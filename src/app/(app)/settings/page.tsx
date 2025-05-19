
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  UploadCloud,
  XCircle,
  Copy,
  Star,
  CalendarDays,
} from 'lucide-react';
import type { UserClass, User } from '@/types'; // Added User type
import { format } from 'date-fns'; // For date formatting

const USER_CLASSES_OPTIONS: UserClass[] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];
const TARGET_EXAM_YEAR_OPTIONS: string[] = ["-- Not Set --", "2025", "2026", "2027", "2028"]; // Example years

export default function SettingsPage() {
  const router = useRouter();
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>('U');
  const [userClass, setUserClass] = useState<UserClass | ''>('');
  const [userTargetYear, setUserTargetYear] = useState<string>('-- Not Set --');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [userReferralCode, setUserReferralCode] = useState<string>('N/A');
  const [userReferralStats, setUserReferralStats] = useState<User['referralStats'] | null>(null);
  const [userExpiryDate, setUserExpiryDate] = useState<string>('N/A');
  const [userModel, setUserModel] = useState<string>('N/A');
  const [isSaving, setIsSaving] = useState(false); // For save button state

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedFullName = localStorage.getItem('userFullName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedPhone = localStorage.getItem('userPhone');
      const storedAvatarFallback = localStorage.getItem('userAvatarFallback');
      const storedClass = localStorage.getItem('userClass') as UserClass | null;
      const storedTargetYear = localStorage.getItem('userTargetYear');
      const storedModel = localStorage.getItem('userModel');
      
      const storedReferralCode = localStorage.getItem('userReferralCode');
      const storedReferralStatsString = localStorage.getItem('userReferralStats');
      const storedExpiryDate = localStorage.getItem('userExpiryDate');

      if (storedFullName) setUserFullName(storedFullName);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedPhone) setUserPhone(storedPhone);
      if (storedAvatarFallback) setUserAvatarFallback(storedAvatarFallback);
      if (storedClass && USER_CLASSES_OPTIONS.includes(storedClass)) setUserClass(storedClass);
      if (storedTargetYear && storedTargetYear !== 'N/A' ) setUserTargetYear(storedTargetYear);
      if (storedModel) setUserModel(storedModel);

      if (storedReferralCode) setUserReferralCode(storedReferralCode);
      if (storedReferralStatsString) {
        try {
          setUserReferralStats(JSON.parse(storedReferralStatsString));
        } catch (e) {
          console.error("Error parsing referral stats from localStorage", e);
          setUserReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
        }
      } else {
        setUserReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
      }
      if (storedExpiryDate) setUserExpiryDate(storedExpiryDate);
      
      setAvatarPreview(`https://placehold.co/96x96.png?text=${storedAvatarFallback || 'U'}`);
    }
  }, []);

  const handleSaveChanges = () => {
    setIsSaving(true);
    // Placeholder for save logic (e.g., call a server action)
    console.log("Save Changes Clicked. Data to save:", { userClass, userTargetYear });
    // Simulate API call
    setTimeout(() => {
      // Update localStorage if needed (though ideally server handles persistence)
      if (typeof window !== 'undefined') {
        localStorage.setItem('userClass', userClass || '');
        localStorage.setItem('userTargetYear', userTargetYear);
      }
      setIsSaving(false);
      // Potentially show a success toast
      // router.push('/profile'); // Or stay on page
    }, 1000);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // Max 2MB
        alert("File is too large. Max 2MB allowed.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePicture = () => {
    setAvatarPreview(`https://placehold.co/96x96.png?text=${userAvatarFallback}`);
  };

  const handleCopyReferralCode = () => {
    if (userReferralCode && userReferralCode !== 'N/A') {
      navigator.clipboard.writeText(userReferralCode)
        .then(() => alert("Referral code copied!"))
        .catch(err => console.error("Failed to copy referral code: ", err));
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8 bg-muted/30 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between mb-2 sticky top-0 bg-muted/30 py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="w-9"></div> {/* Placeholder for alignment */}
      </header>

      {/* Profile Settings Card */}
      <Card className="shadow-lg w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>Manage your personal information and profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <Label htmlFor="profilePicture" className="text-sm font-medium">Profile Picture</Label>
            <div className="mt-2 flex items-center gap-4">
              <Avatar className="h-24 w-24 text-3xl">
                <AvatarImage src={avatarPreview || `https://placehold.co/96x96.png`} alt={userFullName} data-ai-hint="user avatar settings"/>
                <AvatarFallback>{userAvatarFallback}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild>
                  <Label htmlFor="profilePictureFile" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" /> Change
                  </Label>
                </Button>
                <input type="file" id="profilePictureFile" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleProfilePictureChange} />
                <Button variant="destructive" onClick={handleRemoveProfilePicture}>
                  <XCircle className="mr-2 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Max 2MB. JPG, PNG, WEBP.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={userFullName} disabled className="mt-1 bg-muted/50" />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input id="phoneNumber" value={userPhone} disabled className="mt-1 bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">Contact support to change phone number.</p>
            </div>
            <div>
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input id="emailAddress" type="email" value={userEmail} disabled className="mt-1 bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div>
              <Label htmlFor="academicStatus">Academic Status</Label>
              <Select value={userClass} onValueChange={(value) => setUserClass(value as UserClass)}>
                <SelectTrigger id="academicStatus" className="mt-1">
                  <SelectValue placeholder="Select your class" />
                </SelectTrigger>
                <SelectContent>
                  {USER_CLASSES_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="targetExamYear">Target Exam Year</Label>
              <Select value={userTargetYear} onValueChange={setUserTargetYear}>
                <SelectTrigger id="targetExamYear" className="mt-1">
                  <SelectValue placeholder="-- Not Set --" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_EXAM_YEAR_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 pt-8">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      {/* Referral Program Card */}
      <Card className="shadow-lg w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Referral Program</CardTitle>
          <CardDescription>Share your code and track your referral success.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="referralCodeDisplay">Your Referral Code</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input id="referralCodeDisplay" value={userReferralCode} readOnly className="bg-muted/50" />
              <Button variant="outline" size="icon" onClick={handleCopyReferralCode} aria-label="Copy referral code" disabled={!userReferralCode || userReferralCode === 'N/A'}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Referral Statistics</h4>
            <div className="p-4 bg-muted/50 rounded-md grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Free Users</p>
                <p className="text-xl font-semibold">{userReferralStats?.referred_free ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chapterwise</p>
                <p className="text-xl font-semibold">{userReferralStats?.referred_chapterwise ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Full Length</p>
                <p className="text-xl font-semibold">{userReferralStats?.referred_full_length ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Combo</p>
                <p className="text-xl font-semibold">{userReferralStats?.referred_combo ?? 0}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Note: Stats update when a referred user signs up. Rewards based on referred user's plan type may apply.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Subscription Card */}
      <Card className="shadow-lg w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Subscription</CardTitle>
          <CardDescription>Your current access plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <span className="font-medium">Current Plan:</span>
            <Badge variant="secondary">{userModel}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Expires on:</span>
            <span className="text-muted-foreground">
              {userExpiryDate && userExpiryDate !== 'N/A' ? format(new Date(userExpiryDate), 'MMMM d, yyyy') : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

