
'use server';
import PocketBase, { ClientResponseError } from 'pocketbase';

// This module provides a pre-authenticated admin PocketBase client instance.
// It's intended for server-side actions that require administrative privileges.

let adminPbClient: PocketBase | null = null;
let adminAuthPromise: Promise<PocketBase | null> | null = null;

async function initializeAdminClient(): Promise<PocketBase | null> {
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
  const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  console.log("[PocketBase Admin Init] Attempting to initialize admin client.");
  console.log(`[PocketBase Admin Init] POCKETBASE_ADMIN_EMAIL detected: ${adminEmail ? '****' : '[NOT SET]'}`);
  console.log(`[PocketBase Admin Init] POCKETBASE_ADMIN_PASSWORD detected: ${adminPassword ? '[SET]' : '[NOT SET]'}`);
  console.log(`[PocketBase Admin Init] NEXT_PUBLIC_POCKETBASE_URL detected: ${pocketbaseUrl || '[NOT SET]'}`);

  if (!adminEmail || !adminPassword) {
    console.error("[PocketBase Admin Init Failure]: POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file.");
    return null;
  }
  if (!pocketbaseUrl) {
    console.error("[PocketBase Admin Init Failure]: NEXT_PUBLIC_POCKETBASE_URL not set in .env file.");
    return null;
  }

  const client = new PocketBase(pocketbaseUrl);
  client.autoCancellation(false); // Recommended for server-side, long-running scenarios

  try {
    const expectedAdminAuthUrl = `${pocketbaseUrl.replace(/\/$/, '')}/api/admins/auth-with-password`;
    console.log(`[PocketBase Admin Init] Expected full admin authentication URL: ${expectedAdminAuthUrl}`);
    await client.admins.authWithPassword(adminEmail, adminPassword, {
      autoRefreshThreshold: 30 * 60 // Auto-refresh if token expires in next 30 mins
    });
    console.log("[PocketBase Admin Init] Admin authentication successful.");
    adminPbClient = client;
    return adminPbClient;
  } catch (err) {
    console.error("[PocketBase Admin Init Error] Failed to authenticate admin PocketBase instance:", err);
    if (err instanceof ClientResponseError) {
      console.error("[PocketBase Admin Init Error] PocketBase ClientResponseError details:", JSON.stringify(err.data, null, 2));
      if (err.status === 404) {
        console.error(`[PocketBase Admin Init Failure]: Admin authentication failed: Endpoint /api/admins/auth-with-password not found (404). This usually means NEXT_PUBLIC_POCKETBASE_URL in your .env file (current value: ${pocketbaseUrl}) is incorrect. It should be the ROOT URL of your PocketBase instance (e.g., https://your-domain.com or http://127.0.0.1:8090), not including '/api' or other subpaths.`);
      } else if (err.status === 400) {
        console.error("[PocketBase Admin Init Failure]: Admin authentication failed: Invalid admin email or password (400). Please verify POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file.");
      }
    }
    return null;
  }
}

/**
 * Returns a promise that resolves to an admin-authenticated PocketBase client instance,
 * or null if authentication fails.
 * Ensures that initialization and authentication happen only once.
 */
export async function getPocketBaseAdmin(): Promise<PocketBase | null> {
  if (adminPbClient && adminPbClient.authStore.isValid && adminPbClient.authStore.isAdmin) {
    return adminPbClient;
  }
  if (!adminAuthPromise) {
    adminAuthPromise = initializeAdminClient();
  }
  try {
    const client = await adminAuthPromise;
    if (client && client.authStore.isValid && client.authStore.isAdmin) {
      return client;
    }
    // Reset promise if auth failed to allow retry on next call, though this might not be ideal
    // depending on whether the error is transient or due to bad config.
    adminAuthPromise = null; 
    return null;
  } catch (error) {
    adminAuthPromise = null;
    return null;
  }
}

/**
 * Returns a promise that resolves to an admin-authenticated PocketBase client instance.
 * Throws an error if admin client initialization or authentication fails.
 * This is useful for actions that strictly require admin access.
 */
export async function requirePocketBaseAdmin(): Promise<PocketBase> {
  const adminClient = await getPocketBaseAdmin();
  if (!adminClient) {
    // The detailed error would have been logged by initializeAdminClient
    throw new Error("Admin client initialization or authentication failed. Check server logs for details.");
  }
  return adminClient;
}
