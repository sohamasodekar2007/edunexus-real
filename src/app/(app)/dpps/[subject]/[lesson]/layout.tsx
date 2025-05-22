
import type { ReactNode } from 'react';
import { use } from 'react';

export default function LessonPageLayout({
  children,
  params: paramsAsProp, // Renamed incoming prop
}: {
  children: ReactNode;
  params: any; // Type for the incoming params prop
  // searchParams is not a standard prop for layout components
}) {
  // Ensure params is unwrapped immediately. For dynamic routes, Next.js should always provide params.
  const params = use(paramsAsProp);

  // The 'params' variable can be used here if needed by the layout, e.g., for logging or conditional rendering based on params.
  // console.log('DPP Lesson Layout Params:', params);

  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  // Added overflow-hidden to ensure the layout container itself doesn't show scrollbars.
  return <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">{children}</div>;
}
