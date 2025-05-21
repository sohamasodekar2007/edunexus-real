
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { format } from 'date-fns';
// import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    // Return success false but empty message so client doesn't show "Invalid code" for empty/short input
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();
  const actionName = "Validate Referral Code Action";
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      // Consistent with not showing error for invalid codes until submission
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    // Consistent with not showing error for invalid codes until submission
    return { success: false, message: "" };
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const actionName = "Signup User Action";
  console.log(`[${actionName}] Attempting signup for email: ${data.email}`);
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.warn(`[${actionName}] Validation failed: ${errorMessages}`);
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;
  const upperCaseReferredByCode = referredByCodeInput?.trim().toUpperCase() || null;
  let newUser;

  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();

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
      referredByCode: upperCaseReferredByCode, // Save the entered code
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null,
      avatar: null, // PocketBase handles default avatar or null
      emailVisibility: true,
      verified: false, // PocketBase handles email verification flow if enabled
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data:`, Omit(userDataForPocketBase, 'password', 'passwordConfirm'));
    
    // Create user with global/public client instance
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUser.id}`);

  } catch (error) {
    console.error(`[${actionName}] User Creation Failed in PocketBase:`, error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError (User Creation) details (error.data):`, JSON.stringify(error.data, null, 2));
        genericMessage = error.data?.message || genericMessage;
        const pbFieldErrors = error.data?.data;
        if (pbFieldErrors && typeof pbFieldErrors === 'object') {
            specificDetails = Object.keys(pbFieldErrors).map(key => {
                const fieldError = pbFieldErrors[key];
                if (fieldError && fieldError.message) {
                    return `${key}: ${fieldError.message}`;
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

  // If new user was created and a referral code was provided (and potentially validated earlier on client)
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal);
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats, // preserve other stats
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        
        // Attempt to update referrer stats. This might require admin if rules are strict for updating other users.
        // If admin credentials are not configured, this might fail silently or log a warning.
        const adminPbForReferrerUpdate = null; // No longer attempting to use getAdminPb for this
        // For now, we'll skip trying to update referrer stats without admin or a dedicated mechanism
        console.warn(`[${actionName}] Referrer stats update for ${upperCaseReferredByCode} skipped as it would require admin privileges or a dedicated mechanism to update another user's record. New user signup was successful.`);
        // await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPbForReferrerUpdate || pbGlobal);
        // console.log(`[${actionName}] Successfully updated referral stats for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message);
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
  userName?: string,
  userModel?: UserModel | null,
  userRole?: UserRole | null,
  userClass?: UserClass | null,
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: number | string | null,
  userReferralCode?: string | null,
  userReferredByCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const actionName = "Login User Action";
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();
  console.log(`[${actionName}] Attempting login for: ${normalizedEmail}`);

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User; // Cast to your User type
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User'; // Assuming first name is first part of 'name'
    
    let avatarUrl = null;
    if (user.avatar) { // avatar is filename
        avatarUrl = pbGlobal.getFileUrl(user, user.avatar as string);
    }

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
      userEmail: user.email, // Already normalized
      userPhone: user.phone || null,
      userTargetYear: user.targetYear || null,
      userReferralCode: user.referralCode || null, // User's own code
      userReferredByCode: user.referredByCode || null, // Code they used to sign up
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error(`[${actionName}] Login Error for ${normalizedEmail}:`, error);
    let errorMessage = 'Login Failed: Invalid email or password.';
     if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data));
        if (error.status === 400) { // Typically "Failed to authenticate."
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) {
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
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  console.log(`[${actionName}] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  
  if (!userId) {
    const errorMsg = "User ID is required for profile update. (UPA_E001)";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: errorMsg };
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
      dataForPocketBase.targetYear = !isNaN(year) ? year : null;
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }

  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    // This uses pbGlobal, relying on the client being authenticated and PocketBase rules.
    // For users updating their own profiles, 'users' collection updateRule should be @request.auth.id = id
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[${actionName}] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile (UPA_E002).";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to update this profile. (UPA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not update profile (UPA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update profile (UPA_E005).";
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";
  const currentAuthUser = pbGlobal.authStore.model;

  if (!currentAuthUser || !currentAuthUser.id) {
    const noAuthMsg = "User not authenticated or user context not available to server action (GRIA_E001).";
    console.warn(`[${actionName}] ${noAuthMsg}`);
    return { referrerName: null, error: noAuthMsg };
  }

  let currentUserRecord;
  try {
    // Fetch the full current user record to get their 'referredByCode'
    // This ensures we have the latest data, not just what's in authStore.model
    currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal);
  } catch (e) {
     const fetchUserError = `Error fetching current user's record (ID: ${currentAuthUser.id}): ${e.message} (GRIA_E002).`;
     console.error(`[${actionName}] ${fetchUserError}`);
     return { referrerName: null, error: fetchUserError };
  }

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUser.id}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUser.id}) was referred by code: ${currentUserRecord.referredByCode}`);

  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserRecord.referredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      const notFoundMsg = `Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing (GRIA_E003).`;
      console.warn(`[${actionName}] ${notFoundMsg}`);
      return { referrerName: null, error: notFoundMsg };
    }
  } catch (error) {
    const fetchReferrerError = `Error fetching referrer by code ${currentUserRecord.referredByCode}: ${error.message} (GRIA_E004).`;
    console.error(`[${actionName}] ${fetchReferrerError}`);
    return { referrerName: null, error: fetchReferrerError };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Update User Avatar Action";
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (UAA_E001).";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using user's auth context.`);

  try {
    // Assumes 'users' collection updateRule is like "@request.auth.id = id"
    // pbGlobal, when called from an authenticated client's server action, should carry user's token
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar (UAA_E002).";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to update this avatar. (UAA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not update avatar (UAA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update avatar (UAA_E005).";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Remove User Avatar Action";
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (RAA_E001).";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using user's auth context.`);

  try {
    // Assumes 'users' collection updateRule is like "@request.auth.id = id"
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar (RAA_E002).";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to remove this avatar. (RAA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not remove avatar (RAA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to remove avatar (RAA_E005).";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question.`);
  console.log(`[${actionName}] Received form data keys:`, Array.from(formData.keys()));
  
  // Relies on PocketBase 'question_bank' "Create Rule" being appropriate (e.g., public "" or role-based).
  // If rule is "@request.auth.id != "" && @request.auth.role = "Admin"", then pbGlobal (if client is Admin and auth is passed) should work.
  // If rule is "", then unauthenticated pbGlobal works.
  // If rule is "@request.auth.id != """, then any authenticated user works.

  // Assuming "Create Rule" for question_bank is now "" (public) as per recent discussions
  // or "@request.auth.id != "" && @request.auth.role = "Admin"" and client is Admin
  // No specific server-side pbGlobal.authStore.isValid check for this action's core purpose
  // as PocketBase rules will handle authorization.

  try {
    // Uses global pb instance. If called from an authenticated client, SDK should pass the token.
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question (AQA_E003).";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));

      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) { 
        errorMessage = "Permission Denied: You do not have permission to add questions. Check PocketBase 'question_bank' Create Rule. (AQA_E004).";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors} (AQA_E005)`;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) { 
         errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status (AQA_E006).";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status}) (AQA_E007)`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: "PocketBase operation failed. See server logs for detailed error data and client toast for specifics." };
  }
}


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to calculate live referral stats.`);
  
  let adminPb;
  try {
    // This action needs admin to list all users to calculate live stats.
    // adminPb = await requirePocketBaseAdmin(); // This will throw if admin auth fails
    // For now, let's try to get it and handle if null for better error reporting from this action
    adminPb = null; // Removed direct dependency on admin for now for testing.
    // If you re-enable admin, uncomment the line above and ensure src/lib/pocketbaseAdmin.ts is present and .env is set.
    // This will currently always fail if adminPb is null without the requirePocketBaseAdmin() call or a successful getPocketBaseAdmin()
    
    // SIMPLIFIED - TEMPORARILY REMOVING ADMIN DEPENDENCY FOR THIS ACTION TO PREVENT BLOCKING
    // THIS MEANS IT WON'T WORK AS INTENDED UNTIL ADMIN AUTH IS RESTORED FOR IT
    const simulatedErrorMsg = "Admin functionality for live stats is currently disabled or misconfigured (GLRSA_E000_ADMIN_DISABLED_TEMP). Check server logs.";
    console.warn(`[${actionName}] ${simulatedErrorMsg}`);
    return { 
        success: false, 
        stats: undefined, 
        message: "Live referral stats temporarily unavailable.", 
        error: simulatedErrorMsg 
    };


    // The following code requires adminPb to be a valid admin-authenticated instance
    /*
    if (!adminPb) {
        const authErrorMsg = "Admin client initialization or authentication failed. Check server logs for details (GLRSA_E001).";
        console.warn(`[${actionName}] ${authErrorMsg}`);
        console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, stats: undefined, message: authErrorMsg, error: "Admin auth missing" })}`);
        return { success: false, stats: undefined, message: authErrorMsg, error: "Admin auth missing" };
    }

    const currentAuthUser = adminPb.authStore.model; // This would be the admin user
    if (!currentAuthUser || !currentAuthUser.id) {
      // This check is a bit odd if adminPb is already an admin auth.
      // If we are calculating for *a specific user* calling this, they need to be identified.
      // For now, assuming it's for the *admin's own* referral code, which is not typical.
      // Or it should be for a specific user's referral code passed as a param.
      // Let's assume it's for the *currently logged-in user* if this action were callable by a non-admin
      // but the list all users part still needs admin. This action is fundamentally admin-gated.

      const noUserMsg = "This action is intended for an admin context to fetch stats (GLRSA_E002_ADMIN_CONTEXT_EXPECTED).";
      console.warn(`[${actionName}]`, noUserMsg);
      console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, stats: undefined, message: noUserMsg, error: noUserMsg })}`);
      return { success: false, stats: undefined, message: noUserMsg, error: noUserMsg };
    }
    
    // This part needs to identify for WHICH user we are getting referral stats.
    // For example, if an admin wants to see stats for user X.
    // Or if a user wants to see their own stats.
    // If user is calling, we need THEIR referral code.
    // If admin is calling for someone else, we need that target user's referral code.

    // For now, let's assume this action is meant to be called by a regular user
    // and we get THEIR referral code from pbGlobal (client's auth).
    // BUT, the getFullList still needs admin. This action is flawed without clear context.

    let targetUserReferralCode: string | null = null;
    if (pbGlobal.authStore.isValid && pbGlobal.authStore.model?.referralCode) {
        targetUserReferralCode = pbGlobal.authStore.model.referralCode;
    } else {
        const noClientUserMsg = "No authenticated client user found to get referral code for live stats. (GLRSA_E002B)";
        console.warn(`[${actionName}] ${noClientUserMsg}`);
        return { success: false, stats: undefined, message: noClientUserMsg, error: noClientUserMsg };
    }


    console.log(`[${actionName}] Calculating stats for users referred by code: ${targetUserReferralCode}`);
    const referredUsers = await adminPb.collection('users').getFullList({ // This needs admin
      filter: `referredByCode = "${targetUserReferralCode}"`,
    });

    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
    };

    referredUsers.forEach(user => {
      switch (user.model) {
        case 'Free':
          liveStats.referred_free = (liveStats.referred_free || 0) + 1;
          break;
        case 'Chapterwise':
          liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1;
          break;
        case 'Full_length':
          liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1;
          break;
        case 'Combo':
          liveStats.referred_combo = (liveStats.referred_combo || 0) + 1;
          break;
        default:
          break;
      }
    });
    console.log(`[${actionName}] Successfully calculated live stats:`, JSON.stringify(liveStats));
    return { success: true, stats: liveStats, message: "Stats fetched successfully." };
    */

  } catch (error) {
    console.error(`[${actionName}] Outer catch error:`, error);
    let errMessage = `Failed to calculate live referral stats (GLRSA_E003_OUTER). Check server logs.`;
    let errCode = `GLRSA_E003_OUTER`;

    if (error instanceof ClientResponseError) {
        errMessage = error.data?.message || `PocketBase error: ${error.status} (GLRSA_E004). Check if you have permission to list users.`;
        errCode = `GLRSA_E004_PB_${error.status}`;
        if (error.status === 403) { 
            errMessage = "Permission Denied: You do not have permission to list all users to calculate live referral stats. This action may require admin privileges. (GLRSA_E005)";
            errCode = `GLRSA_E005_PB_403`;
        } else if (error.status === 0) {
          errMessage = "Network Error: Could not connect to PocketBase for live stats (GLRSA_E007_PB_0).";
          errCode = `GLRSA_E007_PB_0`;
        }
    } else if (error instanceof Error && error.message) {
        // If it's the "Admin client initialization..." error from requirePocketBaseAdmin
        if (error.message.startsWith("Admin client initialization")) {
            errMessage = error.message; // Propagate the specific message
            errCode = "ADMIN_INIT_FAIL_GLRSA";
        } else {
            errMessage = error.message;
        }
    }
    console.log(`[${actionName}] Returning error from outer catch: ${JSON.stringify({ success: false, stats: undefined, message: errMessage, error: errCode })}`);
    return { success: false, stats: undefined, message: errMessage, error: errCode };
  }
}


export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);
  
  if (!subject) {
    const errorMsg = "Subject is required to fetch lessons (GLBSA_E002).";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: "Subject required." };
  }

  try {
    // Uses global pb instance. Relies on PocketBase question_bank collection rules being public.
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));
    
    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);
    let errorMessage = `Failed to fetch lessons for ${subject} (GLBSA_E003).`; // Default/fallback
    let errorCode = `GLBSA_E003`;

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error while fetching lessons: ${error.status} (GLBSA_E004).`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = "Permission Denied: You do not have permission to list lessons from the question bank. Check collection rules. (GLBSA_E005)";
        errorCode = `GLBSA_E005_PB_403`;
      } else if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or subject '${subject}' resulted in no records (404). Check PocketBase setup. (GLBSA_E006)`;
        errorCode = `GLBSA_E006_PB_404`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to fetch lessons. Please check your internet connection and the server status (GLBSA_E007).";
        errorCode = `GLBSA_E007_PB_0`;
      }
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMessage, error: errorCode })}`);
    return { 
      success: false, 
      message: errorMessage, // Return the more specific error message
      error: errorCode 
    };
  }
}

    