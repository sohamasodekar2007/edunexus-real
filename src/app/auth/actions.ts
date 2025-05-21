// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import PocketBase from 'pocketbase'; // Import PocketBase class
import { cookies } from 'next/headers'; // Import cookies
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { format } from 'date-fns';
// Removed: import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';


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
            console.log(`[${actionName}] Referrer stats update for ${referrer.id} will be attempted with user's context or public rule. Stats:`, newStats);
            // This might fail if users collection Update Rule is restrictive for 'referralStats' field.
            // For now, using pbGlobal which implies the user's token (if correctly passed) or admin token (if adminPb was used).
            // If neither is admin and it's not self-update, it relies on lenient rules.
            await updateUserReferralStats(referrer.id, newStats, pbGlobal); 
        } else {
             console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found. No stats updated.`);
        }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referrer stats update for ${upperCaseReferredByCode}. This does not block signup. Error:`, statsError.message, statsError);
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
    const userName = userFullName.split(' ')[0] || 'User';
    const avatarFilename = user.avatar as string | undefined;
    const avatarUrl = avatarFilename ? pbGlobal.getFileUrl(user, avatarFilename) : null;
    const userReferredByCode = user.referredByCode || null; 

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
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (!authCookie?.value) {
    return createErrorResponse("User not authenticated (no auth cookie). Please log in again.", "UPA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);
  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse("Session validation failed. Please log in again.", "UPA_AUTH_REFRESH_FAIL", (refreshError as Error).message);
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User not authenticated or session invalid after refresh. Please log in again.", "UPA_NO_AUTH_SERVER");
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
        errorMessage = `Permission Denied by PocketBase (403). Ensure 'users' collection Update Rule is '@request.auth.id = id'. Server log: ${JSON.stringify(error.data)}`;
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
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
      await pb.collection('users').authRefresh();
    } catch (_) {
      pb.authStore.clear();
    }
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_NO_AUTH_SERVER)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  // Use the request-scoped authenticated pb instance
  const currentUserRecord = await findUserById(currentAuthUserId, pb); 
  const currentUserReferredByCode = currentUserRecord?.referredByCode;


  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // Use the request-scoped authenticated pb instance
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
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (!authCookie?.value) {
     return createErrorResponse("User not authenticated (no auth cookie). Please log in to update your avatar.", "UAA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);
   try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse("Session validation failed. Please log in again to update avatar.", "UAA_AUTH_REFRESH_FAIL", (refreshError as Error).message);
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User not authenticated or session invalid after refresh. Please log in to update your avatar.", "UAA_NO_AUTH_SERVER");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    // Use the request-scoped authenticated pb instance
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
        errorMessage = `Permission Denied by PocketBase (403) for avatar update. Ensure 'users' collection Update Rule is '@request.auth.id = id'. Details: ${JSON.stringify(error.data)}`;
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
    return createErrorResponse("User not authenticated (no auth cookie). Please log in to remove your avatar.", "RAA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);
  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse("Session validation failed. Please log in again to remove avatar.", "RAA_AUTH_REFRESH_FAIL", (refreshError as Error).message);
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User not authenticated or session invalid after refresh. Please log in to remove your avatar.", "RAA_NO_AUTH_SERVER");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    // Use the request-scoped authenticated pb instance
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
        errorMessage = `Permission Denied by PocketBase (403) for avatar removal. Ensure 'users' collection Update Rule is '@request.auth.id = id'. Details: ${JSON.stringify(error.data)}`;
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
  
  // Relies on client-side guard for admin role and PocketBase 'question_bank' Create Rule.
  // For this to work, PocketBase 'question_bank' Create Rule must be: @request.auth.id != "" && @request.auth.role = "Admin"
  // The server action needs to use an authenticated PB instance for the user calling it.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful. User: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
    } catch (refreshError) {
      pb.authStore.clear();
      const errMessage = (refreshError as Error).message;
      console.error(`[${actionName}] Auth refresh failed. Error: ${errMessage}`);
      // This error will be shown if the user's token is invalid or expired
      return createErrorResponse(
          `Session validation failed. Please ensure you are logged in. Details: ${errMessage}`,
          "AQA_AUTH_REFRESH_FAIL",
          errMessage
      );
    }
  } else {
      console.error(`[${actionName}] No auth cookie found. User is not authenticated to add questions.`);
      return createErrorResponse(
        "User is not authenticated (no auth cookie). Please log in to add questions.",
        "AQA_NO_AUTH_COOKIE_SERVER"
    );
  }
  
  // Check if the authenticated user is an Admin, as required by PocketBase rule
  if (!pb.authStore.isValid || pb.authStore.model?.role !== 'Admin') {
    const authRole = pb.authStore.model?.role || 'Unknown/Not Authenticated';
    console.error(`[${actionName}] User is not an Admin. Auth Valid: ${pb.authStore.isValid}, User Role: ${authRole}`);
    return createErrorResponse(
        `Access Denied: You must have an Admin role to add questions. Your current role: ${authRole}.`,
        "AQA_NOT_ADMIN_SERVER_ROLE_CHECK",
        `Detected Role: ${authRole}. Required: Admin.`
    );
  }

  console.log(`[${actionName}] User confirmed as Admin (${pb.authStore.model.id}). Proceeding to create question.`);

  try {
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
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? 'Present' : 'MISSING/NOT_SENT_BY_CLIENT'}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    console.log(`[${actionName}] Auth cookie loaded. isValid before refresh: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful. isValid after refresh: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
    } catch (refreshError) {
      pb.authStore.clear();
      console.warn(`[${actionName}] Auth refresh failed. Error: ${(refreshError as Error).message}. Session cleared.`);
      return createErrorResponse(
        "User not authenticated. Please log in to view lessons. (Session refresh failed)",
        "GLBSA_AUTH_REFRESH_FAIL",
        (refreshError as Error).message
      );
    }
  } else {
    console.log(`[${actionName}] No auth cookie found. Cannot fetch lessons as authenticated user.`);
    return createErrorResponse(
      "User not authenticated. Please log in to view lessons. (No auth cookie)",
      "GLBSA_NO_AUTH_COOKIE"
    );
  }
  
  // This check is crucial because your question_bank View Rule is @request.auth.id != ""
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
     console.error(`[${actionName}] User is not authenticated after auth handling. isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}. Cannot fetch lessons.`);
     return createErrorResponse(
      "User not authenticated. Please log in to view lessons.",
      "GLBSA_INVALID_AUTH_POST_REFRESH"
    );
  }
  
  try {
    console.log(`[${actionName}] Proceeding to fetch lessons for subject: ${subject} using user ${pb.authStore.model.id}.`);
    // Use the request-scoped authenticated pb instance
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
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view lessons for '${subject}'. PocketBase 'question_bank' View Rule is '@request.auth.id != ""'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
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
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Auth cookie found: ${!!authCookie?.value}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    console.log(`[${actionName}] Auth cookie loaded. isValid before refresh: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful. isValid after refresh: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
    } catch (refreshError) {
      pb.authStore.clear();
      console.warn(`[${actionName}] Auth refresh failed. Error: ${(refreshError as Error).message}. Session cleared.`);
      return createErrorResponse(
        "User not authenticated. Please log in to view questions. (Session refresh failed)",
        "GQBLA_AUTH_REFRESH_FAIL",
        (refreshError as Error).message
      );
    }
  } else {
    console.log(`[${actionName}] No auth cookie found. Cannot fetch questions as authenticated user.`);
     return createErrorResponse(
      "User not authenticated. Please log in to view questions. (No auth cookie)",
      "GQBLA_NO_AUTH_COOKIE"
    );
  }
  
  // This check is crucial because your question_bank View Rule is @request.auth.id != ""
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
     console.error(`[${actionName}] User is not authenticated after auth handling. isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}. Cannot fetch questions.`);
     return createErrorResponse(
      "User not authenticated. Please log in to view questions.",
      "GQBLA_INVALID_AUTH_POST_REFRESH"
    );
  }

  try {
    console.log(`[${actionName}] Proceeding to fetch questions for subject: ${subject}, lesson: ${lessonName} using user ${pb.authStore.model.id}.`);
    // Use the request-scoped authenticated pb instance
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
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view questions for '${subject} - ${lessonName}'. PocketBase 'question_bank' View Rule is '@request.auth.id != ""'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
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

  // For dpp_attempts, Create Rule and Update Rule are public ("")
  // We use pbGlobal (unauthenticated on server by default for actions) but populate userId if client provides it.
  const pb = pbGlobal; // Use global unauthenticated instance because rules are public
  let userIdForRecord = payload.userId || null; // Use userId from client if available

  const dataToSaveOrUpdate = {
    userId: userIdForRecord,
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
  };
  
  console.log(`[${actionName}] Data prepared for PocketBase:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

  if (userIdForRecord) {
    // If a userId is provided, attempt to find and update.
    // This assumes the client is authenticated and the pbGlobal instance, when used
    // in a server action context, might pick up the client's auth token if Next.js passes it.
    // Or, if Update Rule is "", no auth is needed for the update itself.
    try {
      const filter = `userId = "${userIdForRecord}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
      console.log(`[${actionName}] Checking for existing attempt for user ${userIdForRecord} with filter: ${filter}`);
      
      const existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter).catch(err => {
        if (err instanceof ClientResponseError && err.status === 404) {
          return null; // No existing record found
        }
        throw err; // Re-throw other errors
      });

      if (existingAttempt) {
        console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update.`);
        const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
        console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
        return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
      } else {
        console.log(`[${actionName}] No existing attempt found for user ${userIdForRecord}. Will create a new one.`);
        // Fall through to create
      }
    } catch (error) {
      // This catch is if getFirstListItem throws something other than 404, or if update fails
      return handleSaveDppError(error, actionName, userIdForRecord, "Error during find/update existing attempt.");
    }
  }

  // Create new attempt (either no userId was provided, or no existing attempt found for the user)
  try {
    console.log(`[${actionName}] Attempting to CREATE new dpp_attempts record. (User: ${userIdForRecord || 'Anonymous'})`);
    const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
    console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
    return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
  } catch (error) {
    return handleSaveDppError(error, actionName, userIdForRecord, "Error during create new attempt.");
  }
}

function handleSaveDppError(
    error: any, 
    actionName: string, 
    userIdAttempted: string | null,
    contextMessage: string
): { success: boolean; message: string; recordId?: string; error?: string; } {
    console.error(`[${actionName}] ${contextMessage} User: ${userIdAttempted || 'anonymous'}. Error:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. Check PocketBase rules for 'dpp_attempts'. User: ${userIdAttempted || 'anonymous'}. Error data: ${JSON.stringify(error.data)}`;
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt.`;
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


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to fetch live referral stats.`);
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (!authCookie?.value) {
     const msg = "User not authenticated (no auth cookie). Cannot fetch live referral stats. (GLRSA_NO_AUTH_COOKIE)";
     console.log(`[${actionName}] ${msg}`);
     return { success: false, message: msg, error: "GLRSA_NO_AUTH_COOKIE" };
  }
  pb.authStore.loadFromCookie(authCookie.value);
  
  let currentUser: User | null = null;
  try {
    await pb.collection('users').authRefresh(); // This instance is now authenticated as the current user
    if (!pb.authStore.isValid || !pb.authStore.model) {
        const msg = "Session validation failed for current user. Please log in again. (GLRSA_AUTH_REFRESH_FAIL)";
        console.log(`[${actionName}] ${msg}`);
        return { success: false, message: msg, error: "GLRSA_AUTH_REFRESH_FAIL"};
    }
    currentUser = pb.authStore.model as User;
    console.log(`[${actionName}] Current user authenticated: ${currentUser.id}`);
  } catch (refreshError) {
    pb.authStore.clear();
    const errMessage = (refreshError as Error).message;
    console.error(`[${actionName}] Auth refresh for current user failed: ${errMessage}`);
    return { success: false, message: `Session validation failed. Please log in again. Details: ${errMessage} (GLRSA_AUTH_REFRESH_FAIL_EXCEPTION)`, error: "GLRSA_AUTH_REFRESH_FAIL_EXCEPTION"};
  }


  if (!currentUser.referralCode) {
    const msg = "Current user does not have a referral code. (GLRSA_NO_REF_CODE)";
    console.log(`[${actionName}] ${msg}`);
    return { success: false, message: msg, error: "GLRSA_NO_REF_CODE", stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 } };
  }

  // For listing referred users, we need an admin client.
  // Re-instantiate admin client logic carefully here.
  let adminPbInstance: PocketBase | null = null;
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
  const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  if (!adminEmail || !adminPassword || !pocketbaseUrl) {
      const msg = "Admin credentials or PocketBase URL not set in .env. Cannot fetch referred users. (GLRSA_ADMIN_CONFIG_MISSING)";
      console.warn(`[${actionName}] ${msg}`);
      return { success: false, message: msg, error: "GLRSA_ADMIN_CONFIG_MISSING" };
  }

  try {
      adminPbInstance = new PocketBase(pocketbaseUrl);
      await adminPbInstance.admins.authWithPassword(adminEmail, adminPassword);
      console.log(`[${actionName}] Admin client authenticated successfully for listing referred users.`);
  } catch (adminAuthError) {
      const errMessage = (adminAuthError as Error).message;
      console.error(`[${actionName}] Admin client authentication for listing users failed: ${errMessage}`);
      if (adminAuthError instanceof ClientResponseError) {
          console.error(`[${actionName}] Admin Auth PocketBase Error details: ${JSON.stringify(adminAuthError.data)}`);
      }
      return { success: false, message: `Admin client authentication failed, cannot fetch referred users. Details: ${errMessage} (GLRSA_ADMIN_AUTH_FAIL_LISTING)`, error: "GLRSA_ADMIN_AUTH_FAIL_LISTING_EXCEPTION"};
  }

  try {
    console.log(`[${actionName}] Fetching users referred by code: ${currentUser.referralCode} using admin client.`);
    const referredUsers = await adminPbInstance.collection('users').getFullList({
      filter: `referredByCode = "${currentUser.referralCode}"`,
      fields: 'model', 
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
    console.log(`[${actionName}] Successfully calculated live stats: ${JSON.stringify(liveStats)}`);
    console.log(`[${actionName}] Returning success from live stats calculation: ${JSON.stringify({ success: true, stats: liveStats })}`);
    return { success: true, stats: liveStats };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error fetching referred users.";
    const errorCode = "GLRSA_FETCH_REFERRED_FAIL";
    console.error(`[${actionName}] Error calculating live referral stats (fetching referred users): ${errorMessage}`);
     if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details (fetching referred users): ${JSON.stringify(error.data)}`);
       if (error.status === 403) {
        console.error(`[${actionName}] Permission denied fetching referred users. The 'users' collection ListRule likely requires admin privileges or is misconfigured for this operation.`);
      }
    }
    const fullErrorResponse = { success: false, message: `Failed to calculate live referral stats: ${errorMessage} (${errorCode})`, error: errorCode };
    console.log(`[${actionName}] Returning error from live stats calculation: ${JSON.stringify(fullErrorResponse)}`);
    return fullErrorResponse;
  }
}
