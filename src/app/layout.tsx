
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';
// Removed: import { use } from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'EduNexus',
  description: 'Comprehensive exam preparation platform for MHT-CET, JEE, and NEET.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  // Removed params and searchParams from props as RootLayout does not use them
}>) {
  // No use(params) or use(searchParams) needed here
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider>
          {children}
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
