
import type { ReactNode } from 'react';
import { use } from 'react';

export default function LessonPageLayout({
  children,
  params: paramsAsProp,
}: {
  children: ReactNode;
  params: any; // params are expected for dynamic layouts
  // searchParams are not typically passed to layout components
}) {
  // Next.js expects params to be unwrapped in Server Components that receive them.
  const params = use(paramsAsProp); 

  return <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">{children}</div>;
}
