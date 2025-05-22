
import type { ReactNode } from 'react';
import { use } from 'react'; // Import use

export default function LessonPageLayout({
  children,
  params: paramsAsProp, // Renamed incoming prop
  // searchParams prop is not typically used by layout components
}: {
  children: ReactNode;
  params: any; // Type for the incoming params prop
}) {
  // Ensure params is unwrapped immediately.
  // Next.js expects these to be unwrapped in Server Components that receive them.
  const params = use(paramsAsProp);
  // searchParams would be unwrapped here if the layout used it:
  // const searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined;


  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  // Added overflow-hidden to ensure the layout container itself doesn't show scrollbars.
  return <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">{children}</div>;
}
