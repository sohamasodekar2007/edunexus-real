import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;

if (!pocketbaseUrl) {
  throw new Error("PocketBase URL is not defined. Please set NEXT_PUBLIC_POCKETBASE_URL in your .env file.");
}

// Initialize PocketBase client, Memoized for SSR
// It's important to memoize the client instance during SSR to avoid leaking the client
// and to prevent re-initializing it on every request.
// See https://pocketbase.io/docs/ssr/#memoization

let pb: PocketBase | null = null;

if (typeof window === 'undefined') {
  // Server-side
  if (!global._pbInstance) {
    global._pbInstance = new PocketBase(pocketbaseUrl);
  }
  pb = global._pbInstance;
} else {
  // Client-side
  if (!window._pbInstance) {
    window._pbInstance = new PocketBase(pocketbaseUrl);
  }
  pb = window._pbInstance;
}

export default pb as PocketBase;

// Extend global types for window and globalThis to avoid TypeScript errors
declare global {
  // eslint-disable-next-line no-var
  var _pbInstance: PocketBase | undefined;
  interface Window {
    _pbInstance?: PocketBase;
  }
}
