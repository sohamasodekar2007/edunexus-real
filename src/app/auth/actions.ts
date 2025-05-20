
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';


// Helper function to get an admin-authenticated PocketBase instance
async function getAdminPb(): Promise<PocketBase | null> {
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

  console.log(`[Admin PB Init] Attempting to get admin PB instance.`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_EMAIL detected: ${adminEmail ? '****' : '[NOT SET]'}`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_PASSWORD detected: ${adminPassword ? '[SET]' : '[NOT SET]'}`);


  if (!adminEmail || !adminPassword) {
    const errorMessage = "POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file. Admin-specific operations cannot be performed.";
    console.warn("[Admin PB Init Warning]:", errorMessage);
    return null;
  }

  const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;
  if (!pocketbaseUrl) {
    console.error("[Admin PB Init Error] NEXT_PUBLIC_POCKETBASE_URL is not set in .env file.");
    return null;
  }
  
  const adminPb = new PocketBase(pocketbaseUrl);
  try {
    await adminPb.admins.authWithPassword(adminEmail, adminPassword);
    console.log("[Admin PB Init] Admin authentication successful.");
    return adminPb;
  } catch (err) {
    console.error("[Admin PB Init Error] Failed to authenticate admin PocketBase instance:", err);
    let clientErrorMessage = "Could not authenticate admin for a server action. Please check server logs.";
    if (err instanceof ClientResponseError) {
      console.error("[Admin PB Init Error] PocketBase ClientResponseError details:", JSON.stringify(err.data, null, 2));
      if (err.status === 404) {
        clientErrorMessage = `Admin authentication failed: Endpoint /api/admins/auth-with-password not found (404). This usually means NEXT_PUBLIC_POCKETBASE_URL in your .env file (current value: ${pocketbaseUrl}) is incorrect. It should be the ROOT URL of your PocketBase instance (e.g., https://your-domain.com or http://127.0.0.1:8090), not including '/api' or other subpaths.`;
      } else if (err.status === 400) {
        clientErrorMessage = "Admin authentication failed: Invalid admin email or password. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file and ensure the Next.js server was restarted.";
      } else if (err.status === 0) {
        clientErrorMessage = "Admin authentication failed: Network error. Could not connect to PocketBase server. Check server status and NEXT_PUBLIC_POCKETBASE_URL."
      } else {
        clientErrorMessage = `Admin authentication failed with PocketBase status ${err.status}. Check server logs.`;
      }
    }
    console.warn("[Admin PB Init Failure]:", clientErrorMessage);
    return null;
  }
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();
  try {
    // For validation, we don't need admin rights if the users collection 'viewRule' for referralCode is public enough or if it's accessible via API rule.
    // However, to be safe and consistent if rules are tightened, an admin instance might be preferred.
    // For now, assuming global pb instance can list by referralCode if collection rule allows.
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); 
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "" }; 
    }
  } catch (error) {
    console.error('Error validating referral code action:', error);
    return { success: false, message: "" };
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;
  const upperCaseReferredByCode = referredByCodeInput?.trim().toUpperCase() || null;

  let newUser;
  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();
    const avatarUrl = `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`;


    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      passwordConfirm: password,
      name: combinedName,
      phone,
      class: userClass || null,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: upperCaseReferredByCode,
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null,
      avatar: null, // PocketBase handles file uploads separately. This field is for the filename.
      emailVisibility: true,
      verified: false,
      // avatarUrl: avatarUrl, // This is not a standard PocketBase field to store. PocketBase generates URL from 'avatar' field.
    };

    console.log("[Signup Action] Attempting to create user with data (password omitted):", { ...userDataForPocketBase, password: '***' });
    
    // Create new user using global PB instance (relies on public createRule for 'users' collection)
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log("[Signup Action] User created successfully:", newUser.id);

  } catch (error) {
    console.error('[Signup Action Error] User Creation Failed:', error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
        console.error('[Signup Action Error] PocketBase ClientResponseError (User Creation) details (error.data):', JSON.stringify(error.data, null, 2));
        genericMessage = error.data?.message || genericMessage;
        const pbFieldErrors = error.data?.data;
        if (pbFieldErrors && typeof pbFieldErrors === 'object') {
            specificDetails = Object.keys(pbFieldErrors).map(key => {
                if (pbFieldErrors[key] && pbFieldErrors[key].message) {
                    return `${key}: ${pbFieldErrors[key].message}`;
                }
                return null;
            }).filter(Boolean).join('; ');
        }
        if (error.status === 0) {
          genericMessage = "Network Error: Could not connect to the server. Please check your internet connection and the server status.";
        }
    } else if (error instanceof Error) {
        genericMessage = error.message || genericMessage;
    }

    let finalErrorMessage = genericMessage;
    if (specificDetails) {
      if (genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.') {
        finalErrorMessage = `${genericMessage}. Details: ${specificDetails}`;
      } else {
        finalErrorMessage = specificDetails;
      }
    }
    if (!finalErrorMessage || !finalErrorMessage.trim()) {
        finalErrorMessage = 'An unknown error occurred during signup.';
    }
    return { success: false, message: `Signup failed: ${finalErrorMessage}`, error: finalErrorMessage };
  }

  // Attempt to update referrer stats if a referral code was used and a new user was created
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    const adminPbForReferrerUpdate = await getAdminPb(); // This part still needs admin
    if (adminPbForReferrerUpdate) {
      try {
        const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPbForReferrerUpdate);
        if (referrerToUpdateStats && referrerToUpdateStats.id) {
          console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
          const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
          const newReferrerStats: User['referralStats'] = {
            ...currentStats,
            referred_free: (currentStats.referred_free || 0) + 1, // Assuming new users are 'Free' model
          };
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPbForReferrerUpdate);
          console.log(`[Signup Action] Referral stats updated for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
        } else {
          console.log(`[Signup Action] No referrer found with code ${upperCaseReferredByCode}. Stats not updated.`);
        }
      } catch (statsError) {
        console.warn(`[Signup Action Warning] Failed to update referral stats for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError);
      }
    } else {
      console.warn(`[Signup Action Warning] Admin PB instance not available. Referrer stats not updated for code ${upperCaseReferredByCode}. User signup was successful.`);
    }
  }

  return { success: true, message: 'Signup successful! Please log in.', userId: newUser.id };
}

