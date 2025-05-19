'use client';

import SignupPageContent from './[code]/page';

export default function SignupPage() {
  // This page renders the content from the dynamic route version
  // without any referral code pre-filled from the URL.
  // SignupPageContent will use useParams to get the code if it's part of the route.
  return <SignupPageContent />;
}
