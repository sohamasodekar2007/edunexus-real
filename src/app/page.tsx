
import { redirect } from 'next/navigation';
import { use } from 'react';

export default function HomePage({
  params,
  searchParams
}: {
  params: { [key: string]: string | string[] | undefined };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Ensure params and searchParams are unwrapped before any potential enumeration
  use(params);
  use(searchParams);

  redirect('/landing');
  return null; // Or a loading spinner, but redirect handles it.
}
