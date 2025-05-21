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
    
    newUserPocketBase = await createUserInPocketBase(userDataForPocketBase, pbGlobal); // Use global instance
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
    // Referrer stats update logic would typically require admin auth or specific permissions.
    // For now, this part is simplified and might not update if admin client is not configured/used.
    try {
        const referrer = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); // Using pbGlobal, might fail if users can't be listed publicly
        if (referrer) {
            console.log(`[${actionName}] Found referrer ${referrer.id}. Current stats:`, referrer.referralStats);
            const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
            const newStats = {
                ...currentStats,
                referred_free: (currentStats.referred_free || 0) + 1,
            };
            // To update another user's stats, admin privileges are usually needed.
            // This call might fail if pbGlobal doesn't have rights to update other users.
            // await updateUserReferralStats(referrer.id, newStats, adminPb); // This would need adminPb
            console.warn(`[${actionName}] Referrer stats update for ${referrer.id} might require admin privileges which are not being used in this simplified setup.`);
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
    return createErrorResponse("Session validation failed. Please log in again.", "UPA_AUTH_REFRESH_FAIL");
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
  const currentUserRecord = await findUserById(currentAuthUserId, pb); 
  const currentUserReferredByCode = currentUserRecord?.referredByCode;


  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
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
    return createErrorResponse("Session validation failed. Please log in again to update avatar.", "UAA_AUTH_REFRESH_FAIL");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User not authenticated or session invalid after refresh. Please log in to update your avatar.", "UAA_NO_AUTH_SERVER");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
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
    return createErrorResponse("Session validation failed. Please log in again to remove avatar.", "RAA_AUTH_REFRESH_FAIL");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User not authenticated or session invalid after refresh. Please log in to remove your avatar.", "RAA_NO_AUTH_SERVER");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
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
  
  // This action relies on the user being authenticated as Admin client-side,
  // and PocketBase 'question_bank' Create Rule being: "@request.auth.id != "" && @request.auth.role = "Admin""
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful for addQuestionAction. User: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
    } catch (refreshError) {
      pb.authStore.clear();
      // If refresh fails, the user isn't properly authenticated server-side for this action
      console.error(`[${actionName}] Auth refresh failed. User might not be Admin or session invalid. Error: ${refreshError.message}`);
      return createErrorResponse(
          "Session validation failed. You might not be logged in as an Admin.",
          "AQA_AUTH_REFRESH_FAIL",
          refreshError.message
      );
    }
  } else {
      // No cookie means user is not authenticated for this server action
      console.error(`[${actionName}] No auth cookie found. User is not authenticated to add questions.`);
      return createErrorResponse(
        "User is not authenticated. Please log in as an Admin to add questions.",
        "AQA_NO_AUTH_COOKIE_SERVER"
    );
  }
  
  // Explicit server-side check for Admin role after ensuring authStore is valid
  if (!pb.authStore.isValid || pb.authStore.model?.role !== 'Admin') {
    console.error(`[${actionName}] User is not authenticated as Admin. Auth Valid: ${pb.authStore.isValid}, User Role: ${pb.authStore.model?.role}`);
    return createErrorResponse(
        "Access Denied: You must be logged in as an Admin to add questions.",
        "AQA_NOT_ADMIN_SERVER",
        `Detected Role: ${pb.authStore.model?.role || 'Unknown/Not Authenticated'}. Required: Admin.`
    );
  }

  console.log(`[${actionName}] User confirmed as Admin. Proceeding to create question.`);

  try {
    // Use the pb instance that has been authenticated with the user's cookie
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
        errorMessage = `Permission Denied by PocketBase (403): Your account (Role: ${pb.authStore.model?.role}) may not have permission to add questions. Ensure your PocketBase 'question_bank' Create Rule is '@request.auth.id != "" && @request.auth.role = "Admin"'. Details: ${detailedFieldErrors || error.data?.message}`;
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Auth cookie found: ${!!authCookie?.value}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful. User: ${pb.authStore.model?.id}`);
    } catch (refreshError) {
      pb.authStore.clear();
      console.warn(`[${actionName}] Auth refresh failed during getLessonsBySubjectAction. Error: ${refreshError.message}. Proceeding as potentially unauthenticated.`);
      // Return error if auth refresh fails, as PB rule requires auth
      return createErrorResponse(
        "Session validation failed. Please log in to view lessons.",
        "GLBSA_AUTH_REFRESH_FAIL",
        refreshError.message
      );
    }
  } else {
    // No cookie means user is not authenticated for this server action
    console.error(`[${actionName}] No auth cookie found. User is not authenticated to view lessons.`);
    return createErrorResponse(
      "User is not authenticated. Please log in to view lessons.",
      "GLBSA_NO_AUTH_COOKIE_SERVER"
    );
  }

  if (!pb.authStore.isValid) {
    console.error(`[${actionName}] User is not authenticated after auth handling. Cannot fetch lessons.`);
     return createErrorResponse(
      "User not authenticated. Please log in to view lessons.",
      "GLBSA_INVALID_AUTH_POST_REFRESH"
    );
  }
  
  try {
    console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}. User auth valid: ${pb.authStore.isValid}`);
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Auth cookie found: ${!!authCookie?.value}`);

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
    try {
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] Auth refresh successful. User: ${pb.authStore.model?.id}`);
    } catch (refreshError) {
      pb.authStore.clear();
       console.warn(`[${actionName}] Auth refresh failed. Error: ${refreshError.message}. Proceeding as potentially unauthenticated.`);
        return createErrorResponse(
        "Session validation failed. Please log in to view questions.",
        "GQBLA_AUTH_REFRESH_FAIL",
        refreshError.message
      );
    }
  } else {
     console.error(`[${actionName}] No auth cookie found. User is not authenticated to view questions.`);
    return createErrorResponse(
      "User is not authenticated. Please log in to view questions.",
      "GQBLA_NO_AUTH_COOKIE_SERVER"
    );
  }
  
  if (!pb.authStore.isValid) {
     console.error(`[${actionName}] User is not authenticated after auth handling. Cannot fetch questions.`);
     return createErrorResponse(
      "User not authenticated. Please log in to view questions.",
      "GQBLA_INVALID_AUTH_POST_REFRESH"
    );
  }

  try {
    console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}. User auth valid: ${pb.authStore.isValid}`);
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
  console.log(`[${actionName}] Received payload. UserID from client: ${payload.userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName}`);

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? 'Present' : 'MISSING/NOT_SENT_BY_CLIENT'}`);
  console.log(`[${actionName}] Client-provided userId from payload: ${payload.userId}`);

  // If client provides userId, we assume client has already validated its login state.
  // If Create Rule is "", PocketBase doesn't require server-side auth for the action itself,
  // but we still need userId to associate the attempt if provided.
  if (!payload.userId && authCookie?.value) {
      // This case is if client somehow didn't send userId but a cookie exists.
      // We could try to auth here, but it's better if client controls sending userId.
      // For now, if userId is not in payload, it will be saved as null if PB field allows.
      console.warn(`[${actionName}] No userId in payload, but authCookie exists. Attempt will be saved without explicit userId if PB field is optional.`);
  } else if (!payload.userId && !authCookie?.value) {
      console.log(`[${actionName}] No userId in payload and no authCookie. Saving attempt anonymously if PB collection allows.`);
  }


  // The data to save. userId will be null if not provided by client (for anonymous attempts).
  const dataToSaveOrUpdate = {
    userId: payload.userId || null, 
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
  };
  console.log(`[${actionName}] Data prepared for PocketBase:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

  // If userId is present, try to find and update. Otherwise, always create.
  if (payload.userId) {
    try {
      let existingAttempt = null;
      const filter = `userId = "${payload.userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
      console.log(`[${actionName}] Checking for existing attempt for user ${payload.userId} with filter: ${filter}`);
      
      try {
        // For find, we must use an authenticated instance if rules require it (e.g. list/view = @request.auth.id == userId)
        // If updateRule is @request.auth.id == userId, the update call itself needs to be authenticated as that user.
        // If createRule is "", but updateRule is restrictive, this part needs care.
        // For now, assuming if client sends userId, they are logged in, and pbGlobal *might* pick up their token for server action context.
        // This is often not the case. A request-scoped authenticated instance is better for find/update.
        // Let's re-introduce request-scoped auth for find/update if userId is present.

        let pbForFindUpdate: PocketBase;
        if (authCookie?.value) {
            pbForFindUpdate = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
            pbForFindUpdate.authStore.loadFromCookie(authCookie.value);
            await pbForFindUpdate.collection('users').authRefresh(); // Try to refresh
            if(!pbForFindUpdate.authStore.isValid || pbForFindUpdate.authStore.model?.id !== payload.userId) {
                 console.error(`[${actionName}] Auth refresh for find/update failed or ID mismatch. Cannot reliably update.`);
                 // Fallback to creating a new record if update can't be safely performed
                 return createOrUpdateAttempt(pbGlobal, null, dataToSaveOrUpdate, actionName); // Create with global, unauth instance
            }
        } else {
            // No cookie, cannot reliably update based on userId.
            console.warn(`[${actionName}] No auth cookie to verify userId for update. Will attempt create only.`);
            // This path means we should just attempt to create, because we can't verify ownership for an update
            return createOrUpdateAttempt(pbGlobal, null, dataToSaveOrUpdate, actionName); // Create with global, unauth instance
        }
        
        existingAttempt = await pbForFindUpdate.collection('dpp_attempts').getFirstListItem(filter);
        console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update using user-authenticated instance.`);
        return createOrUpdateAttempt(pbForFindUpdate, existingAttempt.id, dataToSaveOrUpdate, actionName);

      } catch (findError) {
        if (findError instanceof ClientResponseError && findError.status === 404) {
          console.log(`[${actionName}] No existing attempt found for user ${payload.userId}. Will create a new one.`);
          // If user was logged in (authCookie existed), try to create with their context
          let pbForCreate = pbGlobal;
          if(authCookie?.value) {
            pbForCreate = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
            pbForCreate.authStore.loadFromCookie(authCookie.value);
            // No need to authRefresh again if it was done for find/update check
            if (!pbForCreate.authStore.isValid) pbForCreate = pbGlobal; // fallback if somehow invalid
          }
          return createOrUpdateAttempt(pbForCreate, null, dataToSaveOrUpdate, actionName);
        }
        // Other errors during find
        console.error(`[${actionName}] Error when checking for existing attempt for user ${payload.userId}:`, findError);
        if (findError instanceof ClientResponseError) {
          console.error(`[${actionName}] Find Error Details: Status ${findError.status}, Response: ${JSON.stringify(findError.response)}`);
        }
        throw findError; 
      }
    } catch (error) { // Catch errors from the outer try if find/update logic has issues
        return handleSaveDppError(error, actionName, payload.userId);
    }
  } else {
    // No userId provided by client (anonymous attempt), so directly create using pbGlobal
    console.log(`[${actionName}] No userId provided. Attempting to create anonymous record.`);
    return createOrUpdateAttempt(pbGlobal, null, dataToSaveOrUpdate, actionName);
  }
}

// Helper function for create/update logic to reduce repetition
async function createOrUpdateAttempt(
    pbInstance: PocketBase, // The PB instance to use (could be user-auth or global)
    recordIdToUpdate: string | null, 
    data: any,
    actionName: string
): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
    try {
        if (recordIdToUpdate) {
            console.log(`[${actionName}] Attempting to UPDATE existing dpp_attempts ID: ${recordIdToUpdate} using instance: ${pbInstance === pbGlobal ? 'pbGlobal' : 'user-scoped pb'}`);
            const updatedRecord = await pbInstance.collection('dpp_attempts').update(recordIdToUpdate, data);
            console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            console.log(`[${actionName}] Attempting to CREATE new dpp_attempts record using instance: ${pbInstance === pbGlobal ? 'pbGlobal' : 'user-scoped pb'}`);
            const newRecord = await pbInstance.collection('dpp_attempts').create(data);
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error) {
        return handleSaveDppError(error, actionName, data.userId);
    }
}

function handleSaveDppError(
    error: any, 
    actionName: string, 
    userIdAttempted: string | null
): { success: boolean; message: string; recordId?: string; error?: string; } {
    console.error(`[${actionName}] Error during create/update DPP attempt for user ${userIdAttempted || 'anonymous'}:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection. Create Rule: "", Update Rule needs to be @request.auth.id == userId. Attempting for User: ${userIdAttempted || 'anonymous'}. Error data: ${JSON.stringify(error.data)}`;
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. This implies an issue with token propagation or rules if client was logged in.`;
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
     return createErrorResponse("User not authenticated (no auth cookie).", "GLRSA_NO_AUTH_COOKIE");
  }
  pb.authStore.loadFromCookie(authCookie.value);
  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse("Session validation failed. Please log in again.", "GLRSA_AUTH_REFRESH_FAIL");
  }


  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    const errorMsg = "User not authenticated. Cannot fetch referral stats. (GLRSA_E002)";
     console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMsg, error: "UserNotAuthenticated" })}`);
    return { success: false, message: errorMsg, error: "UserNotAuthenticated" };
  }

  const currentUser = pb.authStore.model as User;
  if (!currentUser.referralCode) {
    const errorMsg = "Current user does not have a referral code. (GLRSA_E003)";
     console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMsg, error: "NoReferralCode" })}`);
    return { success: false, message: errorMsg, error: "NoReferralCode", stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 } };
  }

  // This part needs an admin client if users collection ListRule is admin-only
  // For now, let's try with user's own auth; it will fail if users cannot list other users.
  let adminPbForListingUsers: PocketBase;
  // Try to get an admin client for listing users if needed, for now using user's context
  // which might be restricted by 'users' collection ListRule.
  // To make this robust, you'd use 'requirePocketBaseAdmin()' here if ListRule is admin-only.
  // For simplicity, assuming users can list other users if filtering by referredByCode (unlikely default)
  // OR, this part might fail if user list rule requires admin.
  adminPbForListingUsers = pb; // Using current user's context.
  console.warn(`[${actionName}] Attempting to list referred users using current user's auth context. This might fail if 'users' ListRule requires admin.`);


  try {
    console.log(`[${actionName}] Fetching users referred by code: ${currentUser.referralCode}`);
    const referredUsers = await adminPbForListingUsers.collection('users').getFullList({
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
    return { success: true, stats: liveStats };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error fetching referred users.";
    console.error(`[${actionName}] Error calculating live referral stats: ${errorMessage}`);
     if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details (fetching referred users): ${JSON.stringify(error.data)}`);
       if (error.status === 403) {
        console.error(`[${actionName}] Permission denied fetching referred users. The 'users' collection ListRule likely requires admin privileges or is misconfigured for this operation.`);
        return createErrorResponse(
            `Permission denied fetching referred users. Your 'users' collection ListRule might require admin privileges for this operation.`,
            "GLRSA_PB_403_USER_LIST"
        );
      }
    }
    console.log(`[${actionName}] Returning error from live stats calculation: ${JSON.stringify({ success: false, message: `Failed to calculate live referral stats: ${errorMessage}`, error: "LiveStatsCalculationError (GLRSA_E004)" })}`);
    return { success: false, message: `Failed to calculate live referral stats: ${errorMessage}`, error: "LiveStatsCalculationError (GLRSA_E004)" };
  }
}

    