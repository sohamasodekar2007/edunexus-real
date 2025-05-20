
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, BookOpen, Zap, RefreshCw, Target, PartyPopper, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserModel } from '@/types';

interface PlanFeature {
  text: string;
  available: boolean;
}

interface SubscriptionPlan {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  price: string;
  period: string;
  features: PlanFeature[];
  buttonText: string;
  buttonHref?: string; 
  isFeatured?: boolean;
  dataAiHint?: string;
  mapsToModel?: UserModel; // To map plan card to user model
}

const allPlans: SubscriptionPlan[] = [
  {
    id: 'chapterwise',
    icon: BookOpen,
    title: 'Chapterwise Mastery',
    description: 'Focus your preparation with unlimited access to all chapter-specific tests.',
    price: '₹600',
    period: '/year',
    features: [
      { text: 'All Chapter-wise Tests', available: true },
      { text: 'Detailed Solutions', available: true },
      { text: 'Performance Analysis per Chapter', available: true },
      { text: 'Regular DPP Access', available: true },
    ],
    buttonText: 'Get Chapterwise Plan',
    isFeatured: false,
    mapsToModel: 'Chapterwise',
  },
  {
    id: 'fullLength',
    icon: Target,
    title: 'Full-Length Pro',
    description: 'Master exam patterns with our comprehensive full-length mock tests.',
    price: '₹500',
    period: '/year',
    features: [
      { text: 'All Full-Length Mock Tests', available: true },
      { text: 'Detailed Test Analytics', available: true },
      { text: 'Rank Prediction', available: true },
      { text: 'Time Management Strategies', available: true },
    ],
    buttonText: 'Get Full-Length Plan',
    isFeatured: false,
    mapsToModel: 'Full_length',
  },
  {
    id: 'combo',
    icon: Zap,
    title: 'Combo Ultimate',
    description: 'The complete package for ultimate exam readiness. Access everything!',
    price: '₹1000',
    period: '/year',
    features: [
      { text: 'All Chapter-wise Tests', available: true },
      { text: 'All Full-Length Mock Tests', available: true },
      { text: 'All PYQ DPPs (Including Latest Year)', available: true },
      { text: 'Priority Support', available: true },
      { text: 'Exclusive Content (Coming Soon)', available: false },
    ],
    buttonText: 'Get Combo Plan',
    isFeatured: true,
    mapsToModel: 'Combo',
  },
  {
    id: 'pyq', // Assuming this maps to 'Dpp' model
    icon: RefreshCw,
    title: 'Latest PYQ Access',
    description: 'Stay ahead with access to the most recent Previous Year Questions and DPPs.',
    price: '₹349',
    period: '/year',
    features: [
      { text: 'Latest Year PYQs', available: true },
      { text: 'All Past Year PYQ DPPs', available: true },
      { text: 'Understand Current Exam Trends', available: true },
      { text: 'Essential for Final Revision', available: true },
    ],
    buttonText: 'Get PYQ Access',
    isFeatured: false,
    mapsToModel: 'Dpp',
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [currentUserModel, setCurrentUserModel] = useState<UserModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const model = localStorage.getItem('userModel') as UserModel | null;
      setCurrentUserModel(model);
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading plans...</p>
      </div>
    );
  }

  if (currentUserModel === 'Combo') {
    return (
      <div className="min-h-screen bg-background text-foreground py-8 sm:py-12 px-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-xl">
          <CardHeader>
            <PartyPopper className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">Congratulations!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground mb-6">
              You are on the top-tier <strong>Combo Ultimate</strong> plan. You have access to all features!
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const plansToShow = allPlans.filter(plan => {
    if (!currentUserModel || currentUserModel === 'Free' || currentUserModel === 'Teacher') {
      return true; // Show all plans for Free or Teacher users
    }
    // Hide the plan if the user is already on it
    return plan.mapsToModel !== currentUserModel;
  });


  return (
    <div className="min-h-screen bg-background text-foreground py-8 sm:py-12 px-4">
      <div className="container mx-auto">
        <header className="text-center mb-10 sm:mb-16">
          <ShoppingBag className="h-16 w-16 sm:h-20 sm:w-20 text-primary mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
            EduNexus Subscription Plans
          </h1>
          <p className="text-md sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan to supercharge your exam preparation.
          </p>
        </header>

        {plansToShow.length > 0 ? (
            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 items-stretch">
            {plansToShow.map((plan) => (
                <Card
                key={plan.id}
                className={`flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 ${
                    plan.isFeatured ? 'border-2 border-primary ring-2 ring-primary/50 relative' : 'border'
                }`}
                >
                {plan.isFeatured && (
                    <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-sm font-semibold"
                    >
                    Most Popular
                    </Badge>
                )}
                <CardHeader className="pt-8">
                    <div className="flex items-center justify-center mb-3">
                    <plan.icon className={`h-10 w-10 ${plan.isFeatured ? 'text-primary' : 'text-accent'}`} />
                    </div>
                    <CardTitle className="text-2xl font-semibold text-center">{plan.title}</CardTitle>
                    <CardDescription className="text-center min-h-[3em] text-sm mt-1">
                    {plan.description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 pt-2 pb-6">
                    <div className="text-center mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                        <CheckCircle
                            className={`h-5 w-5 mr-2 shrink-0 ${
                            feature.available ? 'text-green-500' : 'text-muted-foreground/50'
                            }`}
                        />
                        <span className={!feature.available ? 'text-muted-foreground/70 line-through' : ''}>
                            {feature.text}
                        </span>
                        </li>
                    ))}
                    </ul>
                </CardContent>
                <CardFooter className="mt-auto pb-6">
                    <Button
                    size="lg"
                    className={`w-full ${plan.isFeatured ? '' : 'bg-primary/80 hover:bg-primary'}`}
                    variant={plan.isFeatured ? 'default' : 'secondary'}
                    onClick={() => alert(`Proceeding to ${plan.buttonText}... (Payment integration needed)`)}
                    >
                    {plan.buttonText}
                    </Button>
                </CardFooter>
                </Card>
            ))}
            </main>
        ) : (
            <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-muted-foreground">No upgrade options available for your current plan.</h2>
                <Button onClick={() => router.push('/dashboard')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
                </Button>
            </div>
        )}


        <footer className="text-center mt-12 sm:mt-16 text-sm text-muted-foreground">
          <p>All prices are inclusive of applicable taxes. Subscriptions are typically for a one-year period.</p>
          <p>For support, contact <a href="mailto:support@edunexus.com" className="text-primary hover:underline">support@edunexus.com</a>.</p>
        </footer>
      </div>
    </div>
  );
}