export async function loginUserAction(data: { email: string, password_login: string }): Promise<{
  success: boolean;
  message: string;
  error?: string;
  userId?: string,
  userFullName?: string,
  userName?: string, // Assumed to be the first name part of full name
  userModel?: UserModel | null,
  userRole?: UserRole | null,
  userClass?: UserClass | null,
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: number | null,
  userReferralCode?: string | null, // User's own referral code
  userReferredByCode?: string | null, // Code they used to sign up
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }

    const user = authData.record as unknown as User; 
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User'; // Simple first name extraction
    const avatarFilename = user.avatar; // This is the filename string from PocketBase
    const avatarUrl = avatarFilename ? pbGlobal.getFileUrl(user, avatarFilename as string) : null;


    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userId: user.id,
      userFullName: userFullName,
      userName: userName,
      userModel: user.model || null,
      userRole: user.role || null,
      userClass: user.class || null,
      userEmail: user.email,
      userPhone: user.phone || null,
      userTargetYear: user.targetYear || null,
      userReferralCode: user.referralCode || null,
      userReferredByCode: user.referredByCode || null,
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error('[Login Action Error]:', error);
    let errorMessage = 'Invalid email or password.';
     if (error instanceof ClientResponseError) {
        console.error('[Login Action Error] PocketBase ClientResponseError details:', JSON.stringify(error.data));
        if (error.status === 400) { // Bad Request typically means auth failure
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) { // Network error
          errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}


export async function updateUserProfileAction({
  userId,
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string,
  classToUpdate?: UserClass | '', // Allow empty string for "-- Not Set --"
  targetYearToUpdate?: string // From select, could be year string or "-- Not Set --"
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  console.log(`[Update Profile Action] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  if (!userId) {
    return { success: false, message: "User ID is required for profile update.", error: "User ID missing" };
  }

  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};

  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }

  if (targetYearToUpdate !== undefined) {
    if (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '') {
      dataForPocketBase.targetYear = null;
    } else {
      const year = parseInt(targetYearToUpdate, 10);
      if (!isNaN(year)) {
        dataForPocketBase.targetYear = year;
      } else {
        // This case should ideally be prevented by Select options, but as a fallback:
        console.warn(`[Update Profile Action] Invalid target year string received: ${targetYearToUpdate}. Setting to null.`);
         dataForPocketBase.targetYear = null;
      }
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    // No actual changes to make
    return { success: true, message: "No changes to save." };
  }

  console.log(`[Update Profile Action] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  // This action updates the user's OWN profile. PocketBase's updateRule "@request.auth.id = id"
  // means the request must be authenticated AS THE USER being updated.
  // Server actions run on the server and don't automatically have the client's auth context.
  // Using adminPb here is a way to ensure the update happens, but for true user self-service
  // without admin intervention, the client's auth token would need to be used or passed.
  const adminPb = await getAdminPb();
  const pbInstanceToUse = adminPb; // Always try to use admin for this controlled update
  
  if (!pbInstanceToUse) {
    const authErrorMsg = "Profile update failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted.";
    console.warn(`[Update Profile Action] Admin PB instance not available. User: ${userId}. Cannot update profile.`);
    return { success: false, message: authErrorMsg, error: "Admin auth missing or update permission denied" };
  }


  try {
    // const updatedUserRecord = await pbGlobal.collection('users').update(userId, dataForPocketBase); // This would fail due to permissions
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbInstanceToUse);
    console.log(`[Update Profile Action (using admin PB)] Profile updated successfully for user ${userId}:`, updatedUserRecord);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error (using admin PB)] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 0) { // Network error
          errorMessage = "Network Error: Could not connect to the server while updating profile.";
        } else if (error.status === 404) { // Not found
          errorMessage = "User not found. Could not update profile.";
        } else if (error.status === 403) { // Forbidden
           errorMessage = "Permission denied by PocketBase to update profile. Ensure the admin account has sufficient privileges.";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const currentAuthUserId = pbGlobal.authStore.model?.id;
  if (!currentAuthUserId) {
    // This is a server action. pbGlobal.authStore won't have client context here.
    // This action should accept the current user's ID or their referredByCode.
    // Assuming the client will pass the code it has.
    console.warn("[Get Referrer Info Action] This action ideally needs the client's referredByCode to find the referrer's name.");
    // For now, we can't proceed without a way to identify whose referrer we're looking for.
    // Let's assume the client will pass the 'referredByCode' of the current user.
    // This action should be redesigned or called with parameters.
    // For this example, let's say the client _somehow_ made its referredByCode available.
    // This action is currently problematic without more context from the client.
    return { referrerName: null, error: "Cannot determine current user's referrer without more context (e.g., user's referredByCode)." };
  }
  
  // This logic is flawed for a server action without specific input.
  // Correct approach: client calls this with its own user.referredByCode.
  // getReferrerNameByCodeAction(code: string) would be better.

  // Simulating a redesigned action that receives the code:
  // async function getReferrerNameByCodeAction(code: string): Promise<{ referrerName: string | null; error?: string }> {
  //   if (!code) return { referrerName: null, error: "No referral code provided." };
  //   const adminPb = await getAdminPb();
  //   if (!adminPb) {
  //     return { referrerName: null, error: "Admin authentication required to fetch referrer details." };
  //   }
  //   const referrer = await findUserByReferralCode(code, adminPb);
  //   if (referrer) return { referrerName: referrer.name };
  //   return { referrerName: null, error: "Referrer not found." };
  // }
  // This is a placeholder for a more robust solution.
  return { referrerName: null, error: "Action needs redesign to accept referredByCode." };
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  // Get current user ID from the client-side pbGlobal authStore.
  // This implies the action is called from a context where client's pbGlobal is somehow available or its ID is passed.
  // For server actions, it's better if the client passes its userId.
  // However, PocketBase update rule "@request.auth.id = id" implies client's token should be used.
  // Server actions are tricky here without forwarding the client's token.
  // Using adminPb for now to ensure it works, assuming this is a trusted operation.
  
  const currentAuthUserId = pbGlobal.authStore.model?.id; // This might be null in a server action context
  if (!currentAuthUserId) {
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null. User might not be properly authenticated on the client before calling this action, or client auth context is not available to server action's pbGlobal. Consider passing userId from client.");
     return { success: false, message: "User not authenticated or user ID not available to server action. Please ensure you are logged in.", error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId; // Use the ID if available from client's auth store.
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId}`);

  const adminPb = await getAdminPb();
  const pbInstanceToUse = adminPb; // Using admin for updates to bypass complex user-token forwarding for server actions.
  
  if (!pbInstanceToUse) {
    const authErrorMsg = "Avatar update failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted.";
    console.warn(`[Update Avatar Action] Admin PB instance not available. User: ${userId}. Cannot update avatar.`);
    return { success: false, message: authErrorMsg, error: "Admin auth missing" };
  }

  try {
    // formData should contain the 'avatar' field with the file.
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbInstanceToUse); 
    console.log(`[Update Avatar Action (using admin PB)] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error (using admin PB)] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 404) { // Not found
        errorMessage = "User record not found for avatar update.";
      } else if (error.status === 0) { // Network error
        errorMessage = "Network Error: Could not connect to the server while updating avatar.";
      } else if (error.status === 403) { // Forbidden
        errorMessage = "Permission denied by PocketBase to update avatar. Ensure admin has rights.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const currentAuthUserId = pbGlobal.authStore.model?.id; // See notes in updateUserAvatarAction
   if (!currentAuthUserId) {
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null. User might not be properly authenticated on the client before calling this action, or client auth context is not available to server action's pbGlobal. Consider passing userId from client.");
    return { success: false, message: "User not authenticated or user ID not available to server action. Please ensure you are logged in.", error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId;
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId}`);

  const adminPb = await getAdminPb();
  const pbInstanceToUse = adminPb; // Using admin for updates.

  if (!pbInstanceToUse) {
    const authErrorMsg = "Avatar removal failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted.";
    console.warn(`[Remove Avatar Action] Admin PB instance not available. User: ${userId}. Cannot remove avatar.`);
    return { success: false, message: authErrorMsg, error: "Admin auth missing" };
  }

  try {
    // To remove an avatar, set the 'avatar' field to null.
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbInstanceToUse);
    console.log(`[Remove Avatar Action (using admin PB)] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error (using admin PB)] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
      if (error.status === 404) { // Not found
        errorMessage = "User record not found for avatar removal.";
      } else if (error.status === 0) { // Network error
        errorMessage = "Network Error: Could not connect to the server while removing avatar.";
      } else if (error.status === 403) { // Forbidden
        errorMessage = "Permission denied by PocketBase to remove avatar. Ensure admin has rights.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

// Removed getAllUsersAction as per user request
