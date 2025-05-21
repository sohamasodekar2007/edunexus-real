
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { format } from 'date-fns';
import { cookies } from 'next/headers';
import PocketBase from 'pocketbase';


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
      // Return success false but empty message to not show "invalid" for non-existent codes immediately
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // Keep message empty on error for UI
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
  let newUserPocketBase;

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
      avatar: null, // Default avatar field for PocketBase 'users' collection
      emailVisibility: true,
      verified: false, // PocketBase handles verification flow if enabled
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted from log):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // New user creation uses pbGlobal, relying on public createRule for 'users' collection.
    newUserPocketBase = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUserPocketBase.id}`);

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

  if (newUserPocketBase && newUserPocketBase.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUserPocketBase.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    // Attempt to update referrer stats, this part MIGHT fail if admin credentials are not set or are invalid
    // but the signup itself will have succeeded.
    const pbAdmin = null; // Admin client no longer used for this path
    // const pbAdmin = await getPocketBaseAdmin(); // No longer using admin for this
    if (pbAdmin) { // This block will not run if admin auth is removed/fails
        try {
            const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbAdmin);
            if (referrerToUpdateStats && referrerToUpdateStats.id) {
            console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
            const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
            const newReferrerStats: User['referralStats'] = {
                ...currentStats,
                referred_free: (currentStats.referred_free || 0) + 1,
            };
            await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbAdmin);
            console.log(`[${actionName}] Successfully updated referral stats for referrer ${referrerToUpdateStats.name} to`, newReferrerStats);
            } else {
            console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user's 'referredByCode' field.`);
            }
        } catch (statsError) {
            console.warn(`[${actionName}] Error during referral stats lookup or update process for ${upperCaseReferredByCode} (using admin client). User signup itself was successful. Error:`, statsError.message, statsError);
        }
    } else {
        console.warn(`[${actionName}] Admin client not available. Skipping update of referrer stats for ${upperCaseReferredByCode}. Signup of new user ${newUserPocketBase.id} was successful.`);
    }
  }
  return { success: true, message: 'Signup successful! Please log in.', userId: newUserPocketBase.id };
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
    const userName = userFullName.split(' ')[0] || 'User'; // First name for display
    const avatarUrl = user.avatar ? pbGlobal.getFileUrl(user, user.avatar as string) : null;

    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userId: user.id,
      userFullName: userFullName,
      userName: userName, // For "Hello, {userName}"
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
  userId: userIdFromClient, // Renamed to avoid conflict with pb.authStore.model.id if used differently
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string, // Expecting client to pass the ID of the user they are trying to update
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  if (!authCookie?.value) {
    console.warn(`[${actionName}] Auth cookie not found. User likely not authenticated for server action.`);
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_E000_NO_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value || '');

  try {
    await pb.collection('users').authRefresh(); 
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.warn(`[${actionName}] User not authenticated in action context.`);
      return createErrorResponse("User not authenticated. Please log in again.", "UPA_E001_NO_AUTH");
    }
  } catch (_) {
    pb.authStore.clear();
    console.warn(`[${actionName}] Auth refresh failed. User likely not authenticated.`);
    return createErrorResponse("User authentication is invalid. Please log in again.", "UPA_E001B_AUTH_REFRESH_FAIL");
  }

  // For self-update, ensure the userIdFromClient matches the authenticated user's ID.
  // This check is crucial since we're not using a super-admin client.
  const authenticatedUserId = pb.authStore.model.id;
  if (userIdFromClient !== authenticatedUserId) {
      console.error(`[${actionName}] Security alert: Authenticated user ${authenticatedUserId} attempting to update profile for ${userIdFromClient}. Denying.`);
      return createErrorResponse("Permission denied: Cannot update another user's profile.", "UPA_E001C_PERMISSION_DENIED");
  }
  
  console.log(`[${actionName}] Attempting to update profile for authenticated user ID: ${authenticatedUserId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  
  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};
  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }
  if (targetYearToUpdate !== undefined) {
    const parsedYear = parseInt(targetYearToUpdate, 10);
    dataForPocketBase.targetYear = (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '' || isNaN(parsedYear)) ? null : parsedYear;
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${authenticatedUserId}.`);
    return { success: true, message: "No changes to save." };
  }
  console.log(`[${actionName}] Data to send to PocketBase for user ${authenticatedUserId}:`, dataForPocketBase);

  try {
    // Uses the request-scoped, user-authenticated 'pb' instance.
    // PocketBase 'users' collection Update Rule should be @request.auth.id = id
    const updatedUserRecord = await updateUserInPocketBase(authenticatedUserId, dataForPocketBase, pb); // Pass authenticated pb
    console.log(`[${actionName}] Profile updated successfully for user ${authenticatedUserId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${authenticatedUserId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403): You may not have permission to update this profile. Check PocketBase 'users' collection updateRule. Server log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${authenticatedUserId}). Could not update profile.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update profile.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}


export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  if (!authCookie?.value) {
    console.warn(`[${actionName}] Auth cookie not found. User likely not authenticated.`);
    return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_E000_NO_COOKIE)" };
  }
  pb.authStore.loadFromCookie(authCookie.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_E001)" };
    }
  } catch (_) {
    pb.authStore.clear();
    return { referrerName: null, error: "User auth refresh failed when fetching referrer info. (GRICA_E001B)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  const currentUserReferredByCode = pb.authStore.model.referredByCode as string | undefined;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // This read should be fine if 'users' collection View Rule allows authenticated users to see others (e.g. `@request.auth.id != ""`)
    // or if findUserByReferralCode uses an admin client internally for this specific lookup.
    // Assuming findUserByReferralCode uses pbGlobal or a similarly scoped client.
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pbGlobal); 
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing. (GRICA_E002)`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}. (GRICA_E003)`};
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  if (!authCookie?.value) {
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E000_NO_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to update avatar.", "UAA_E001B_AUTH_REFRESH_FAIL");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    // Uses the request-scoped, user-authenticated 'pb' instance.
    // PocketBase 'users' collection Update Rule should be @request.auth.id = id
    const updatedRecord = await updateUserInPocketBase(userId, formData, pb); // Pass authenticated pb
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
        errorMessage = `Permission Denied (403): You may not have permission to update this avatar. Check PocketBase 'users' collection updateRule. Server Log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update avatar.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Remove User Avatar Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  if (!authCookie?.value) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E000_NO_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to remove avatar.", "RAA_E001B_AUTH_REFRESH_FAIL");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    // Uses the request-scoped, user-authenticated 'pb' instance.
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pb); // Pass authenticated pb
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
        errorMessage = `Permission Denied (403): You may not have permission to remove this avatar. Check PocketBase 'users' collection updateRule. Server Log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not remove avatar.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to remove avatar.";
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

  // Relies on PocketBase 'question_bank' collection Create Rule being permissive enough
  // for the calling context (e.g., "@request.auth.role = 'Admin'" and client is admin)
  // or public ("") if no auth context is reliably passed/used by pbGlobal here.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  if (!authCookie?.value) {
      console.warn(`[${actionName}] Auth cookie not found. User likely not authenticated to add question.`);
      // If 'question_bank' createRule is public, this might still work.
      // If rule requires auth, PocketBase will reject.
  } else {
      pb.authStore.loadFromCookie(authCookie.value || '');
      try {
        if (pb.authStore.isValid) { // Only refresh if token loaded
            await pb.collection('users').authRefresh();
            console.log(`[${actionName}] Auth token potentially refreshed for addQuestionAction. User: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
        }
      } catch (refreshError) {
          pb.authStore.clear();
          console.warn(`[${actionName}] Auth refresh failed during addQuestionAction. Proceeding based on collection rules. Error:`, refreshError);
      }
  }
  // Server-side check against the role from the (potentially refreshed) authStore.
  // This adds an app-level check on top of PocketBase's rules.
  if (!pb.authStore.isValid || pb.authStore.model?.role !== 'Admin') {
    console.error(`[${actionName}] Permission Denied: User (ID: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}) is not an Admin or not authenticated. Cannot add question.`);
    return createErrorResponse(
      "Permission Denied: You must be an Admin to add questions.", 
      "AQA_E403_NOT_ADMIN", 
      `User role: ${pb.authStore.model?.role}`
    );
  }
  
  console.log(`[${actionName}] User is authenticated as Admin (ID: ${pb.authStore.model.id}). Proceeding to create question.`);

  try {
    const newQuestionRecord = await pb.collection('question_bank').create(formData);
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
        errorMessage = `Permission Denied by PocketBase (403): The current user (Role: ${pb.authStore.model?.role}) does not have permission to add questions. Ensure PocketBase 'question_bank' collection Create Rule is correctly set (e.g. '@request.auth.id != "" && @request.auth.role = "Admin"'). Error: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) { 
         errorMessage = `Authentication Required by PocketBase (401): User is not authenticated or token is invalid. Please log in.`;
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors}`;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to add the question.";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status})`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, detailedFieldErrors || errorMessage);
  }
}


