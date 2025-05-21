
import type { ReactNode } from 'react';

export default function LessonPageLayout({ children }: { children: ReactNode }) {
  // This simple layout allows the page to take over the full screen
  // by not including the main app sidebar or header.
  return <div className="h-screen w-screen flex flex-col bg-background">{children}</div>;
}
