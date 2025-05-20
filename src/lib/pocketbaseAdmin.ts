
'use server';
import PocketBase, { type ClientResponseError } from 'pocketbase';

let adminPbInstance: PocketBase | null = null;
let adminAuthPromise: Promise<PocketBase | null> | null = null; // To prevent concurrent initializations

const POCKETBASE_URL_ENV = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL_ENV = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD_ENV = process.env.POCKETBASE_ADMIN_PASSWORD;

async function initializeAndAuthenticateAdminClient(): Promise<PocketBase | null> {
  console.log(`[PocketBase Admin Init] Initializing admin client.`);
  console.log(`[PocketBase Admin Init] NEXT_PUBLIC_POCKETBASE_URL from env: ${POCKETBASE_URL_ENV || '[NOT SET]'}`);
  console.log(`[PocketBase Admin Init] POCKETBASE_ADMIN_EMAIL from env: ${ADMIN_EMAIL_ENV ? '****' : '[NOT SET]'}`);
  console.log(`[PocketBase Admin Init] POCKETBASE_ADMIN_PASSWORD from env: ${ADMIN_PASSWORD_ENV ? '[SET]' : '[NOT SET]'}`);

  if (!POCKETBASE_URL_ENV) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: NEXT_PUBLIC_POCKETBASE_URL is not set in .env. Admin client cannot be initialized.");
    return null;
  }
  if (!ADMIN_EMAIL_ENV || !ADMIN_PASSWORD_ENV) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env. Cannot authenticate admin client.");
    return null;
  }

  // Ensure POCKETBASE_URL_ENV does not end with a slash for clean concatenation
  const cleanPocketbaseUrl = POCKETBASE_URL_ENV.endsWith('/') ? POCKETBASE_URL_ENV.slice(0, -1) : POCKETBASE_URL_ENV;
  const expectedAdminAuthUrl = `${cleanPocketbaseUrl}/api/admins/auth-with-password`;
  
  console.log(`[PocketBase Admin Init] Attempting to create PocketBase client with base URL: ${cleanPocketbaseUrl}`);
  console.log(`[PocketBase Admin Init] Expected full admin authentication URL: ${expectedAdminAuthUrl}`);
  
  const client = new PocketBase(cleanPocketbaseUrl);
  client.autoCancellation(false);

  try {
    console.log(`[PocketBase Admin Init] Attempting to authenticate admin (${ADMIN_EMAIL_ENV})...`);
    await client.admins.authWithPassword(ADMIN_EMAIL_ENV, ADMIN_PASSWORD_ENV, {
      autoRefreshThreshold: 30 * 60,
    });
    console.log("[PocketBase Admin Init] Admin authentication successful.");
    adminPbInstance = client;
    return adminPbInstance;
  } catch (err) {
    console.error("[PocketBase Admin Init] CRITICAL ERROR: Admin authentication failed during initialization.");
    const clientError = err as ClientResponseError;
    if (clientError.isAbort === false && clientError.status === 404) {
        console.error(`[PocketBase Admin Init] DETAIL: Received 404 Not Found (url: ${clientError.url || 'N/A'}) when trying to authenticate admin at ${expectedAdminAuthUrl}.`);
        console.error(`[PocketBase Admin Init] This strongly indicates NEXT_PUBLIC_POCKETBASE_URL (current value: "${POCKETBASE_URL_ENV}") is incorrect. It should be the ROOT URL of your PocketBase instance (e.g., https://your-pb.com or http://127.0.0.1:8090), NOT including '/api' or other subpaths.`);
    } else if (clientError.isAbort === false && clientError.status === 400) {
        console.error(`[PocketBase Admin Init] DETAIL: Received 400 Bad Request. This usually means invalid admin email or password. Please verify POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file.`);
    } else {
        console.error("[PocketBase Admin Init] DETAIL: Error details:", err);
        if (clientError.originalError) {
            console.error("[PocketBase Admin Init] Original Error:", clientError.originalError);
        }
    }
    adminPbInstance = null;
    return null;
  }
}

export async function getPocketBaseAdmin(): Promise<PocketBase | null> {
  if (adminPbInstance && adminPbInstance.authStore.isValid && adminPbInstance.authStore.isAdmin) {
    return adminPbInstance;
  }

  if (adminAuthPromise) {
    return adminAuthPromise;
  }

  adminAuthPromise = initializeAndAuthenticateAdminClient();
  
  try {
    const result = await adminAuthPromise;
    return result;
  } finally {
    adminAuthPromise = null; 
  }
}

export async function requirePocketBaseAdmin(): Promise<PocketBase> {
  const client = await getPocketBaseAdmin();
  if (!client) {
    throw new Error("Failed to get an authenticated PocketBase admin client. Critical server configuration issue. Check server logs for details (especially NEXT_PUBLIC_POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD in .env).");
  }
  return client;
}
