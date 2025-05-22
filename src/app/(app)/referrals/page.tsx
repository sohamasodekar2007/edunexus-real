
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getReferrerInfoForCurrentUserAction, getLiveReferralStatsAction } from '@/app/auth/actions';
import pb from '@/lib/pocketbase';
import type { User } from '@/types';
import { Gift, Link2, Copy, Users, BarChart3, Info, Loader2, ArrowLeft, Share2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ClientResponseError } from 'pocketbase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ReferralsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userReferralCode, setUserReferralCode] = useState<string>('N/A');
  const [isLoadingReferrerName, setIsLoadingReferrerName] = useState(false);
  const [userReferredByUserName, setUserReferredByUserName] = useState<string | null>(null);
  const [hasUserReferredByCodeInStorage, setHasUserReferredByCodeInStorage] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  // const [liveReferralStats, setLiveReferralStats] = useState<User['referralStats'] | null>(null); // Removed in previous step
  // const [isLoadingStats, setIsLoadingStats] = useState(false); // Removed in previous step
  // const [errorLoadingStats, setErrorLoadingStats] = useState<string | null>(null); // Removed in previous step


  useEffect(() => {
    let isMounted = true;

    async function initializeData() {
      if (typeof window !== 'undefined' && isMounted) {
        const storedUserId = localStorage.getItem('userId');
        const storedReferralCode = localStorage.getItem('userReferralCode');
        const storedUserReferredByCode = localStorage.getItem('userReferredByCode');

        if (storedUserId) setUserId(storedUserId);
        if (storedReferralCode) setUserReferralCode(storedReferralCode);

        const referredByCodeExists = typeof storedUserReferredByCode === 'string' && storedUserReferredByCode.trim() !== '';
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
      }
    }

    initializeData();
    // Removed fetchLiveStats call

    return () => {
      isMounted = false;
      // Real-time subscription cleanup logic was removed as stats display was removed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Dependency array can be simplified if stats are not fetched

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
            Share Your Referral Link & Code
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

      {/* Referral Statistics Card Removed */}

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
