
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload } from '@/types';
import { format } from 'date-fns';
// import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin'; // Admin client not used for these actions

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
    return { success: false, message: "" }; // No error message, just no success for short/empty codes
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      // Do not return an error message like "invalid code" here
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // Generic failure, no specific error message to user
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
      referredByCode: upperCaseReferredByCode, // Save the code user entered
      referralStats: { // Initialize stats
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
        referred_dpp: 0,
      },
      targetYear: null,
      avatar: null,
      emailVisibility: true,
      verified: false, // PocketBase usually handles verification flow
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted from log):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Use global pb instance. Relies on PocketBase users collection 'createRule' being public.
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
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
      // This part attempts to use admin creds. If not available, it will fail gracefully for this sub-operation.
      const adminPb = null; // await getPocketBaseAdmin(); // Removed admin dependency for now
      const pbInstanceForReferrerLookup = adminPb || pbGlobal; // Prefer admin if available for broader search, else global

      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbInstanceForReferrerLookup);
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };

        if (adminPb) { // Only attempt update if admin client was successfully obtained
            await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
            console.log(`[${actionName}] Successfully updated referral stats for referrer ${referrerToUpdateStats.name} to`, newReferrerStats, "using admin client.");
        } else {
            console.warn(`[${actionName}] Admin client not available (POCKETBASE_ADMIN_EMAIL/PASSWORD likely not set or invalid in .env). Skipping update of referral stats for referrer ${referrerToUpdateStats.name}. The referredByCode '${upperCaseReferredByCode}' was still saved on the new user.`);
        }
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message, statsError);
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
    if (user.avatar) { // PocketBase default avatar field
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
      if (error.status === 400) { // PocketBase returns 400 for failed auth
        errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        errorCode = "LOGIN_PB_400_AUTH";
      } else if (error.status === 0) { // Network error
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
    return createErrorResponse("User ID is required for profile update.", "UPA_E001_NO_USERID");
  }

  // Server-side validation of auth context for the specific user can be tricky without passing client token.
  // PocketBase rules (@request.auth.id = id) will handle the actual permission check.
  // We rely on the client being authenticated and pbGlobal using that context if available,
  // or this action needing admin rights if PB rules are stricter / not self-update.

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
    // This will use pbGlobal. If an admin-authenticated instance is needed due to stricter rules,
    // this would need to attempt admin auth first. For user self-update, pbGlobal acting on behalf
    // of the authenticated user (if auth token is propagated) is ideal.
    console.warn(`[${actionName}] Attempting update with pbGlobal. Ensure PocketBase 'users' collection updateRule allows this (e.g., @request.auth.id = id).`);
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

  // This action implies the current user (caller of the action) is authenticated.
  // We rely on pbGlobal having the client's auth token when the action is invoked.
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
    // Use global pb instance, assumes users view rule allows this lookup
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing.`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  // Relies on pbGlobal having the client's auth token
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using pbGlobal (client's auth context).`);

  try {
    // Uses pbGlobal. PocketBase rule @request.auth.id = id should allow this.
    console.warn(`[${actionName}] Attempting avatar update with pbGlobal. Ensure PocketBase 'users' collection updateRule allows this (e.g., @request.auth.id = id for the 'avatar' field).`);
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
  // Relies on pbGlobal having the client's auth token
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using pbGlobal (client's auth context).`);

  try {
    // Uses pbGlobal. PocketBase rule @request.auth.id = id should allow this.
    console.warn(`[${actionName}] Attempting avatar removal with pbGlobal. Ensure PocketBase 'users' collection updateRule allows this (e.g., @request.auth.id = id for the 'avatar' field).`);
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
  
  // This action relies on client-side access control to the page (userRole 'Admin' in localStorage)
  // AND PocketBase question_bank collection Create Rule being set to: @request.auth.id != "" && @request.auth.role = "Admin"
  // The pbGlobal instance, when used in a server action invoked by an authenticated client,
  // *should* carry the client's auth token.

  // Server-side double check for safety, though PB rules are the ultimate enforcer.
  // This check assumes that pbGlobal.authStore is populated correctly in the server action context.
  // If Next.js server actions don't automatically populate pbGlobal.authStore with client's auth, this check will fail.
  // And the PB call might fail with 401/403 if its rules aren't met or if pbGlobal is unauth'd.
  if (!pbGlobal.authStore.isValid) {
    console.warn(`[${actionName}] Denied: pbGlobal.authStore is not valid in server action. User likely not authenticated when action was called.`);
    return createErrorResponse("User is not authenticated. Cannot add question.", "AQA_E001_NO_AUTH_SERVER");
  }
  if (pbGlobal.authStore.model?.role !== 'Admin') {
     console.warn(`[${actionName}] Denied: User role is '${pbGlobal.authStore.model?.role}', not 'Admin'.`);
     return createErrorResponse("User does not have Admin privileges. Cannot add question.", "AQA_E002_NOT_ADMIN_SERVER");
  }
  console.log(`[${actionName}] User validated: ID ${pbGlobal.authStore.model?.id}, Role ${pbGlobal.authStore.model?.role}. Proceeding to add question.`);


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

      if (error.status === 403) { // Forbidden
        errorMessage = `Permission Denied: You do not have permission to add questions. Ensure you are logged in with an Admin account and PocketBase 'question_bank' collection Create Rule is correctly set (e.g., to allow Admin role: @request.auth.id != "" && @request.auth.role = "Admin"). Server saw role: ${pbGlobal.authStore.model?.role || 'unknown'}.`;
        errorCode = "AQA_E004_PB_403";
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
    // adminPb = await requirePocketBaseAdmin(); // This would throw if admin auth fails.
    // For now, let's assume this action should use the *calling user's* context if they are an admin,
    // or we need to rethink if this requires super-admin access.
    // If it *must* use super-admin, then requirePocketBaseAdmin() is correct.
    // If it can use a normal 'Admin' role user's context, then:
    if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.role !== 'Admin') {
        console.warn(`[${actionName}] Calling user is not an Admin or not authenticated. pbGlobal.authStore.model?.role: ${pbGlobal.authStore.model?.role}`);
        return createErrorResponse("Permission Denied: Only admins can fetch live referral stats.", "GLRSA_E_NO_ADMIN_CALLER");
    }
    adminPb = pbGlobal; // Use the calling admin's context.
    console.log(`[${actionName}] Using calling admin's context (ID: ${adminPb.authStore.model?.id}) to fetch referral stats.`);

  } catch (adminAuthError) {
    const errMessage = adminAuthError instanceof Error ? adminAuthError.message : "Unknown error during admin authentication.";
    console.error(`[${actionName}] Admin client initialization failed: ${errMessage}`);
    return createErrorResponse(
        `Admin client initialization failed: ${errMessage}. (GLRSA_E001)`,
        `GLRSA_E001_DETAIL: ${errMessage}`
    );
  }

  // If adminPb is null after the above (should not happen if logic is correct)
  if (!adminPb || !adminPb.authStore.isValid) {
    console.error(`[${actionName}] Admin PB instance is null or invalid. This should not happen.`);
    return createErrorResponse(
      "Critical error: Admin client not available. (GLRSA_E002)",
      "GLRSA_E002_DETAIL"
    );
  }

  try {
    let targetUserReferralCode: string | null = null;

    // This action should fetch stats FOR THE CURRENTLY LOGGED IN ADMIN
    // To see how many users THEY referred.
    if (adminPb.authStore.model?.referralCode) {
      targetUserReferralCode = adminPb.authStore.model.referralCode as string;
    } else {
      return createErrorResponse("Authenticated admin user does not have a referral code to calculate stats for.", "GLRSA_E002B_ADMIN_NO_CODE", "Admin user lacks referral code.");
    }

    console.log(`[${actionName}] Calculating stats for users referred by admin (code: ${targetUserReferralCode}) using admin client.`);
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
        clientErrorMessage = "Permission Denied: Admin client does not have permission to list all users for calculating live referral stats.";
        clientErrorCode = "GLRSA_E005_PB_403";
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

  try {
    // Uses global pb instance. Relies on PocketBase question_bank collection rules.
    // If rule is "@request.auth.id != """, pbGlobal must carry client's auth token.
    // If rule is public "", no auth needed by PB.
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', // Only fetch lessonName to be efficient
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

  try {
    // Relies on PocketBase 'question_bank' collection view rule being @request.auth.id != ""
    if (!pbGlobal.authStore.isValid) {
        console.warn(`[${actionName}] User not authenticated. Cannot fetch questions.`);
        return createErrorResponse("User not authenticated. Please log in to view questions.", "GQBLA_E001B_NO_AUTH");
    }
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}" && lessonName = "${lessonName}"`,
      // sort: '-created', // Add sorting if needed
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
    userId: userId,
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
    // timeTakenSeconds: payload.timeTakenSeconds, // Add if you implement time tracking
  };

  try {
    // Check if an attempt for this user, subject, and lesson already exists
    let existingAttempt;
    try {
      existingAttempt = await pbGlobal.collection('dpp_attempts').getFirstListItem(
        `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`
      );
    } catch (findError) {
      if (findError instanceof ClientResponseError && findError.status === 404) {
        // No existing attempt found, this is fine, we'll create one.
        existingAttempt = null;
      } else {
        // Different error occurred during find, re-throw it or handle specifically
        throw findError;
      }
    }

    if (existingAttempt) {
      // Update existing attempt
      console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Updating...`);
      // Ensure your PocketBase 'dpp_attempts' collection Update Rule is `@request.auth.id == userId`
      const updatedRecord = await pbGlobal.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      // Create new attempt
      // Ensure your PocketBase 'dpp_attempts' collection Create Rule is `@request.auth.id != ""`
      console.log(`[${actionName}] No existing attempt found. Creating new attempt...`);
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
        errorMessage = `Permission Denied: You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection. (User: ${userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName})`;
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

// Extra comment here for testing, will be removed
// Test 123
