
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload } from '@/types';
import { format } from 'date-fns';
// Admin client is no longer used for most actions, relying on user context or public rules.


// Helper function for error responses
function createErrorResponse(message: string, errorCode?: string, details?: any) {
  const response = { success: false, message, error: errorCode || 'Unknown Error', details };
  console.error(`[Server Action Error] Code: ${errorCode}, Message: ${message}, Details:`, details || 'N/A');
  return response;
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const actionName = "Validate Referral Code Action";
  const upperCaseCode = code.trim().toUpperCase();

  if (!upperCaseCode || upperCaseCode.length < 3) {
    return { success: false, message: "" };
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
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
    return createErrorResponse("Validation failed. Please check your inputs.", "SIGNUP_VALIDATION_ERROR", errorMessages);
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
      referredByCode: upperCaseReferredByCode,
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
        referred_dpp: 0,
      },
      targetYear: null,
      avatar: null, // PocketBase handles avatar field internally
      emailVisibility: true,
      verified: false,
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted from log):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal); // Uses global pb instance
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUser.id}`);

  } catch (error) {
    console.error(`[${actionName}] User Creation Failed in PocketBase:`, error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError (User Creation) details:`, JSON.stringify(error.data, null, 2));
      genericMessage = error.data?.message || genericMessage;
      const pbFieldErrors = error.data?.data;
      if (pbFieldErrors && typeof pbFieldErrors === 'object') {
        specificDetails = Object.keys(pbFieldErrors).map(key => {
          const fieldError = pbFieldErrors[key];
          return fieldError && fieldError.message ? `${key}: ${fieldError.message}` : null;
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
      finalErrorMessage = genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.'
        ? `${genericMessage}. Details: ${specificDetails}`
        : specificDetails;
    }
    if (!finalErrorMessage || !finalErrorMessage.trim()) {
      finalErrorMessage = 'An unknown error occurred during signup.';
    }
    return createErrorResponse(`Signup failed: ${finalErrorMessage}`, "SIGNUP_PB_CREATE_ERROR", finalErrorMessage);
  }

  // Attempt to update referrer stats IF a valid code was used
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); // Use global pb for lookup
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        
        // This part attempts to update another user's record.
        // This will likely fail if not using an admin client and PocketBase rules are restrictive.
        // For now, we try with pbGlobal, relying on PocketBase rules.
        // If POCKETBASE_ADMIN_EMAIL and _PASSWORD are set, could use adminClient here for reliability.
        try {
            await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbGlobal); // Try with global for now
            console.log(`[${actionName}] Successfully attempted referral stats update for referrer ${referrerToUpdateStats.name} to`, newReferrerStats);
        } catch (statsUpdateError) {
            console.warn(`[${actionName}] Failed to update referral stats for referrer ${referrerToUpdateStats.name} using standard auth. This might be due to restrictive PocketBase rules for updating other users' records. Error:`, statsUpdateError.message);
        }
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats lookup process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message, statsError);
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
  userTargetYear?: string | null,
  userReferralCode?: string | null,
  userReferredByCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const actionName = "Login User Action";
  const validation = LoginSchema.safeParse({ email: data.email, password: data.password_login });
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return createErrorResponse("Validation failed", "LOGIN_VALIDATION_ERROR", errorMessages);
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();
  console.log(`[${actionName}] Attempting login for: ${normalizedEmail}`);

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return createErrorResponse('Login failed. Please check your credentials.', "LOGIN_INVALID_CREDENTIALS", 'Invalid credentials');
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User';

    let avatarUrl = null;
    if (user.avatar) {
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
      userEmail: user.email,
      userPhone: user.phone || null,
      userTargetYear: user.targetYear?.toString() || null,
      userReferralCode: user.referralCode || null,
      userReferredByCode: user.referredByCode || null,
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error(`[${actionName}] Login Error for ${normalizedEmail}:`, error);
    let errorMessage = 'Login Failed: Invalid email or password.';
    let errorCode = "LOGIN_AUTH_FAILED";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data));
      if (error.status === 400) {
        errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        errorCode = "LOGIN_PB_400_AUTH";
      } else if (error.status === 0) {
        errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        errorCode = "LOGIN_PB_0_NET_ERR";
      } else {
        errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        errorCode = `LOGIN_PB_${error.status}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function updateUserProfileAction({
  userId, // This should ideally be the authenticated user's ID
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string,
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  console.log(`[${actionName}] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);

  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
      console.warn(`[${actionName}] Update Denied: User making request (${pbGlobal.authStore.model?.id}) is not the target user (${userId}) or is not authenticated.`);
      return createErrorResponse("Permission Denied: You can only update your own profile.", "UPA_E001_PERMISSION_DENIED_SERVER");
  }
  
  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};
  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }
  if (targetYearToUpdate !== undefined) {
    const parsedYear = parseInt(targetYearToUpdate, 10);
    dataForPocketBase.targetYear = (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '' || isNaN(parsedYear)) ? null : parsedYear;
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }
  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    // User updates their own record, relying on PocketBase rule @request.auth.id = id
    // pbGlobal should carry the client's auth token here.
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[${actionName}] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = "Permission Denied: You may not have permission to update this profile. Ensure PocketBase 'users' collection updateRule is correctly set (e.g., @request.auth.id = id).";
        errorCode = "UPA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update profile.`;
        errorCode = "UPA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update profile.";
        errorCode = "UPA_PB_0_NET_ERR";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    console.warn(`[${actionName}] Current user not authenticated in pbGlobal.authStore. Cannot determine referredByCode.`);
    return { referrerName: null, error: "User not authenticated to fetch referrer info." };
  }
  const currentAuthUserId = pbGlobal.authStore.model.id;
  const currentUserReferredByCode = pbGlobal.authStore.model.referredByCode as string | undefined;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing.`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using client's auth context.`);

  try {
    // User updates their own avatar. PocketBase rule @request.auth.id = id should allow this for the 'avatar' field.
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    let errorCode = "UAA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = "Permission Denied: You may not have permission to update this avatar. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id'.";
        errorCode = "UAA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update avatar.`;
        errorCode = "UAA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update avatar.";
        errorCode = "UAA_PB_0_NET_ERR";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Remove User Avatar Action";

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using client's auth context.`);

  try {
    // User removes their own avatar. PocketBase rule @request.auth.id = id should allow this for the 'avatar' field.
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    let errorCode = "RAA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `RAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = "Permission Denied: You may not have permission to remove this avatar. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id'.";
        errorCode = "RAA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not remove avatar.`;
        errorCode = "RAA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to remove avatar.";
        errorCode = "RAA_PB_0_NET_ERR";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}


export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question. FormData keys:`, Array.from(formData.keys()));
  
  // Relying on client-side guard in admin-panel/layout.tsx for UI access.
  // Relying on PocketBase 'question_bank' Create Rule: @request.auth.id != "" && @request.auth.role = "Admin"
  // pbGlobal, when action is called by an authenticated client, *should* carry client's auth token.

  console.log(`[${actionName}] Current pbGlobal.authStore.isValid: ${pbGlobal.authStore.isValid}`);
  console.log(`[${actionName}] Current pbGlobal.authStore.model?.role: ${pbGlobal.authStore.model?.role}`);


  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_E003_CREATE_FAIL";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));

      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) { 
        errorMessage = `Permission Denied (403): You do not have permission to add questions. Ensure you are logged in with an Admin account and PocketBase 'question_bank' collection Create Rule is correctly set (e.g., to allow Admin role: @request.auth.id != "" && @request.auth.role = "Admin"). Server saw auth status: ${pbGlobal.authStore.isValid}, role: ${pbGlobal.authStore.model?.role || 'unknown'}.`;
        errorCode = "AQA_E004_PB_403";
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required (401): You must be logged in to add questions. Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = "AQA_E004B_PB_401";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors}`;
        errorCode = "AQA_E005_PB_VALIDATION";
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status.";
        errorCode = "AQA_E006_PB_NET_ERR";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status})`;
        errorCode = `AQA_E007_PB_${error.status}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, detailedFieldErrors || errorMessage);
  }
}


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to fetch live referral stats.`);
  
  let adminPb;
  try {
    // This action needs admin privileges to list all users and count referrals.
    // adminPb = await requirePocketBaseAdmin(); // Removed as per user request to not depend on .env admin
    // Instead, this action will now likely fail if the calling user is not an admin themselves
    // AND the PB rules are restrictive.
    // For now, let's assume if this is called, the frontend has already gated it to an admin.
    // And the PB rules allow an admin to list all users.
    
    // The problem is this action is called by ANY user on their referrals page.
    // So, if it needs admin rights to list users, it will fail for normal users.
    // The previous logic for this required admin credentials from .env.
    // If we remove that, this action needs to be re-thought or its permissions changed in PB.

    // For now, let's proceed assuming the *CALLING USER* has "Admin" role *AND*
    // PB `users` collection `listRule` allows admins to list users.
    if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.role !== 'Admin') {
        const msg = "Permission Denied: Only admins can fetch live referral stats (this action requires listing all users).";
        console.warn(`[${actionName}] ${msg}. Current user role: ${pbGlobal.authStore.model?.role}`);
        return { success: false, message: msg, error: "GLRSA_E_NO_ADMIN_CALLER_CONTEXT" };
    }
    adminPb = pbGlobal; // Use the calling admin's context.
    console.log(`[${actionName}] Using calling admin's context (ID: ${adminPb.authStore.model?.id}) to fetch referral stats.`);

  } catch (initError) { // This catch is unlikely to be hit if getAdminPb isn't throwing from pocketbaseAdmin.ts
    const errMessage = initError instanceof Error ? initError.message : "Unknown error during PB client initialization.";
    console.error(`[${actionName}] PocketBase client initialization for stats failed: ${errMessage}`);
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: `PocketBase client initialization for stats failed: ${errMessage}. (GLRSA_E001A)`, error: `GLRSA_E001A_DETAIL: ${errMessage}` })}`);
    return { success: false, message: `PocketBase client initialization for stats failed: ${errMessage}. (GLRSA_E001A)`, error: `GLRSA_E001A_DETAIL: ${errMessage}` };
  }
  
  // This part will fail if adminPb is not an admin or cannot list users due to PB rules.
  try {
    let targetUserReferralCode: string | null = null;

    // This action should fetch stats FOR THE CURRENTLY LOGGED IN USER (who is assumed to be an admin here)
    // To see how many users THEY referred.
    if (adminPb.authStore.model?.referralCode) {
      targetUserReferralCode = adminPb.authStore.model.referralCode as string;
    } else {
      const msg = "Authenticated user (expected Admin) does not have a referral code to calculate stats for.";
      console.warn(`[${actionName}] ${msg}`);
      return createErrorResponse(msg, "GLRSA_E002B_ADMIN_NO_CODE", "Admin user lacks referral code.");
    }

    console.log(`[${actionName}] Calculating stats for users referred by current user (code: ${targetUserReferralCode}).`);
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${targetUserReferralCode}"`,
    });

    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
      referred_dpp: 0,
    };

    referredUsers.forEach(user => {
      switch (user.model as UserModel) {
        case 'Free': liveStats.referred_free = (liveStats.referred_free || 0) + 1; break;
        case 'Chapterwise': liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1; break;
        case 'Full_length': liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1; break;
        case 'Combo': liveStats.referred_combo = (liveStats.referred_combo || 0) + 1; break;
        case 'Dpp': liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1; break;
      }
    });
    console.log(`[${actionName}] Successfully calculated live stats:`, JSON.stringify(liveStats));
    return { success: true, stats: liveStats, message: "Stats fetched successfully." };

  } catch (error) {
    let clientErrorMessage = "Failed to calculate live referral stats.";
    let clientErrorCode = "GLRSA_E003_CALC_FAIL";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error calculating live referral stats:`, error);

    if (error instanceof ClientResponseError) {
      clientErrorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      clientErrorCode = `GLRSA_E004_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 403) {
        clientErrorMessage = "Permission Denied (403): You do not have permission to list all users for calculating live referral stats.";
        clientErrorCode = "GLRSA_E005_PB_403";
      } else if (error.status === 401) {
        clientErrorMessage = "Authentication Required (401) to list users for stats.";
        clientErrorCode = "GLRSA_E006_PB_401";
      } else if (error.status === 0) {
        clientErrorMessage = "Network Error: Could not connect to PocketBase for live stats.";
        clientErrorCode = "GLRSA_E007_PB_0";
      }
    }
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: clientErrorMessage, error: clientErrorCode, details: errorDetails })}`);
    return { success: false, message: clientErrorMessage, error: clientErrorCode, details: errorDetails };
  }
}


export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  if (!subject) {
    return createErrorResponse("Subject is required to fetch lessons.", "GLBSA_E002_NO_SUBJECT");
  }

  // Removed: if (!pbGlobal.authStore.isValid) { ... } 
  // Rely on PocketBase rules. Your 'question_bank' viewRule is "@request.auth.id != """,
  // so PocketBase will reject if the request is not authenticated.

  try {
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_FETCH_FAIL`;
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}': ${error.status}.`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL (eg. https://your-domain.com). Current URL used by SDK: ${pbGlobal.baseUrl}.`;
        errorCode = `GLBSA_E006_PB_404`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}): You may not have permission to view lessons. Please ensure you are logged in and your PocketBase 'question_bank' View Rule is correctly set (e.g., "@request.auth.id != """). Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = `GLBSA_E005_PB_AUTH`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'.`;
        errorCode = `GLBSA_E007_PB_0`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}


