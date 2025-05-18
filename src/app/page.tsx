
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/landing');
  return null; // Or a loading spinner, but redirect handles it.
}
