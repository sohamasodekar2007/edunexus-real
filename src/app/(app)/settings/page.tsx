
'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Info,
} from 'lucide-react';
import type { UserClass, User } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfileAction, getReferrerInfoForCurrentUserAction } from '@/app/auth/actions';

const USER_CLASSES_OPTIONS: UserClass[] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];
const TARGET_EXAM_YEAR_OPTIONS: string[] = ["-- Not Set --", "2025", "2026", "2027", "2028"];
const EMPTY_CLASS_VALUE_PLACEHOLDER = "__EMPTY_CLASS_VALUE__";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>('U');
  const [userClass, setUserClass] = useState<UserClass | ''>('');
  const [userTargetYear, setUserTargetYear] = useState<string>('-- Not Set --');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [userReferralCode, setUserReferralCode] = useState<string>('N/A');
  const [userReferralStats, setUserReferralStats] = useState<User['referralStats'] | null>(null);
  const [userReferredByUserName, setUserReferredByUserName] = useState<string | null>(null);
  const [isLoadingReferrerName, setIsLoadingReferrerName] = useState(false);
  const [userExpiryDate, setUserExpiryDate] = useState<string>('N/A');
  const [userModel, setUserModel] = useState<string>('N/A');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId');
      const storedFullName = localStorage.getItem('userFullName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedPhone = localStorage.getItem('userPhone');
      const storedAvatarFallback = localStorage.getItem('userAvatarFallback');
      const storedClass = localStorage.getItem('userClass') as UserClass | null;
      const storedTargetYear = localStorage.getItem('userTargetYear');
      const storedModel = localStorage.getItem('userModel');

      const storedReferralCode = localStorage.getItem('userReferralCode');
      const storedUserReferredByCode = localStorage.getItem('userReferredByCode');
      const storedReferralStatsString = localStorage.getItem('userReferralStats');
      const storedExpiryDate = localStorage.getItem('userExpiryDate');

      if (storedUserId) setUserId(storedUserId);
      if (storedFullName) setUserFullName(storedFullName);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedPhone) setUserPhone(storedPhone);
      if (storedAvatarFallback) setUserAvatarFallback(storedAvatarFallback);
      if (storedClass && USER_CLASSES_OPTIONS.includes(storedClass)) setUserClass(storedClass);
      else if (storedClass === null || storedClass === '') setUserClass('');

      if (storedTargetYear && storedTargetYear !== 'N/A' && TARGET_EXAM_YEAR_OPTIONS.includes(storedTargetYear)) setUserTargetYear(storedTargetYear);
      else setUserTargetYear('-- Not Set --');

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

      if (storedUserReferredByCode && storedUserReferredByCode.trim() !== '') {
        setIsLoadingReferrerName(true);
        getReferrerInfoForCurrentUserAction()
          .then(result => {
            if (result.referrerName) {
              setUserReferredByUserName(result.referrerName);
            } else if (result.error) {
              console.warn("Could not fetch referrer name:", result.error);
            }
          })
          .catch(err => console.error("Error calling getReferrerInfoForCurrentUserAction:", err))
          .finally(() => setIsLoadingReferrerName(false));
      }
    }
  }, []);

  const handleSaveChanges = async () => {
    if (!userId) {
      toast({ title: "Error", description: "User not identified. Please log in again.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const result = await updateUserProfileAction({
      userId,
      classToUpdate: userClass,
      targetYearToUpdate: userTargetYear,
    });

    if (result.success) {
      toast({ title: "Success", description: result.message || "Profile updated successfully!" });
      if (typeof window !== 'undefined') {
        localStorage.setItem('userClass', userClass || '');
        localStorage.setItem('userTargetYear', userTargetYear);
      }
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update profile.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Max 2MB allowed for profile picture.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        // TODO: Add logic to upload and save profile picture to PocketBase
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePicture = () => {
    setAvatarPreview(`https://placehold.co/96x96.png?text=${userAvatarFallback}`);
    // TODO: Add logic to remove profile picture from PocketBase
  };

  const handleCopyReferralCode = () => {
    if (userReferralCode && userReferralCode !== 'N/A') {
      navigator.clipboard.writeText(userReferralCode)
        .then(() => toast({ title: "Copied!", description: "Referral code copied to clipboard." }))
        .catch(err => {
          console.error("Failed to copy referral code: ", err);
          toast({ title: "Copy Failed", description: "Could not copy referral code.", variant: "destructive" });
        });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8 bg-muted/30 min-h-screen">
      <header className="flex items-center justify-between mb-2 sticky top-0 bg-muted/30 py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="w-9"></div>
      </header>

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
              <Select
                value={userClass === '' ? EMPTY_CLASS_VALUE_PLACEHOLDER : userClass}
                onValueChange={(value) => {
                  if (value === EMPTY_CLASS_VALUE_PLACEHOLDER) {
                    setUserClass('');
                  } else {
                    setUserClass(value as UserClass);
                  }
                }}
              >
                <SelectTrigger id="academicStatus" className="mt-1">
                  <SelectValue placeholder="Select your class" />
                </SelectTrigger>
                <SelectContent>
                  {USER_CLASSES_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value={EMPTY_CLASS_VALUE_PLACEHOLDER}>-- Not Set --</SelectItem>
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

      <Card className="shadow-lg w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Referral Program</CardTitle>
          <CardDescription>Share your code, track your success, and see who referred you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {userReferredByUserName && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md flex items-center gap-2">
              <Info className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                You were referred by: <span className="font-semibold">{userReferredByUserName}</span>
              </p>
            </div>
          )}
          {isLoadingReferrerName && !userReferredByUserName && (
             <p className="text-sm text-muted-foreground">Loading referrer information...</p>
          )}
          <div>
            <Label htmlFor="referralCodeDisplay">Your Referral Code</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input id="referralCodeDisplay" value={userReferralCode || 'N/A'} readOnly className="bg-muted/50" />
              <Button variant="outline" size="icon" onClick={handleCopyReferralCode} aria-label="Copy referral code" disabled={!userReferralCode || userReferralCode === 'N/A'}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Your Referral Statistics</h4>
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