export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  if (!subject || !lessonName) {
    return createErrorResponse("Subject and Lesson Name are required.", "GQBLA_E001_MISSING_PARAMS");
  }

  // Removed: if (!pbGlobal.authStore.isValid) { ... }
  // Rely on PocketBase 'question_bank' View Rule: "@request.auth.id != """.
  // PocketBase will reject if the request is not authenticated.

  try {
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}" && lessonName = "${lessonName}"`,
    });

    const questions: QuestionDisplayInfo[] = records.map(record => {
      let pyqInfo: PYQInfo | undefined = undefined;
      if (record.isPYQ) {
        pyqInfo = {
          examName: record.pyqExamName || undefined,
          year: record.pyqYear?.toString() || undefined,
          date: record.pyqDate ? format(new Date(record.pyqDate), "dd MMM yyyy") : undefined,
          shift: record.pyqShift || undefined,
        };
      }

      return {
        id: record.id,
        collectionId: record.collectionId,
        subject: record.subject,
        lessonName: record.lessonName,
        lessonTopic: record.lessonTopic || undefined,
        difficulty: record.difficulty,
        tags: record.tags || undefined,
        isPYQ: record.isPYQ,
        pyqInfo,
        questionType: record.questionType,
        questionText: record.questionText || undefined,
        questionImage: record.questionImage ? pbGlobal.getFileUrl(record, record.questionImage) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pbGlobal.getFileUrl(record, record.optionAImage) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pbGlobal.getFileUrl(record, record.optionBImage) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pbGlobal.getFileUrl(record, record.optionCImage) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pbGlobal.getFileUrl(record, record.optionDImage) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pbGlobal.getFileUrl(record, record.explanationImage) : undefined,
      };
    });

    console.log(`[${actionName}] Successfully fetched ${questions.length} questions for ${subject} - ${lessonName}`);
    return { success: true, questions, message: "Questions fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch questions for ${subject} - ${lessonName}.`;
    let errorCode = "GQBLA_E002_FETCH_FAIL";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      errorCode = `GQBLA_E003_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used: ${pbGlobal.baseUrl}.`;
        errorCode = `GQBLA_E004_PB_404`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}): You may not have permission to view questions. Please ensure you are logged in and your PocketBase 'question_bank' View Rule is correctly set (e.g., "@request.auth.id != """). Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = `GQBLA_E005_PB_AUTH`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to fetch questions.";
        errorCode = `GQBLA_E005_PB_0`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
  const actionName = "Save DPP Attempt Action";
  console.log(`[${actionName}] Attempting to save DPP attempt for subject: ${payload.subject}, lesson: ${payload.lessonName}`);

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Cannot save DPP attempt.", "SDPPA_E001_NO_AUTH");
  }
  const userId = pbGlobal.authStore.model.id;

  const dataToSaveOrUpdate = {
    userId: userId, // Important: Set the userId to the currently authenticated user
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
    // timeTakenSeconds: payload.timeTakenSeconds, // Add if you implement time tracking
  };

  try {
    let existingAttempt = null;
    try {
      console.log(`[${actionName}] Checking for existing attempt for user: ${userId}, subject: ${payload.subject}, lesson: ${payload.lessonName}`);
      existingAttempt = await pbGlobal.collection('dpp_attempts').getFirstListItem(
        `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`
      );
    } catch (findError) {
      if (findError instanceof ClientResponseError && findError.status === 404) {
        console.log(`[${actionName}] No existing attempt found. Will create a new one.`);
        existingAttempt = null;
      } else {
        console.error(`[${actionName}] Error when checking for existing attempt:`, findError);
        throw findError; // Re-throw other errors
      }
    }

    if (existingAttempt) {
      console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Updating...`);
      // PocketBase Rule for Update: @request.auth.id == userId
      const updatedRecord = await pbGlobal.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      console.log(`[${actionName}] No existing attempt found. Creating new attempt...`);
      // PocketBase Rule for Create: @request.auth.id != ""
      const newRecord = await pbGlobal.collection('dpp_attempts').create(dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
      return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
    }

  } catch (error) {
    console.error(`[${actionName}] Error saving/updating DPP attempt:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection. (User: ${userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName})`;
      } else if (error.status === 401) {
        errorMessage = `Authentication Required (401) to save DPP attempt.`;
      } else if (error.status === 0) {
         errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? error.data : String(error)));
  }
}
// Ensure this is the last line of actual code.
