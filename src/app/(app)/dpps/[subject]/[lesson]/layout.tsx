
import type { ReactNode } from 'react';
import { use } from 'react';

export default function LessonPageLayout({
  children,
  params: paramsAsProp, // Renamed incoming prop
  searchParams: searchParamsAsProp, // Renamed incoming prop
}: {
  children: ReactNode;
  params: any; // Type for the incoming params prop
  searchParams?: any; // Type for the incoming searchParams prop
}) {
  // Ensure params is unwrapped immediately. For dynamic routes, Next.js should always provide params.
  const params = use(paramsAsProp);

  // Conditionally unwrap searchParams only if it exists to avoid 'use(undefined)'.
  const searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined;

  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  // Added overflow-hidden to ensure the layout container itself doesn't show scrollbars.
  return <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">{children}</div>;
}