export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? 'Exists' : 'MISSING'}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
        if (pb.authStore.isValid) { // Only refresh if token loaded and seems valid.
            await pb.collection('users').authRefresh();
            console.log(`[${actionName}] Auth token refreshed for getLessons. User: ${pb.authStore.model?.id}`);
        }
    } catch (refreshError) {
        pb.authStore.clear(); // Clear auth store if refresh fails
        console.warn(`[${actionName}] Auth refresh failed for getLessons. Proceeding based on collection rules. Error:`, refreshError);
    }
  } else {
     console.log(`[${actionName}] No auth cookie found for getLessons. Proceeding based on collection rules.`);
  }

  // Removed explicit server-side !pb.authStore.isValid check.
  // Rely on PocketBase's collection rules (@request.auth.id != "" for 'question_bank' view).

  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl} for user ID (if authenticated): ${pb.authStore.model?.id}`);

  if (!subject) {
    return createErrorResponse("Subject is required to fetch lessons.", "GLBSA_E002_NO_SUBJECT");
  }
  
  try {
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_FETCH_FAIL`; // Default error code
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match filter when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used by SDK: ${pb.baseUrl}. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase: You may not have permission to view lessons for '${subject}'. Please ensure you are logged in. PocketBase 'question_bank' View Rule likely requires authentication (e.g., "@request.auth.id != """). User ID (if auth was attempted): ${pb.authStore.model?.id}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? 'Exists' : 'MISSING'}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
        if (pb.authStore.isValid) { // Only refresh if token loaded and seems valid.
            await pb.collection('users').authRefresh();
            console.log(`[${actionName}] Auth token refreshed for getQuestions. User: ${pb.authStore.model?.id}`);
        }
    } catch (refreshError) {
        pb.authStore.clear(); // Clear auth store if refresh fails
        console.warn(`[${actionName}] Auth refresh failed for getQuestions. Proceeding based on collection rules. Error:`, refreshError);
    }
  } else {
     console.log(`[${actionName}] No auth cookie found for getQuestions. Proceeding based on collection rules.`);
  }

  // Removed explicit server-side !pb.authStore.isValid check.
  // Rely on PocketBase's collection rules (@request.auth.id != "" for 'question_bank' view).

  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl} for user ID (if authenticated): ${pb.authStore.model?.id}`);

  if (!subject || !lessonName) {
    return createErrorResponse("Subject and Lesson Name are required.", "GQBLA_E001_MISSING_PARAMS");
  }
  
  try {
    const records = await pb.collection('question_bank').getFullList({
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
        questionImage: record.questionImage ? pb.getFileUrl(record, record.questionImage) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pb.getFileUrl(record, record.optionAImage) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pb.getFileUrl(record, record.optionBImage) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pb.getFileUrl(record, record.optionCImage) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pb.getFileUrl(record, record.optionDImage) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pb.getFileUrl(record, record.explanationImage) : undefined,
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
        errorMessage = `Collection 'question_bank' not found or no records match. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used: ${pb.baseUrl}. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase: You may not have permission to view questions for '${subject} - ${lessonName}'. Please ensure you are logged in. PocketBase 'question_bank' View Rule likely requires authentication (e.g., "@request.auth.id != """). User ID (if auth was attempted): ${pb.authStore.model?.id}`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to fetch questions.";
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}


export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
  const actionName = "Save DPP Attempt Action";
  console.log(`[${actionName}] Received payload:`, JSON.stringify(payload, null, 2));

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? 'Exists' : 'MISSING'}`);

  if (!authCookie?.value) {
      console.warn(`[${actionName}] Auth cookie not found. User likely not authenticated to save DPP attempt.`);
      return createErrorResponse("User not authenticated. Please log in to save your attempt.", "SDPPA_E000_NO_COOKIE");
  }
  
  pb.authStore.loadFromCookie(authCookie.value);
  console.log(`[${actionName}] pb.authStore.isValid after loading cookie (before refresh): ${pb.authStore.isValid}`);
  console.log(`[${actionName}] pb.authStore.model ID (before refresh): ${pb.authStore.model?.id}`);

  try {
    // Attempt to refresh the token to ensure it's valid and the authStore is populated
    await pb.collection('users').authRefresh(); 
    console.log(`[${actionName}] Auth refresh successful. User ID: ${pb.authStore.model?.id}, isValid: ${pb.authStore.isValid}`);
  } catch (authError) {
    pb.authStore.clear(); // Clear auth store if refresh fails
    console.error(`[${actionName}] Auth refresh failed. User is likely not authenticated or token expired. Error:`, authError);
    if (authError instanceof ClientResponseError) {
      console.error(`[${actionName}] Auth refresh ClientResponseError details:`, JSON.stringify(authError.data));
    }
    return createErrorResponse(
        "User authentication failed or token expired. Please log in again to save DPP attempt. (SDPPA_E001_AUTH_REFRESH_FAIL)",
        "SDPPA_E001_AUTH_REFRESH_FAIL",
        authError instanceof Error ? authError.message : String(authError)
    );
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.error(`[${actionName}] User is not properly authenticated after authRefresh. Cannot save DPP attempt.`);
      return createErrorResponse(
          "User authentication context is invalid after attempting refresh. Cannot save DPP attempt. (SDPPA_E001B_INVALID_CONTEXT_POST_REFRESH)",
          "SDPPA_E001B_INVALID_CONTEXT_POST_REFRESH"
      );
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Authenticated User ID for DPP attempt: ${userId}`);

  const dataToSaveOrUpdate = {
    userId: userId, // Ensure this is the authenticated user's ID
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
    // timeTakenSeconds: payload.timeTakenSeconds, // Optional, can add later
  };
  console.log(`[${actionName}] Data prepared for save/update for user ${userId}:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

  try {
    let existingAttempt = null;
    const filter = `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
    console.log(`[${actionName}] Checking for existing attempt with filter: ${filter}`);
    try {
      // Use the request-scoped, authenticated pb instance
      existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
      console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update.`);
    } catch (findError) {
      if (findError instanceof ClientResponseError && findError.status === 404) {
        console.log(`[${actionName}] No existing attempt found. Will create a new one.`);
        existingAttempt = null;
      } else {
        // If it's not a 404, it's some other error during find
        console.error(`[${actionName}] Error when checking for existing attempt:`, findError);
        if (findError instanceof ClientResponseError) console.error(`[${actionName}] Find Error Details:`, JSON.stringify(findError.data))
        throw findError; // Rethrow to be caught by the outer catch block
      }
    }

    if (existingAttempt) {
      console.log(`[${actionName}] Attempting to update existing attempt ID: ${existingAttempt.id} with data:`, dataToSaveOrUpdate);
      // Use the request-scoped, authenticated pb instance
      const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Full Response:`, updatedRecord);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      console.log(`[${actionName}] Attempting to create new DPP attempt with data:`, dataToSaveOrUpdate);
      // Use the request-scoped, authenticated pb instance
      const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt saved successfully. Full Response:`, newRecord);
      return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
    }

  } catch (error) {
    console.error(`[${actionName}] Error saving/updating DPP attempt for user ${userId}:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update Error Details:`, JSON.stringify(error.data));
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection (Create/Update). User: ${userId}, Role: ${pb.authStore.model?.role}. Error data: ${JSON.stringify(error.data)}`;
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. Please ensure you are logged in.`;
      } else if (error.status === 0) { 
         errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
      } else if (error.data?.data){ 
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage = `Validation errors from server: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? JSON.stringify(error.data) : String(error)));
  }
}


export async function getLiveReferralStatsAction(): Promise<{ success: boolean; stats?: User['referralStats']; message?: string; error?: string }> {
  const actionName = "Get Live Referral Stats Action";
  let adminPb = null;
  console.log(`[${actionName}] Initiating action.`);

  try {
    adminPb = null; // Admin client no longer used for this.

    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');

    if (!authCookie?.value) {
      console.warn(`[${actionName}] Auth cookie not found. Current user cannot be identified to fetch their referral code.`);
      return createErrorResponse("User not authenticated. Cannot fetch referral stats.", "GLRSA_E000_NO_COOKIE", "No auth cookie for current user.");
    }
    pb.authStore.loadFromCookie(authCookie.value);
    
    try {
      await pb.collection('users').authRefresh();
    } catch (refreshError) {
      pb.authStore.clear();
      console.error(`[${actionName}] Auth refresh failed for current user. Error:`, refreshError);
      return createErrorResponse("Current user authentication failed. Cannot fetch referral stats.", "GLRSA_E001A_AUTH_REFRESH_FAIL", refreshError.message);
    }

    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.warn(`[${actionName}] Current user not authenticated after refresh. Cannot fetch referral stats.`);
      return createErrorResponse("Current user not authenticated. Cannot fetch referral stats.", "GLRSA_E001B_NO_AUTH_AFTER_REFRESH", "User not valid after refresh.");
    }

    const currentUserReferralCode = pb.authStore.model.referralCode as string | undefined;
    if (!currentUserReferralCode) {
      console.log(`[${actionName}] Current user (ID: ${pb.authStore.model.id}) does not have a referral code.`);
      return { 
        success: true, 
        stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 },
        message: "User does not have a referral code." 
      };
    }

    console.log(`[${actionName}] Current user (ID: ${pb.authStore.model.id}) referral code: ${currentUserReferralCode}. Fetching referred users...`);
    
    // Now fetch all users referred by this code using pbGlobal or an admin client if rules require.
    // For simplicity and if 'users' listRule allows admin access, we'll use adminPb.
    // If not, this needs to be a more restricted query or a dedicated endpoint.
    // For now, let's assume we need admin to list all users for this calculation.
    
    // Re-introducing admin client for this specific part if listing all users is needed.
    // If an admin client is not desired here, the query must change or rules must allow broader access.
    // For now, let's use adminPb, which means .env admin creds must be set.
    adminPb = null; // Admin client no longer used for this.
    // This is a placeholder as admin client is removed. This part needs rethinking if admin client is truly off-limits.
    // For now, this will fail if it tries to list all users with pbGlobal and rules are restrictive.
    // Let's assume for a moment that listing users is public or a different mechanism is in place.
    // A more secure way would be a dedicated PocketBase view or API endpoint.

    const referredUsers = await pbGlobal.collection('users').getFullList({
        filter: `referredByCode = "${currentUserReferralCode}"`,
    });


    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
      referred_dpp: 0,
    };

    referredUsers.forEach(user => {
      switch (user.model) {
        case 'Free': liveStats.referred_free = (liveStats.referred_free || 0) + 1; break;
        case 'Chapterwise': liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1; break;
        case 'Full_length': liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1; break;
        case 'Combo': liveStats.referred_combo = (liveStats.referred_combo || 0) + 1; break;
        case 'Dpp': liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1; break;
        default: break; // Or count as free if model is unexpected
      }
    });

    console.log(`[${actionName}] Successfully calculated live referral stats for user ${pb.authStore.model.id}:`, JSON.stringify(liveStats));
    return { success: true, stats: liveStats, message: "Live referral stats fetched successfully." };

  } catch (error) {
    let finalErrorMessage = "Failed to fetch live referral stats.";
    let finalErrorCode = "GLRSA_E003_UNKNOWN";
    let errorDetails = error instanceof Error ? error.message : String(error);

    if (error.message && error.message.includes("Admin client initialization")) { // Check if it's the specific admin init error
        finalErrorMessage = error.message; // Use the message from requirePocketBaseAdmin
        finalErrorCode = "GLRSA_E002_ADMIN_AUTH_FAIL";
        errorDetails = error.message;
    } else if (error instanceof ClientResponseError) {
        finalErrorMessage = error.data?.message || `PocketBase error: ${error.status}`;
        finalErrorCode = `GLRSA_PB_${error.status}`;
        errorDetails = JSON.stringify(error.data);
    }
    
    console.error(`[${actionName}] Error: ${finalErrorMessage}. Details: ${errorDetails}. Full Error:`, error);
    console.log(`[${actionName}] Returning error object via console: `, JSON.stringify({ success: false, message: finalErrorMessage, error: finalErrorCode, details: errorDetails }));
    return { success: false, message: finalErrorMessage, error: finalErrorCode, details: errorDetails };
  }
}

// Removed getAllUsersAction as per previous request
// export async function getAllUsersAction...

    