
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
      return { success: false, message: "" }; // Keep message empty for UI
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
    
    newUserPocketBase = await createUserInPocketBase(userDataForPocketBase, pbGlobal); // Using global pb for user creation (public rule)
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
      const pbAdmin = null; 
      if (pbAdmin) { 
        // Admin-dependent logic for referrer stats update - effectively skipped
      } else {
        console.warn(`[${actionName}] Admin client not available for referrer stats update. Skipping update for ${upperCaseReferredByCode}.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during (skipped) referrer stats update for ${upperCaseReferredByCode}. Error:`, statsError.message, statsError);
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
  userId: userIdFromClient,
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string,
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in again.", "UPA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again.", "UPA_E001B_AUTH_REFRESH_FAIL_SERVER");
  }
  
  const authenticatedUserId = pb.authStore.model.id;
  if (userIdFromClient !== authenticatedUserId) {
      console.error(`[${actionName}] Security alert: Authenticated user ${authenticatedUserId} attempting to update profile for ${userIdFromClient}. Denying.`);
      return createErrorResponse("Permission denied: Cannot update another user's profile.", "UPA_E001C_PERMISSION_DENIED_SERVER");
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
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_E001_SERVER)" };
    }
  } catch (_) {
    pb.authStore.clear();
    return { referrerName: null, error: "User auth refresh failed when fetching referrer info. (GRICA_E001B_SERVER)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  const currentUserReferredByCode = pb.authStore.model.referredByCode as string | undefined;

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
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to update avatar.", "UAA_E001B_AUTH_REFRESH_FAIL_SERVER");
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
      // ... more specific error messages
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
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to remove avatar.", "RAA_E001B_AUTH_REFRESH_FAIL_SERVER");
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
      // ... more specific error messages
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question. FormData keys:`, Array.from(formData.keys()));
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  } else {
     console.error(`[${actionName}] No auth cookie found for Add Question. User is likely not authenticated for this action.`);
     return createErrorResponse(
      "User is not authenticated. Please log in to add questions. (AQA_E000_NO_COOKIE_SERVER)",
      "AQA_E000_NO_COOKIE_SERVER",
      "No auth cookie found."
    );
  }

  try {
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] Auth refresh successful for Add Question. User: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
  } catch (authError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed. Error:`, authError);
    let specificMessage = "User authentication failed or token expired. Please log in again.";
    if (authError instanceof ClientResponseError) {
        console.error(`[${actionName}] Auth refresh ClientResponseError details:`, JSON.stringify(authError.data));
        if (authError.status === 0) specificMessage = "Network error during auth refresh. Cannot add question.";
    }
    return createErrorResponse(specificMessage, "AQA_E001_AUTH_REFRESH_FAIL_SERVER", specificMessage);
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    console.error(`[${actionName}] User is not authenticated after authRefresh. Cannot add question. Auth store valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
    return createErrorResponse(
      "User is not authenticated. Cannot add question. (AQA_E001B_NO_AUTH_POST_REFRESH_SERVER)",
      "AQA_E001B_NO_AUTH_POST_REFRESH_SERVER",
      "User is not authenticated after authRefresh."
    );
  }
  
  // Rely on PocketBase rule: @request.auth.id != "" && @request.auth.role = "Admin"
  // The SDK will send the authenticated user's token. PocketBase will enforce the role.
  console.log(`[${actionName}] User is authenticated (ID: ${pb.authStore.model.id}, Role: ${pb.authStore.model.role}). Proceeding to create question in question_bank.`);

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
        errorMessage = `Permission Denied by PocketBase (403): You (Role: ${pb.authStore.model?.role}) may not have permission to add questions. Ensure PocketBase 'question_bank' Create Rule is '@request.auth.id != "" && @request.auth.role = "Admin"'. Details: ${detailedFieldErrors || error.data?.message}`;
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (authCookie?.value) {
      pb.authStore.loadFromCookie(authCookie.value);
  }
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Initial auth valid: ${pb.authStore.isValid}`);
  
  try {
    if (pb.authStore.token) {
        await pb.collection('users').authRefresh();
        console.log(`[${actionName}] Auth refresh attempted. User: ${pb.authStore.model?.id}, isValid: ${pb.authStore.isValid}`);
    }

    if (!pb.authStore.isValid) {
        console.error(`[${actionName}] User not authenticated. Cannot fetch lessons. Rule is @request.auth.id != ""`);
        return createErrorResponse("User not authenticated. Please log in to view lessons.", "GLBSA_E001B_NO_AUTH_SERVER", "User not authenticated for lesson view.");
    }
    
    console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject} as user ${pb.authStore.model.id}`);
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
      errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match filter when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used by SDK: ${pb.baseUrl}. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase: You may not have permission to view lessons for '${subject}'. Please ensure you are logged in. PocketBase 'question_bank' View Rule likely requires authentication (e.g., "@request.auth.id != """). User ID after auth attempt: ${pb.authStore.model?.id || 'N/A'}`;
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');

  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Initial auth valid: ${pb.authStore.isValid}`);
  
  try {
    if (pb.authStore.token) {
        await pb.collection('users').authRefresh();
        console.log(`[${actionName}] Auth refresh attempted. User: ${pb.authStore.model?.id}, isValid: ${pb.authStore.isValid}`);
    }

    if (!pb.authStore.isValid) {
        console.error(`[${actionName}] User not authenticated. Cannot fetch questions. Rule is @request.auth.id != ""`);
        return createErrorResponse("User not authenticated. Please log in to view questions.", "GQBLA_E001B_NO_AUTH_SERVER", "User not authenticated for question view.");
    }

    console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName} as user ${pb.authStore.model.id}`);
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
      errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      errorCode = `GQBLA_E003_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used: ${pb.baseUrl}. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase: You may not have permission to view questions for '${subject} - ${lessonName}'. Please ensure you are logged in. PocketBase 'question_bank' View Rule likely requires authentication (e.g., "@request.auth.id != """). User ID after auth attempt: ${pb.authStore.model?.id || 'N/A'}`;
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
  console.log(`[${actionName}] Received payload for user. Subject: ${payload.subject}, Lesson: ${payload.lessonName}`);
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  console.log(`[${actionName}] Auth cookie from store: ${authCookie?.value ? authCookie.value.substring(0, 20) + '...' : 'MISSING'}`);

  if (!authCookie?.value) {
    console.error(`[${actionName}] No auth cookie found. User is not authenticated.`);
    return createErrorResponse(
      "User not authenticated. Please log in to save your attempt. (SDPPA_E000_NO_COOKIE_SERVER)", 
      "NoAuthCookie", 
      "No auth cookie found in request."
    );
  }
  
  pb.authStore.loadFromCookie(authCookie.value);
  console.log(`[${actionName}] Auth store loaded from cookie. Before authRefresh - isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}, token: ${pb.authStore.token ? pb.authStore.token.substring(0,10)+'...' : 'NONE'}`);

  try {
    await pb.collection('users').authRefresh(); 
    console.log(`[${actionName}] Auth refresh successful. After authRefresh - isValid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
  } catch (authError) {
    pb.authStore.clear(); 
    console.error(`[${actionName}] Auth refresh failed. User is likely not authenticated or token expired. Error:`, authError);
    let specificMessage = "User authentication failed or token expired. Please log in again to save DPP attempt.";
    if (authError instanceof ClientResponseError) {
        console.error(`[${actionName}] Auth refresh ClientResponseError details:`, JSON.stringify(authError.data));
        if (authError.status === 0) specificMessage = "Network error during auth refresh. Cannot save attempt.";
        else if (authError.status === 401 || authError.status === 403) specificMessage = "Your session is invalid or expired. Please log in again to save your attempt.";
        else specificMessage = `Auth refresh error (${authError.status}). Please log in again.`;
    }
    return createErrorResponse(specificMessage, "SDPPA_E001_AUTH_REFRESH_FAIL_SERVER", specificMessage);
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.error(`[${actionName}] User is not properly authenticated after authRefresh. Auth store valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}. Cannot save DPP attempt.`);
      return createErrorResponse(
          "User not authenticated. Please log in to save your attempt. (SDPPA_E001B_INVALID_CONTEXT_POST_REFRESH_SERVER)",
          "InvalidAuthContextPostRefresh",
          `Auth store valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`
      );
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Authenticated User ID for DPP attempt: ${userId}`);

  const dataToSaveOrUpdate = {
    userId: userId,
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
  };
  console.log(`[${actionName}] Data prepared for save/update for user ${userId}: Attempting to save ${dataToSaveOrUpdate.questionsAttempted.length} question details.`);

  try {
    let existingAttempt = null;
    const filter = `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
    console.log(`[${actionName}] Checking for existing attempt with filter: ${filter}`);
    
    try {
      existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
      console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update.`);
    } catch (findError) {
      if (findError instanceof ClientResponseError && findError.status === 404) {
        console.log(`[${actionName}] No existing attempt found. Will create a new one.`);
        existingAttempt = null;
      } else {
        console.error(`[${actionName}] Error when checking for existing attempt:`, findError);
        if (findError instanceof ClientResponseError) console.error(`[${actionName}] Find Error Details:`, JSON.stringify(findError.data))
        throw findError; 
      }
    }

    if (existingAttempt) {
      console.log(`[${actionName}] Attempting to update existing attempt ID: ${existingAttempt.id} with data: `, JSON.stringify(dataToSaveOrUpdate).substring(0, 200) + "...");
      const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      console.log(`[${actionName}] Attempting to create new DPP attempt with data: `, JSON.stringify(dataToSaveOrUpdate).substring(0, 200) + "...");
      const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
      return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
    }

  } catch (error) {
    console.error(`[${actionName}] Error saving/updating DPP attempt for user ${userId}:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details:`, JSON.stringify(error.data));
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection (Create/Update: "@request.auth.id != """, Update: "@request.auth.id == userId"). User: ${userId}, Role: ${pb.authStore.model?.role}. Error data: ${JSON.stringify(error.data)}`;
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
