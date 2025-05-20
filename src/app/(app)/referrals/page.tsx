
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getReferrerInfoForCurrentUserAction } from '@/app/auth/actions';
import pb from '@/lib/pocketbase';
import type { User } from '@/types';
import { Gift, Link2, Copy, Users, BarChart3, Info, Loader2, ArrowLeft, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ReferralsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userReferralCode, setUserReferralCode] = useState<string>('N/A');
  const [userReferralStats, setUserReferralStats] = useState<User['referralStats'] | null>(null);
  const [userReferredByUserName, setUserReferredByUserName] = useState<string | null>(null);
  const [isLoadingReferrerName, setIsLoadingReferrerName] = useState(false);
  const [hasUserReferredByCodeInStorage, setHasUserReferredByCodeInStorage] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    async function initializeDataAndSubscribe() {
      if (typeof window !== 'undefined' && isMounted) {
        const storedUserId = localStorage.getItem('userId');
        const storedReferralCode = localStorage.getItem('userReferralCode');
        const storedReferralStats = localStorage.getItem('userReferralStats');
        const storedUserReferredByCode = localStorage.getItem('userReferredByCode');

        if (storedUserId) setUserId(storedUserId);
        if (storedReferralCode) setUserReferralCode(storedReferralCode);

        if (storedReferralStats) {
          try {
            setUserReferralStats(JSON.parse(storedReferralStats));
          } catch (e) {
            console.error("Error parsing referral stats from localStorage", e);
            setUserReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
          }
        } else {
            setUserReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
        }

        const referredByCodeExists = storedUserReferredByCode && storedUserReferredByCode.trim() !== '';
        setHasUserReferredByCodeInStorage(referredByCodeExists);

        if (referredByCodeExists) {
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

        // Real-time subscription for user's own referralStats
        if (storedUserId && pb.authStore.isValid && pb.authStore.model?.id === storedUserId) {
          const localUserId = storedUserId;
          console.log(`[Referrals Page - Real-time Subscription] Attempting to subscribe for user ID: ${localUserId}`);
          console.log(`[Real-time Subscription] PocketBase client baseUrl: ${pb.baseUrl}`);
          const realtimeUrl = pb.baseUrl.replace(/^http/, 'ws') + '/api/realtime';
          console.log(`[Real-time Subscription] Attempting to connect to WebSocket: ${realtimeUrl} for user ID: ${localUserId}`);
          try {
            unsubscribe = await pb.collection('users').subscribe(localUserId, (e) => {
              if (e.action === 'update' && e.record && isMounted) {
                console.log('[Referrals Page - Real-time] User record updated:', e.record);
                const updatedStats = e.record.referralStats as User['referralStats'];
                if (updatedStats && JSON.stringify(updatedStats) !== JSON.stringify(userReferralStats)) {
                  console.log('[Referrals Page - Real-time] Referral stats changed, updating state and localStorage.');
                  setUserReferralStats(updatedStats);
                  localStorage.setItem('userReferralStats', JSON.stringify(updatedStats));
                }
              }
            });
            console.log(`[Referrals Page - Real-time Subscription] Successfully subscribed for user ID: ${localUserId}`);
          } catch (error) {
            console.error(`[Real-time Subscription Error] Failed for user ID: ${localUserId}.`, error);
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
    }

    initializeDataAndSubscribe();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        const localUserIdOnUnmount = userId || 'unknown_user_on_unmount';
        console.log(`[Referrals Page - Real-time Subscription] Unsubscribing for user ID: ${localUserIdOnUnmount}`);
        unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toast]);

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
  
  const defaultStats: User['referralStats'] = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
  const statsToDisplay = userReferralStats || defaultStats;


  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      <header className="flex items-center justify-between mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold flex items-center">
            <Gift className="mr-2 h-6 w-6 text-primary" /> My Referrals
        </h1>
        <div className="w-9"></div> {/* Spacer */}
      </header>

      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Share2 className="mr-3 h-6 w-6 text-accent" />
            Share Your Referral Link
          </CardTitle>
          <CardDescription>
            Share your code or link with friends. When they sign up, your referral stats will update here!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="referralCodeDisplay">Your Referral Code</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="referralCodeDisplay"
                value={userReferralCode}
                readOnly
                className="bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyReferralCode}
                aria-label="Copy referral code"
                disabled={!userReferralCode || userReferralCode === 'N/A'}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="referralLinkDisplayFull">Your Unique Signup Link</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="referralLinkDisplayFull"
                value={(userReferralCode && userReferralCode !== 'N/A' && typeof window !== 'undefined') ? `${window.location.origin}/auth/signup/${userReferralCode}` : 'N/A - Login to see your link'}
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

      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <BarChart3 className="mr-3 h-6 w-6 text-accent" />
            Your Referral Statistics
          </CardTitle>
          <CardDescription>
            Track how many users have signed up using your referral code.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-md text-center">
            <p className="text-sm font-medium text-muted-foreground">Free Users Referred</p>
            <p className="text-3xl font-bold text-primary">{statsToDisplay.referred_free}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-md text-center">
            <p className="text-sm font-medium text-muted-foreground">Chapterwise Plan</p>
            <p className="text-3xl font-bold text-primary">{statsToDisplay.referred_chapterwise}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-md text-center">
            <p className="text-sm font-medium text-muted-foreground">Full-Length Plan</p>
            <p className="text-3xl font-bold text-primary">{statsToDisplay.referred_full_length}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-md text-center">
            <p className="text-sm font-medium text-muted-foreground">Combo Plan</p>
            <p className="text-3xl font-bold text-primary">{statsToDisplay.referred_combo}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Users className="mr-3 h-6 w-6 text-accent" />
            My Referrer
          </CardTitle>
          <CardDescription>
            See who invited you to EduNexus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReferrerName && (
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
        </CardContent>
      </Card>
    </div>
  );
}

