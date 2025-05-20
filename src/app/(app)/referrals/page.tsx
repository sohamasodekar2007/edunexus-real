
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
  const [liveReferralStats, setLiveReferralStats] = useState<User['referralStats'] | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [userReferredByUserName, setUserReferredByUserName] = useState<string | null>(null);
  const [isLoadingReferrerName, setIsLoadingReferrerName] = useState(false);
  const [hasUserReferredByCodeInStorage, setHasUserReferredByCodeInStorage] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorLoadingStats, setErrorLoadingStats] = useState<string | null>(null);


  const fetchLiveStats = useCallback(async () => {
    setIsLoadingStats(true);
    setErrorLoadingStats(null); // Reset error before fetching
    try {
      const result = await getLiveReferralStatsAction();
      if (result.success && result.stats) {
        setLiveReferralStats(result.stats);
      } else {
        const errorMessage = result.message || "Could not load live referral statistics.";
        console.error("Failed to fetch live referral stats. Server action response:", { message: errorMessage, internalCode: result.error });
        setErrorLoadingStats(errorMessage);
        toast({
          title: "Stats Error",
          description: errorMessage,
          variant: "destructive",
        });
        // Fallback to empty stats if fetch fails, to prevent crashes
        setLiveReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
      }
    } catch (error) {
      const criticalErrorMessage = "An unexpected error occurred while fetching referral statistics.";
      console.error("Critical error fetching live referral stats:", error);
      setErrorLoadingStats(criticalErrorMessage);
      toast({
        title: "Stats Error",
        description: criticalErrorMessage,
        variant: "destructive",
      });
      setLiveReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
    } finally {
      setIsLoadingStats(false);
    }
  }, [toast]);


  useEffect(() => {
    let isMounted = true;
    
    async function initializeData() {
      if (typeof window !== 'undefined' && isMounted) {
        const storedUserId = localStorage.getItem('userId');
        const storedReferralCode = localStorage.getItem('userReferralCode');
        const storedUserReferredByCode = localStorage.getItem('userReferredByCode');

        if (storedUserId) setUserId(storedUserId);
        if (storedReferralCode) setUserReferralCode(storedReferralCode);

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
        
        if (pb.authStore.isValid) {
           fetchLiveStats();
        } else {
            setIsLoadingStats(false); 
            setLiveReferralStats({ referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
            setErrorLoadingStats("User not authenticated. Please log in to view referral stats.");
        }
      }
    }

    initializeData();

    return () => {
      isMounted = false;
    };
  }, [fetchLiveStats]);

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
  
  const defaultStats: NonNullable<User['referralStats']> = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
  const statsToDisplay = liveReferralStats || defaultStats;


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

      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <BarChart3 className="mr-3 h-6 w-6 text-accent" />
            Your Referral Statistics
          </CardTitle>
          <CardDescription>
            Track how many users have signed up using your referral code, based on their current plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading statistics...</p>
            </div>
          ) : errorLoadingStats ? (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Statistics</AlertTitle>
              <AlertDescription>
                {errorLoadingStats}
                {errorLoadingStats.includes("Admin client initialization") && (
                  <p className="mt-2 text-xs">
                    Please ensure PocketBase admin credentials (POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD) and NEXT_PUBLIC_POCKETBASE_URL are correctly set in your .env file, and the Next.js server is restarted. Check server logs for detailed errors.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>
          )}
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

