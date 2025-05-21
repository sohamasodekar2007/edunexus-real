
import type { ReactNode } from 'react';
import { use } from 'react';

export default function LessonPageLayout({
  children,
  params,
  searchParams,
}: {
  children: ReactNode;
  params: { [key: string]: string | string[] | undefined };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Ensure params and searchParams are unwrapped before any potential enumeration,
  // only if they are actually provided and not undefined.
  if (params !== undefined) {
    use(params);
  }
  if (searchParams !== undefined) {
    use(searchParams);
  }

  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  return <div className="h-screen w-screen flex flex-col bg-background">{children}</div>;
}
