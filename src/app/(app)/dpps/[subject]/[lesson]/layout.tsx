
import type { ReactNode } from 'react';
import { use } from 'react'; // Import use

export default function LessonPageLayout({
  children,
  params: paramsAsProp,
}: {
  children: ReactNode;
  params: any; // params for dynamic routes are generally expected to be defined
  // searchParams is not typically used by layout components directly
}) {
  // Next.js expects params to be unwrapped in Server Components that receive them.
  // For dynamic route layouts, params (from route segments) are always present.
  const params = use(paramsAsProp);

  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  // Added overflow-hidden to ensure the layout container itself doesn't show