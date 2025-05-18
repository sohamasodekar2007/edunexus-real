
import { redirect } from 'next/navigation';
import { use } from 'react'; // ADDED

export default function HomePage({
  params,
  searchParams
}: {
  params: { [key: string]: string | string[] | undefined };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Attempt to unwrap params and searchParams as per Next.js 15 warning
  const _resolvedParams = use(params);
  const _resolvedSearchParams = use(searchParams);

  redirect('/landing');
  return null; // Or a loading spinner, but redirect handles it.
}
