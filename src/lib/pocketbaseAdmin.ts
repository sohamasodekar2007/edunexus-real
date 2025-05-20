'use server';
import PocketBase, { type ClientResponseError } from 'pocketbase';

let adminPbInstance: PocketBase | null = null;
let adminAuthPromise: Promise<PocketBase | null> | null = null;

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

async function initializeAndAuthenticateAdminClient(): Promise<PocketBase | null> {
  if (!POCKETBASE_URL) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: NEXT_PUBLIC_POCKETBASE_URL is not set in .env. Cannot initialize admin client.");
    return null;
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env. Cannot authenticate admin client.");
    return null;
  }

  console.log(`[PocketBase Admin Init] Initializing admin client for URL: ${POCKETBASE_URL}`);
  const client = new PocketBase(POCKETBASE_URL);
  client.autoCancellation(false); // Good for long-running server processes

  try {
    console.log(`[PocketBase Admin Init] Attempting to authenticate admin (${ADMIN_EMAIL ? 'email provided' : 'NO EMAIL PROVIDED'})...`);
    await client.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD, {
      // This will trigger auto refresh or auto reauthentication in case
      // the token has expired or is going to expire in the next 30 minutes.
      autoRefreshThreshold: 30 * 60,
    });
    console.log("[PocketBase Admin Init] Admin authentication successful.");
    adminPbInstance = client;
    return adminPbInstance;
  } catch (err) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: Admin authentication failed during initialization.");
    const clientError = err as ClientResponseError;
    if (clientError.isAbort === false && clientError.status === 404) {
        console.error(`[PocketBase Admin Init] DETAIL: Received 404 Not Found (url: ${clientError.url}) when trying to authenticate admin. This strongly indicates NEXT_PUBLIC_POCKETBASE_URL (current value: "${POCKETBASE_URL}") is incorrect. It should be the ROOT URL of your PocketBase instance (e.g., https://your-pb.com or http://127.0.0.1:8090), NOT including '/api' or other subpaths.`);
    } else if (clientError.isAbort === false && clientError.status === 400) {
        console.error(`[PocketBase Admin Init] DETAIL: Received 400 Bad Request. This usually means invalid admin email or password. Please verify POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file.`);
    } else {
        console.error("[PocketBase Admin Init] DETAIL: Error details:", err);
    }
    adminPbInstance = null; // Ensure it's null on failure
    return null;
  }
}

/**
 * Gets a shared, admin-authenticated PocketBase client instance.
 * Initializes and authenticates the client on the first call.
 * Subsequent calls return the cached instance if valid.
 */
export async function getPocketBaseAdmin(): Promise<PocketBase | null> {
  if (adminPbInstance && adminPbInstance.authStore.isValid && adminPbInstance.authStore.isAdmin) {
    return adminPbInstance;
  }

  // If there's an ongoing initialization promise, await its completion
  if (adminAuthPromise) {
    return adminAuthPromise;
  }

  // No valid cached instance and no ongoing promise, so initialize
  adminAuthPromise = initializeAndAuthenticateAdminClient();
  
  try {
    const result = await adminAuthPromise;
    return result;
  } finally {
    adminAuthPromise = null; // Clear the promise once it's resolved or rejected
  }
}

/**
 * Utility function that requires an admin client or throws an error.
 * Useful for operations that absolutely must not proceed without admin auth.
 */
export async function requirePocketBaseAdmin(): Promise<PocketBase> {
  const client = await getPocketBaseAdmin();
  if (!client) {
    // This error will be caught by the server action and can be relayed to the client.
    // The detailed error of why client is null would have been logged by initializeAndAuthenticateAdminClient.
    throw new Error("Failed to get an authenticated PocketBase admin client. Critical server configuration issue. Check server logs for details.");
  }
  return client;
}
