
import type { ReactNode } from 'react';
import { use } from 'react';

export default function LessonPageLayout({
  children,
  params,
  searchParams,
}: {
  children: ReactNode;
  // The 'params' prop for a dynamic route's layout/page is expected to be the "use-able" resource.
  params: { [key: string]: string | string[] | undefined };
  // The 'searchParams' prop can be undefined if there are no search parameters.
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // Ensure params is unwrapped immediately. For dynamic routes, Next.js should always provide params.
  use(params);

  // Conditionally unwrap searchParams only if it exists to avoid 'use(undefined)'.
  if (searchParams) {
    use(searchParams);
  }

  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  // Added overflow-hidden to ensure the layout container itself doesn't show scrollbars.
  return <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">{children}</div>;
}
