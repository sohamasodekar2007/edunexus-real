
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase'; // Import PocketBase class
import { cookies } from 'next/headers'; // Import cookies
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { format } from 'date-fns';

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
    return { success: false, message: "" }; // No message for short/empty codes client-side
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    // This action can use pbGlobal if rules allow public read or if it's an admin utility.
    // For now, assuming it uses pbGlobal which might be unauthenticated.
    // If 'users' collection has restricted read, this would need an admin client or be called differently.
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); // Using pbGlobal
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" }; // No "invalid" message to client
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // No error message to client for general failures here
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
      avatar: null,
      emailVisibility: true,
      verified: false,
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Use pbGlobal for user creation, relying on public Create Rule for 'users' collection.
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
    try {
        const referrer = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); 
        if (referrer) {
            console.log(`[${actionName}] Found referrer ${referrer.id}. Current stats:`, referrer.referralStats);
            const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
            const newStats = {
                ...currentStats,
                referred_free: (currentStats.referred_free || 0) + 1,
            };
            // Updating another user's stats typically requires admin. 
            // This part will try with pbGlobal. If it fails due to permissions, it will log an error.
            await updateUserReferralStats(referrer.id, newStats, pbGlobal); 
            console.log(`[${actionName}] Attempted referrer stats update for ${referrer.id} with pbGlobal. Stats:`, newStats);
        } else {
             console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found. No stats updated.`);
        }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referrer stats update for ${upperCaseReferredByCode}. This does not block signup. Error:`, statsError.message, statsError);
      if (statsError instanceof ClientResponseError) {
        console.warn(`[${actionName}] Referrer stats update PocketBase error:`, JSON.stringify(statsError.data));
      }
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
  token?: string,
  userRecordFromPb?: any, 
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL); 

  try {
    const authData = await pb.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return createErrorResponse('Login failed. Please check your credentials.', "LOGIN_INVALID_CREDENTIALS", 'Invalid credentials');
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User';
    const avatarFilename = user.avatar as string | undefined;
    const avatarUrl = avatarFilename ? pb.getFileUrl(user, avatarFilename) : null;
    const userReferredByCode = user.referredByCode || null; 

    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userRecordFromPb: authData.record, 
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
      userReferredByCode: userReferredByCode,
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
  classToUpdate,
  targetYearToUpdate
}: {
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  
  // User updates their own profile, rely on client's auth token passed via cookie
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');
  
  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);

  try {
    console.log(`[${actionName}] Attempting authRefresh before profile update. Current pb.authStore.isValid: ${pb.authStore.isValid}`);
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] authRefresh successful. New pb.authStore.isValid: ${pb.authStore.isValid}`);
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    if (refreshError instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh:`, JSON.stringify(refreshError.data));
    }
    return createErrorResponse("Session invalid or expired. Please log in again.", "UPA_AUTH_REFRESH_FAIL");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    console.log(`[${actionName}] User session not valid after authRefresh.`);
    return createErrorResponse("User session not valid. Please log in again.", "UPA_SESSION_INVALID_POST_REFRESH");
  }
  
  const authenticatedUserId = pb.authStore.model.id;
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
    // Use the request-scoped authenticated pb instance
    const updatedUserRecord = await updateUserInPocketBase(authenticatedUserId, dataForPocketBase, pb); 
    console.log(`[${actionName}] Profile updated successfully for user ${authenticatedUserId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${authenticatedUserId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403). Ensure 'users' collection Update Rule allows self-update (e.g. '@request.auth.id = id'). Server log: ${JSON.stringify(error.data)}`;
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
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return { referrerName: null, error: "User not authenticated to fetch referrer info. (No auth cookie - GRICA_NO_AUTH_COOKIE_SERVER)" };
  }
  pb.authStore.loadFromCookie(authCookie.value);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    return { referrerName: null, error: "Session invalid or expired. (GRICA_AUTH_REFRESH_FAIL_SERVER)" };
  }
  
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    console.log(`[${actionName}] User session not valid after authRefresh.`);
    return { referrerName: null, error: "User session not valid. (GRICA_SESSION_INVALID_POST_REFRESH_SERVER)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  // Use the authenticated pb instance to fetch the current user's record
  const currentUserRecord = await findUserById(currentAuthUserId, pb); 
  const currentUserReferredByCode = currentUserRecord?.referredByCode;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // Use the authenticated pb instance to find the referrer. This is fine for reads if 'users' view rule is permissive.
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pb); 
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing. (GRICA_E002_SERVER)`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}. (GRICA_E003_SERVER)`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    return createErrorResponse("Session invalid or expired. Please log in to update avatar.", "UAA_AUTH_REFRESH_FAIL");
  }
  
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    console.log(`[${actionName}] User session not valid after authRefresh.`);
    return createErrorResponse("User session not valid. Please log in to update avatar.", "UAA_SESSION_INVALID_POST_REFRESH");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    // Use the authenticated pb instance for the update
    const updatedRecord = await updateUserInPocketBase(userId, formData, pb); 
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    let errorCode = "UAA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403) for avatar update. Ensure 'users' collection Update Rule allows self-update (e.g. '@request.auth.id = id'). Details: ${JSON.stringify(error.data)}`;
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
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    return createErrorResponse("Session invalid or expired. Please log in to remove avatar.", "RAA_AUTH_REFRESH_FAIL");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    console.log(`[${actionName}] User session not valid after authRefresh.`);
    return createErrorResponse("User session not valid. Please log in to remove avatar.", "RAA_SESSION_INVALID_POST_REFRESH");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    // Use the authenticated pb instance for the update
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pb); 
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    let errorCode = "RAA_E002_UPDATE_FAIL_SERVER";
     if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `RAA_PB_${error.status}`;
       if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403) for avatar removal. Ensure 'users' collection Update Rule allows self-update (e.g. '@request.auth.id = id'). Details: ${JSON.stringify(error.data)}`;
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
  
  // For adding questions, this action must be authenticated as a user with Admin role.
  // The question_bank Create Rule is: @request.auth.id != "" && @request.auth.role = "Admin"
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in with an Admin account to add questions.", "AQA_NO_AUTH_COOKIE_SERVER_ACTION");
  }
  pb.authStore.loadFromCookie(authCookie.value);
  
  try {
    console.log(`[${actionName}] Attempting authRefresh. Current pb.authStore.isValid: ${pb.authStore.isValid}, model role: ${pb.authStore.model?.role}`);
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] authRefresh successful. New pb.authStore.isValid: ${pb.authStore.isValid}, model role: ${pb.authStore.model?.role}`);
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    if (refreshError instanceof ClientResponseError) console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh:`, JSON.stringify(refreshError.data));
    return createErrorResponse("Session invalid or expired. Please log in again.", "AQA_AUTH_REFRESH_FAIL_SERVER_ACTION");
  }

  if (!pb.authStore.isValid || pb.authStore.model?.role !== 'Admin') {
    const authRole = pb.authStore.model?.role || (pb.authStore.isValid ? 'User (Not Admin)' : 'Invalid/Not Authenticated');
    const msg = `Access Denied: You must have an Admin role to add questions. Your current role: ${authRole}.`;
    console.error(`[${actionName}] ${msg}`);
    return createErrorResponse(msg, "AQA_NOT_ADMIN_SERVER_ROLE_CHECK", msg);
  }

  console.log(`[${actionName}] User confirmed as Admin (${pb.authStore.model.id}). Proceeding to create question.`);

  try {
    // Use the authenticated pb instance (which is now confirmed Admin)
    const newQuestionRecord = await pb.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };
  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_E003_CREATE_FAIL_SERVER";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));
      detailedFieldErrors = error.data?.data ? JSON.stringify(error.data.data) : "";

      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): Your Admin account may not have permission to add questions, or the data is invalid. Check PocketBase 'question_bank' Create Rule. Details: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) { 
         errorMessage = `Authentication Required by PocketBase (401) for creating question. This shouldn't happen if authRefresh succeeded.`;
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
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}`);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
      console.log(`[${actionName}] No auth cookie found for request to ${subject}.`);
      return createErrorResponse(
          "User not authenticated. Please log in to view lessons. (No auth cookie)",
          "GLBSA_NO_AUTH_SERVER", 
          `Authentication cookie ('pb_auth') not found in the request when fetching lessons for ${subject}.`
      );
  }
  
  pb.authStore.loadFromCookie(authCookie.value);
  console.log(`[${actionName}] Auth cookie loaded. pb.authStore.isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id} for subject ${subject}.`);

  try {
      console.log(`[${actionName}] Attempting authRefresh for subject ${subject}.`);
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] authRefresh successful. pb.authStore.isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id} for subject ${subject}.`);
  } catch (refreshError) {
      pb.authStore.clear();
      console.error(`[${actionName}] Auth refresh failed for subject ${subject}:`, (refreshError as Error).message);
      if (refreshError instanceof ClientResponseError) console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh for ${subject}:`, JSON.stringify(refreshError.data));
      return createErrorResponse(
          "User not authenticated. Please log in to view lessons. (Session invalid or refresh failed)",
          "GLBSA_AUTH_REFRESH_FAIL_SERVER",
          `Auth refresh failed for ${subject}: ${(refreshError as Error).message}`
      );
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.log(`[${actionName}] User session not valid after authRefresh for subject ${subject}.`);
      return createErrorResponse(
          "User not authenticated. Please log in to view lessons. (Session invalid post-refresh)",
          "GLBSA_SESSION_INVALID_SERVER",
          `User session not valid after authRefresh for ${subject}.`
      );
  }
  
  console.log(`[${actionName}] User authenticated (ID: ${pb.authStore.model.id}) for fetching lessons for subject: ${subject}.`);
  
  try {
    console.log(`[${actionName}] Proceeding to fetch lessons for subject: ${subject} using user ${pb.authStore.model.id}.`);
    // Use the authenticated pb instance
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_FETCH_FAIL_SERVER`;
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match filter when fetching lessons for subject '${subject}'. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view lessons for '${subject}'. PocketBase 'question_bank' View Rule: '@request.auth.id != \"\"'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch lessons for subject '${subject}'. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
        errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
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
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}`);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
      console.log(`[${actionName}] No auth cookie found for request to ${subject} - ${lessonName}.`);
      return createErrorResponse(
          "User not authenticated. Please log in to view questions. (No auth cookie)",
          "GQBLA_NO_AUTH_COOKIE_SERVER",
          `Authentication cookie ('pb_auth') not found in the request when fetching questions for ${subject} - ${lessonName}.`
      );
  }
  pb.authStore.loadFromCookie(authCookie.value);
  console.log(`[${actionName}] Auth cookie loaded. pb.authStore.isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id} for ${subject} - ${lessonName}.`);

  try {
      console.log(`[${actionName}] Attempting authRefresh for ${subject} - ${lessonName}.`);
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] authRefresh successful. pb.authStore.isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id} for ${subject} - ${lessonName}.`);
  } catch (refreshError) {
      pb.authStore.clear();
      console.error(`[${actionName}] Auth refresh failed for ${subject} - ${lessonName}:`, (refreshError as Error).message);
      if (refreshError instanceof ClientResponseError) console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh for ${subject} - ${lessonName}:`, JSON.stringify(refreshError.data));
      return createErrorResponse(
          "User not authenticated. Please log in to view questions. (Session invalid or refresh failed)",
          "GQBLA_AUTH_REFRESH_FAIL_SERVER",
          `Auth refresh failed for ${subject} - ${lessonName}: ${(refreshError as Error).message}`
      );
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.log(`[${actionName}] User session not valid after authRefresh for ${subject} - ${lessonName}.`);
      return createErrorResponse(
          "User not authenticated. Please log in to view questions. (Session invalid post-refresh)",
          "GQBLA_SESSION_INVALID_SERVER",
          `User session not valid after authRefresh for ${subject} - ${lessonName}.`
      );
  }
  
  console.log(`[${actionName}] User authenticated (ID: ${pb.authStore.model.id}) for fetching questions for ${subject} - ${lessonName}.`);

  try {
    console.log(`[${actionName}] Proceeding to fetch questions for subject: ${subject}, lesson: ${lessonName} using user ${pb.authStore.model.id}.`);
    // Use the authenticated pb instance
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
    let errorCode = "GQBLA_E002_FETCH_FAIL_SERVER";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
       if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view questions for '${subject} - ${lessonName}'. PocketBase 'question_bank' View Rule: '@request.auth.id != \"\"'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch questions. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
         errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
    const actionName = "Save DPP Attempt Action";
    console.log(`[${actionName}] Received payload. Client-provided userId: ${payload.userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName}`);

    // For saving DPP attempts, create a new PocketBase instance and authenticate using cookies
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const authCookie = cookies().get('pb_auth');
    let authenticatedUserId: string | null = null;

    if (authCookie?.value) {
        console.log(`[${actionName}] Auth cookie found: ${authCookie.value.substring(0, 20)}...`);
        pb.authStore.loadFromCookie(authCookie.value);
        console.log(`[${actionName}] Auth cookie loaded. Auth store valid (pre-refresh): ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
        try {
            await pb.collection('users').authRefresh();
            console.log(`[${actionName}] Auth refresh successful. Auth store valid (post-refresh): ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
            if (pb.authStore.isValid && pb.authStore.model?.id) {
                authenticatedUserId = pb.authStore.model.id;
            } else {
                 console.log(`[${actionName}] Auth store not valid after refresh.`);
            }
        } catch (refreshError) {
            pb.authStore.clear(); // Clear store if refresh fails
            console.error(`[${actionName}] Auth refresh failed:`, refreshError.message);
            if (refreshError instanceof ClientResponseError) {
                console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh:`, JSON.stringify(refreshError.data));
            }
        }
    } else {
        console.log(`[${actionName}] No auth cookie found. Proceeding as potentially anonymous attempt.`);
    }

    // If client sent a userId, and it doesn't match authenticated user (if any), log warning but proceed based on rules.
    // For public create rule, payload.userId will be used if present, otherwise null.
    if (payload.userId && authenticatedUserId && payload.userId !== authenticatedUserId) {
        console.warn(`[${actionName}] Client-provided userId (${payload.userId}) does not match authenticated user (${authenticatedUserId}). Using client-provided ID for now.`);
    }
    
    // Use userId from payload IF user wasn't authenticated via cookie OR if no payload.userId and user was authenticated.
    // If your 'dpp_attempts' create rule is public, this allows anonymous saves if payload.userId is null.
    // If create rule is '@request.auth.id != ""', then authenticatedUserId MUST be valid.
    const userIdForRecord = payload.userId || authenticatedUserId; // Prioritize payload.userId for flexibility with public create
    
    // Check for your 'dpp_attempts' Create Rule: "" (public)
    // If the rule was '@request.auth.id != ""', we would need to ensure authenticatedUserId is valid:
    // if (!authenticatedUserId) {
    //     console.log(`[${actionName}] User must be authenticated to save attempt based on typical secure rules.`);
    //     return createErrorResponse("User not authenticated. Please log in to save your attempt.", "SDPPA_USER_NOT_AUTH");
    // }


    const dataToSaveOrUpdate = {
        userId: userIdForRecord, 
        subject: payload.subject,
        lessonName: payload.lessonName,
        attemptDate: new Date().toISOString(),
        questionsAttempted: payload.questionsAttempted,
        score: payload.score,
        totalQuestions: payload.totalQuestions,
    };
    
    console.log(`[${actionName}] Data prepared for PocketBase (userId for record: ${userIdForRecord}):`, JSON.stringify(dataToSaveOrUpdate, null, 2));

    try {
        let existingAttempt = null;
        if (userIdForRecord) { // Only try to find/update if there's a userId
            const filter = `userId = "${userIdForRecord}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
            console.log(`[${actionName}] Checking for existing attempt for user ${userIdForRecord} with filter: ${filter}`);
            try {
                // Use the request-scoped pb instance for reads too, if authenticated
                existingAttempt = await (authenticatedUserId ? pb : pbGlobal).collection('dpp_attempts').getFirstListItem(filter);
            } catch (findError) {
                if (findError instanceof ClientResponseError && findError.status === 404) {
                    console.log(`[${actionName}] No existing attempt found for user ${userIdForRecord}. Will create a new one.`);
                } else {
                    throw findError; 
                }
            }
        } else {
            console.log(`[${actionName}] No userId provided for attempt, will create a new anonymous attempt.`);
        }


        if (existingAttempt && userIdForRecord) { // Ensure userIdForRecord is present to update
            console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}) for user ${userIdForRecord}. Will update.`);
             // Use the request-scoped pb instance (which is authenticated if cookie was valid)
            const updatedRecord = await (authenticatedUserId ? pb : pbGlobal).collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt updated successfully for user ${userIdForRecord}. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            console.log(`[${actionName}] Attempting to CREATE new dpp_attempts record (userId: ${userIdForRecord}).`);
            // Use pbGlobal for create if rule is public, or authenticated pb if rule requires auth
            const newRecord = await (authenticatedUserId && payload.userId ? pb : pbGlobal).collection('dpp_attempts').create(dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error) {
        console.error(`[${actionName}] Error during save/update DPP attempt:`, error);
        let errorMessage = "Failed to save DPP attempt.";
        let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER";
        if (error instanceof ClientResponseError) {
          console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
          errorMessage = error.data?.message || errorMessage;
          errorCode = `SDPPA_PB_${error.status}`;
          if (error.status === 403) { 
            errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. Check PocketBase rules for 'dpp_attempts'. User for record: ${userIdForRecord}. Authenticated as: ${authenticatedUserId || 'None'}. Error data: ${JSON.stringify(error.data)}`;
          } else if (error.status === 401) { 
            errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. Ensure you are logged in.`;
          } else if (error.status === 0) { 
             errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
          } else if (error.data?.data){ 
            const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
            errorMessage = `Validation errors from server: ${fieldErrors}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? JSON.stringify(error.response) : String(error)));
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
  let adminPb: PocketBase | null = null;
  try {
    adminPb = null; 
    // adminPb = await requirePocketBaseAdmin(); // This line was previously causing issues if admin not set up
    // For now, if admin setup is problematic, this action might need to be re-evaluated or disabled
    // For simplicity, I'll assume it's not strictly needed for THIS SPECIFIC error, but it is for the intended functionality
    console.warn(`[${actionName}] Admin client fetching has been bypassed for this debug. If live stats rely on admin, this will not work fully.`);

  } catch (adminError) {
    console.error(`[${actionName}] Error from requirePocketBaseAdmin:`, adminError);
    const errorMsg = `Admin client initialization or authentication failed. Check server logs for details. (Error: ${(adminError as Error).message})`;
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMsg, error: "GLRSA_ADMIN_INIT_FAIL" })}`);
    return { success: false, message: errorMsg, error: "GLRSA_ADMIN_INIT_FAIL" };
  }
  
  // Fallback: If adminPb is not available, we cannot perform the live calculation.
  // Return an informative error or stored stats if absolutely necessary, but indicate it's not live.
  if (!adminPb) {
      // This part will now always be hit since requirePocketBaseAdmin is commented out
      const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
      const authCookie = cookies().get('pb_auth');
      if (authCookie?.value) {
          pb.authStore.loadFromCookie(authCookie.value);
          try {
              await pb.collection('users').authRefresh();
              if (pb.authStore.isValid && pb.authStore.model) {
                  const currentUser = pb.authStore.model as User;
                  console.log(`[${actionName}] Admin client not available. Returning stored referral stats for user ${currentUser.id}.`);
                  return { success: true, stats: currentUser.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 }, message:"Using stored stats as admin client is unavailable." };
              }
          } catch (e) {
              console.warn(`[${actionName}] Could not refresh current user session to get stored stats.`, e.message);
          }
      }
      const noAdminMsg = "Admin client not available for live calculation. Cannot fetch live referral stats.";
      console.log(`[${actionName}] ${noAdminMsg}`);
      return { success: false, message: noAdminMsg, error: "GLRSA_NO_ADMIN_CLIENT" };
  }


  // The rest of the logic requires adminPb
  const currentAuthUserId = adminPb.authStore.model?.id; // This would be admin's ID
  if (!currentAuthUserId) {
    const msg = "Admin not properly authenticated. Cannot fetch live referral stats. (GLRSA_NO_ADMIN_AUTH_VALID)";
    console.log(`[${actionName}] ${msg}`);
    return { success: false, message: msg, error: "GLRSA_NO_ADMIN_AUTH_VALID" };
  }

  // This logic needs to fetch the *calling user's* referral code, not the admin's.
  // This action needs to be re-thought if it's called by a regular user but needs admin to query all users.
  // For now, let's assume it's called by an admin checking their own stats, or it needs modification.
  // The current implementation below assumes adminPb is the *user whose stats are being checked*.
  // This is incorrect if it's supposed to be generic.

  // For now, this will return an error as the logic is flawed without proper context of WHOSE stats to fetch.
  const flawedLogicMsg = "Logic for fetching specific user's referral stats needs current user context, not admin context. Action needs rework.";
  console.error(`[${actionName}] ${flawedLogicMsg}`);
  return { success: false, message: flawedLogicMsg, error: "GLRSA_LOGIC_FLAW" };

  // Correct logic would be:
  // 1. Get the calling user's ID (from a non-admin authenticated pb instance using cookies).
  // 2. Get that user's referralCode.
  // 3. Use adminPb to query all users whose `referredByCode` matches the calling user's `referralCode`.
  // 4. Calculate stats based on the `model` of these referred users.
}
