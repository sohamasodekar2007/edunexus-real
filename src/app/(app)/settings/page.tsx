
'use client';

import { useEffect, useState, useCallback, type ChangeEvent } from 'react';
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
  Copy,
  Star,
  CalendarDays,
  Info,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { UserClass, User, UserModel } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfileAction, getReferrerInfoForCurrentUserAction, updateUserAvatarAction, removeUserAvatarAction } from '@/app/auth/actions';
import pb from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const USER_CLASSES_OPTIONS: UserClass[] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];
const TARGET_EXAM_YEAR_OPTIONS: string[] = ["-- Not Set --", "2025", "2026", "2027", "2028"];
const EMPTY_CLASS_VALUE_PLACEHOLDER = "__EMPTY_CLASS_VALUE__";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>('U');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userClass, setUserClass] = useState<UserClass | ''>('');
  const [userTargetYear, setUserTargetYear] = useState<string>('-- Not Set --');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // const [avatarFile, setAvatarFile] = useState<File | null>(null); // Not used if direct upload on change


  const [userReferralCode, setUserReferralCode] = useState<string>('N/A');
  const [userReferredByUserName, setUserReferredByUserName] = useState<string | null>(null);
  const [isLoadingReferrerName, setIsLoadingReferrerName] = useState(false);
  const [hasUserReferredByCodeInStorage, setHasUserReferredByCodeInStorage] = useState<boolean>(false);

  const [userExpiryDate, setUserExpiryDate] = useState<string>('N/A');
  const [userModel, setUserModel] = useState<UserModel | string>('N/A');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);


  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    async function initializeDataAndSubscribe() {
      const currentAuthUserId = pb.authStore.model?.id;
       if (currentAuthUserId) {
        setUserId(currentAuthUserId);
      }

      if (typeof window !== 'undefined' && isMounted) {
        const storedFullName = localStorage.getItem('userFullName');
        const storedEmail = localStorage.getItem('userEmail');
        const storedPhone = localStorage.getItem('userPhone');
        const storedAvatarFallback = localStorage.getItem('userAvatarFallback');
        const storedAvatarUrl = localStorage.getItem('userAvatarUrl');
        const storedClass = localStorage.getItem('userClass') as UserClass | null;
        const storedTargetYear = localStorage.getItem('userTargetYear');
        const storedModel = localStorage.getItem('userModel') as UserModel | null;
        const storedReferralCode = localStorage.getItem('userReferralCode');
        const storedUserReferredByCodeValue = localStorage.getItem('userReferredByCode');
        const storedExpiryDate = localStorage.getItem('userExpiryDate');

        if (storedFullName) setUserFullName(storedFullName);
        if (storedEmail) setUserEmail(storedEmail);
        if (storedPhone && storedPhone !== 'N/A') setUserPhone(storedPhone); else setUserPhone('');
        if (storedAvatarFallback) setUserAvatarFallback(storedAvatarFallback);

        const currentPbAvatarUrl = pb.authStore.model?.avatar ? pb.getFileUrl(pb.authStore.model, pb.authStore.model.avatar as string) : null;
        const effectiveAvatarUrl = currentPbAvatarUrl || (storedAvatarUrl && storedAvatarUrl !== 'null' && storedAvatarUrl !== 'undefined' ? storedAvatarUrl : null);

        if (effectiveAvatarUrl) {
            setUserAvatarUrl(effectiveAvatarUrl);
            setAvatarPreview(effectiveAvatarUrl);
        } else {
            setAvatarPreview(`https://placehold.co/96x96.png?text=${storedAvatarFallback || 'U'}`);
        }

        if (storedClass && USER_CLASSES_OPTIONS.includes(storedClass)) setUserClass(storedClass);
        else if (storedClass === null || storedClass === '') setUserClass('');

        if (storedTargetYear && storedTargetYear !== 'N/A' && TARGET_EXAM_YEAR_OPTIONS.includes(storedTargetYear)) setUserTargetYear(storedTargetYear);
        else setUserTargetYear('-- Not Set --');

        if (storedModel) setUserModel(storedModel);
        if (storedReferralCode) setUserReferralCode(storedReferralCode);
        if (storedExpiryDate && storedExpiryDate !== 'N/A') {
          try {
            setUserExpiryDate(format(new Date(storedExpiryDate), 'MMMM d, yyyy'));
          } catch (e) {
             console.warn("Failed to parse expiry date from localStorage:", storedExpiryDate);
             setUserExpiryDate('Invalid Date');
          }
        } else {
          setUserExpiryDate('N/A');
        }
        
        const referredByCodeExistsInStorage = !!(storedUserReferredByCodeValue && storedUserReferredByCodeValue.trim().length > 0);
        setHasUserReferredByCodeInStorage(referredByCodeExistsInStorage);


        if (referredByCodeExistsInStorage) {
          if (isMounted) setIsLoadingReferrerName(true);
          getReferrerInfoForCurrentUserAction()
            .then(result => {
              if (isMounted) {
                if (result.referrerName) setUserReferredByUserName(result.referrerName);
                else if (result.error) console.warn("Could not fetch referrer name:", result.error);
              }
            })
            .catch(err => console.error("Error calling getReferrerInfoForCurrentUserAction:", err))
            .finally(() => { if (isMounted) setIsLoadingReferrerName(false); });
        }

        if (pb.authStore.isValid && currentAuthUserId && isMounted) {
            const localUserId = currentAuthUserId;
            const realtimeUrl = pb.baseUrl.replace(/^http/, 'ws') + '/api/realtime';
            console.log(`[Real-time Subscription] PocketBase client baseUrl: ${pb.baseUrl}`);
            console.log(`[Real-time Subscription] Attempting to connect to WebSocket: ${realtimeUrl} for user ID: ${localUserId}`);

            try {
              unsubscribe = await pb.collection('users').subscribe(localUserId, (e) => {
                if (e.action === 'update' && e.record && isMounted) {
                  console.log('[Real-time] User record updated:', e.record);

                  if (e.record.model && typeof window !== 'undefined') {
                     const newModel = e.record.model as UserModel;
                     const currentModel = localStorage.getItem('userModel');
                     if (newModel !== currentModel) {
                        localStorage.setItem('userModel', newModel);
                        setUserModel(newModel);
                        toast({ title: "Plan Updated", description: `Your plan was updated to ${newModel} via real-time sync.` });
                     }
                  }

                  if (typeof window !== 'undefined') {
                    const newAvatarFilename = e.record.avatar as string | undefined;
                    const newAvatarUrlFromEvent = newAvatarFilename ? pb.getFileUrl(e.record, newAvatarFilename) : null;
                    const currentAvatarUrlInState = localStorage.getItem('userAvatarUrl') || null;

                    if (newAvatarUrlFromEvent !== currentAvatarUrlInState) {
                        localStorage.setItem('userAvatarUrl', newAvatarUrlFromEvent || '');
                        setUserAvatarUrl(newAvatarUrlFromEvent);
                        setAvatarPreview(newAvatarUrlFromEvent || `https://placehold.co/96x96.png?text=${localStorage.getItem('userAvatarFallback') || 'U'}`);
                        toast({ title: "Avatar Updated", description: "Your profile picture was updated." });
                    }
                  }
                }
              });
              console.log(`[Real-time Subscription] Successfully subscribed to updates for user ID: ${localUserId}`);
            } catch (error) {
                console.error(`[Real-time Subscription Error] Failed to subscribe to user updates for user ID: ${localUserId}. This often indicates a network issue or problem with the PocketBase server's real-time connection.`, error);
                console.error(`[Real-time Subscription Error] pb.baseUrl at time of error: ${pb?.baseUrl}`);
                if (error instanceof ClientResponseError) {
                  console.error(`[Real-time Subscription Error] PocketBase ClientResponseError Status: ${error.status}`);
                  if (error.status === 0) {
                    console.error("[Real-time Subscription Error] Status 0 indicates the PocketBase server is unreachable or the network request failed. Check your PocketBase server, ngrok tunnel (if used), and ensure NEXT_PUBLIC_POCKETBASE_URL in your .env file is correct and accessible from your browser's network.");
                  }
                  console.error(`[Real-time Subscription Error] PocketBase ClientResponseError URL: ${error.url || 'N/A'}`);
                  console.error(`[Real-time Subscription Error] PocketBase ClientResponseError Response: ${JSON.stringify(error.response)}`);
                  console.error(`[Real-time Subscription Error] PocketBase ClientResponseError Data: ${JSON.stringify(error.data)}`);
                  console.error("[Real-time Subscription Error] Full ClientResponseError object:", error);
                   if (error.originalError) {
                    console.error(`[Real-time Subscription Error] OriginalError Type: ${error.originalError.constructor.name}`);
                    if (error.originalError instanceof Error) {
                      console.error(`[Real-time Subscription Error] OriginalError Message: ${error.originalError.message}`);
                      console.error(`[Real-time Subscription Error] OriginalError Stack: ${error.originalError.stack}`);
                    } else {
                      console.error(`[Real-time Subscription Error] OriginalError: ${String(error.originalError)}`);
                    }
                  }
                }
                toast({
                  title: "Real-time Sync Issue",
                  description: "Could not connect for live updates. Please verify NEXT_PUBLIC_POCKETBASE_URL, ngrok tunnel, and PocketBase server status. Also check for browser/network issues blocking WebSockets.",
                  variant: "destructive",
                  duration: 15000,
                });
            }
        }
      }
    }

    initializeDataAndSubscribe();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        const localUserIdOnUnmount = pb.authStore.model?.id || 'unknown_user_on_unmount';
        console.log(`[Real-time Subscription] Unsubscribing from updates for user ID: ${localUserIdOnUnmount}`);
        unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Added toast to dependency array


  const handleSaveChanges = async () => {
    setIsSaving(true);
    const currentAuthUserId = pb.authStore.model?.id;
    if (!currentAuthUserId) {
      toast({ title: "Authentication Error", description: "Your session seems invalid. Please log in again.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    console.log(`[Settings Save] User ID: ${currentAuthUserId}, Class: ${userClass}, Target Year: ${userTargetYear}`);

    const result = await updateUserProfileAction({
      userId: currentAuthUserId,
      classToUpdate: userClass,
      targetYearToUpdate: userTargetYear,
    });

    if (result.success && result.updatedUser) {
      toast({ title: "Success", description: result.message || "Profile updated successfully!" });
      if (typeof window !== 'undefined') {
        const updatedClass = result.updatedUser.class || '';
        const updatedTargetYear = result.updatedUser.targetYear?.toString() || '-- Not Set --';

        localStorage.setItem('userClass', updatedClass);
        setUserClass(updatedClass);
        localStorage.setItem('userTargetYear', updatedTargetYear);
        setUserTargetYear(updatedTargetYear);
      }
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update profile.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleCopyReferralLink = () => {
    if (userReferralCode && userReferralCode !== 'N/A' && typeof window !== 'undefined') {
      const signupLink = `${window.location.origin}/auth/signup/${userReferralCode}`;
      navigator.clipboard.writeText(signupLink)
        .then(() => toast({ title: "Copied!", description: "Signup link copied to clipboard." }))
        .catch(err => {
          console.error("Failed to copy signup link: ", err);
          toast({ title: "Copy Failed", description: "Could not copy signup link.", variant: "destructive" });
        });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      <header className="flex items-center justify-between mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
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
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Profile picture managed via PocketBase Admin UI for now.</p>
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
                value={(userClass as string) === '' ? EMPTY_CLASS_VALUE_PLACEHOLDER : userClass}
                onValueChange={(value) => {
                  if (value === EMPTY_CLASS_VALUE_PLACEHOLDER) {
                    setUserClass('');
                  } else {
                    setUserClass(value as UserClass);
                  }
                }}
                disabled={isSaving}
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
              <Select value={userTargetYear} onValueChange={setUserTargetYear} disabled={isSaving}>
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
          <Button variant="outline" onClick={handleCancel} disabled={isSaving || isUploadingAvatar}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving || isUploadingAvatar}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
          {isLoadingReferrerName && !userReferredByUserName && (
             <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading referrer information...
              </div>
          )}
          {!isLoadingReferrerName && userReferredByUserName && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md flex items-center gap-2">
              <Info className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                You were referred by: <span className="font-semibold">{userReferredByUserName}</span>
              </p>
            </div>
          )}
           {!isLoadingReferrerName && !userReferredByUserName && hasUserReferredByCodeInStorage && (
             <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">Referrer details could not be loaded or the code used was invalid.</p>
            </div>
          )}
          {!isLoadingReferrerName && !userReferredByUserName && !hasUserReferredByCodeInStorage && (
             <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">You were not referred by anyone.</p>
            </div>
          )}

          <div>
            <Label htmlFor="referralLinkDisplay">Your Referral Signup Link</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="referralLinkDisplay"
                value={ (userReferralCode && userReferralCode !== 'N/A' && typeof window !== 'undefined') ? `${window.location.origin}/auth/signup/${userReferralCode}` : 'N/A'}
                readOnly
                className="bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyReferralLink}
                aria-label="Copy referral signup link"
                disabled={!userReferralCode || userReferralCode === 'N/A'}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
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
              {userExpiryDate}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


