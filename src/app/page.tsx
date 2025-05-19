'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pocketbase';
import { Logo } from '@/components/icons';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // PocketBase SDK automatically tries to load auth state from localStorage on init.
    // This effect runs on the client after initial hydration.
    if (pb.authStore.isValid) {
      router.replace('/dashboard');
    } else {
      router.replace('/landing');
    }
  }, [router]);

  // Optional: Render a loading indicator while the redirect happens
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Logo className="h-16 w-16 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading...</p>
    </div>
  );
}
