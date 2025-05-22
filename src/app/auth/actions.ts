
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
import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { getCollegeDetails } from '@/ai/flows/college-details-flow';
import type { CollegeDetailsInput, CollegeDetailsOutput } from '@/ai/flows/college-details-flow';


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
    // This action is typically called by unauthenticated users, so use global pb.
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" }; // No error message for invalid code
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // No error message on exception either
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
    console.log(`[${actionName}] Attempting to create user in PocketBase. Data (password omitted):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Use global pb instance for user creation, relying on public create rule for 'users' collection
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
        const adminPb = await getPocketBaseAdmin(); // Attempt to get admin client
        if (adminPb) {
            const referrer = await findUserByReferralCode(upperCaseReferredByCode, adminPb);
            if (referrer) {
                console.log(`[${actionName}] Found referrer ${referrer.id}. Current stats:`, referrer.referralStats);
                const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
                const newStats: User['referralStats'] = {
                    ...currentStats,
                    referred_free: (currentStats.referred_free || 0) + 1,
                };
                await updateUserReferralStats(referrer.id, newStats, adminPb);
                console.log(`[${actionName}] Successfully updated referrer stats for ${referrer.id} using admin client. New stats:`, newStats);
            } else {
                 console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found using admin client. No stats updated.`);
            }
        } else {
             console.warn(`[${actionName}] Admin client (getPocketBaseAdmin) returned null. Referrer stats update skipped. This usually means POCKETBASE_ADMIN_EMAIL/PASSWORD are not set or are invalid.`);
        }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referrer stats processing for ${upperCaseReferredByCode}. This does not block signup. Error:`, statsError.message, statsError);
      if (statsError instanceof ClientResponseError) {
        console.warn(`[${actionName}] Referrer stats processing PocketBase error:`, JSON.stringify(statsError.data));
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
    const userName = userFullName; 
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
  
  // This action is for a user updating their own profile.
  // It should use the user's own authentication context.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_NO_AUTH_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value, true);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse("Session invalid or expired. Please log in again.", "UPA_AUTH_REFRESH_FAIL_SERVER");
  }
  
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User session not valid. Cannot update profile.", "UPA_SESSION_INVALID_POST_REFRESH_SERVER");
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
    // Use the user-authenticated pb instance for self-update.
    const updatedUserRecord = await updateUserInPocketBase(authenticatedUserId, dataForPocketBase, pb); 
    console.log(`[${actionName}] Profile updated successfully for user ${authenticatedUserId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${authenticatedUserId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}_SERVER`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403). Ensure 'users' collection Update Rule allows self-update (e.g., '@request.auth.id = id'). Details: ${JSON.stringify(error.data)}`;
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
    return { referrerName: null, error: "User not authenticated. (GRICA_NO_AUTH_COOKIE_SERVER)" };
  }
  pb.authStore.loadFromCookie(authCookie.value, true);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    return { referrerName: null, error: "Session invalid or expired. (GRICA_AUTH_REFRESH_FAIL_SERVER)" };
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return { referrerName: null, error: "User session not valid. (GRICA_SESSION_INVALID_POST_REFRESH_SERVER)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  // Fetch user record again to ensure we have the latest 'referredByCode'
  const currentUserRecord = await findUserById(currentAuthUserId, pb); 
  const currentUserReferredByCode = currentUserRecord?.referredByCode;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    return { referrerName: null }; // No error, just no referrer
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // Use the user-authenticated pb instance to find the referrer (if View Rule for users is public or allows authenticated read)
    // Or, if referrer details need to be fetched with admin rights: const adminPb = await getPocketBaseAdmin(); if(adminPb) { ... }
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pb); 
    if (referrer && referrer.name) {
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
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_NO_AUTH_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value, true);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    return createErrorResponse("Session invalid or expired. Please log in to update avatar.", "UAA_AUTH_REFRESH_FAIL_SERVER");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User session not valid. Please log in to update avatar.", "UAA_SESSION_INVALID_POST_REFRESH_SERVER");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    // Use the user-authenticated pb instance for self-update.
    const updatedRecord = await pb.collection('users').update(userId, formData); 
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    let errorCode = "UAA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UAA_PB_${error.status}_SERVER`;
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
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_NO_AUTH_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value, true);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
    return createErrorResponse("Session invalid or expired. Please log in to remove avatar.", "RAA_AUTH_REFRESH_FAIL_SERVER");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return createErrorResponse("User session not valid. Please log in to remove avatar.", "RAA_SESSION_INVALID_POST_REFRESH_SERVER");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    // Use the user-authenticated pb instance
    const updatedRecord = await pb.collection('users').update(userId, { 'avatar': null }); 
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    let errorCode = "RAA_E002_UPDATE_FAIL_SERVER";
     if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `RAA_PB_${error.status}_SERVER`;
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
  console.log(`[${actionName}] Attempting to add question. FormData keys: ${Array.from(formData.keys()).join(', ')}`);

  // This action relies on the client-side layout ensuring only 'Admin' role users can access the page,
  // AND PocketBase 'question_bank' collection having a Create Rule: @request.auth.id != "" && @request.auth.role = "Admin"
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie || !authCookie.value) {
    console.warn(`[${actionName}] No auth cookie found.`);
    return createErrorResponse(
      "User not authenticated. Cannot add question. Please ensure you are logged in with an Admin account.",
      "AQA_NO_AUTH_COOKIE_SERVER"
    );
  }

  pb.authStore.loadFromCookie(authCookie.value, true);
  
  try {
    console.log(`[${actionName}] Attempting authRefresh before adding question. Current auth valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] AuthRefresh successful. New auth valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, refreshError);
    return createErrorResponse(
      "User session invalid or expired. Cannot add question.",
      "AQA_AUTH_REFRESH_FAIL_SERVER"
    );
  }
  
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
     return createErrorResponse("User is not properly authenticated after refresh. Cannot add question.", "AQA_NOT_AUTH_POST_REFRESH_SERVER");
  }
  
  if (pb.authStore.model.role !== 'Admin') {
    console.warn(`[${actionName}] User ${pb.authStore.model.id} (Role: ${pb.authStore.model.role}) is not an Admin. Denying question add.`);
    return createErrorResponse(
      "User does not have Admin privileges. Cannot add question.",
      "AQA_NOT_ADMIN_SERVER"
    );
  }
  
  console.log(`[${actionName}] User ${pb.authStore.model.id} (Role: ${pb.authStore.model.role}) is attempting to add a question.`);

  try {
    // Use the authenticated pb instance (acting as the logged-in admin user)
    const newQuestionRecord = await pb.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };
  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_CREATE_FAIL_SERVER";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details: Status ${error.status}`, JSON.stringify(error.data, null, 2));
      detailedFieldErrors = error.data?.data ? JSON.stringify(error.data.data) : "";

      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): You do not have permission to create questions. Ensure your account has the 'Admin' role and the 'question_bank' Create Rule is '@request.auth.id != "" && @request.auth.role = "Admin"'. Details: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) {
         errorMessage = `Authentication Required by PocketBase (401). This indicates an issue with the auth token.`;
      } else if (error.status === 400 && error.data?.data) {
        let fieldErrorMessages = "Validation errors: ";
        try {
            const fieldErrorsObj = error.data.data;
            fieldErrorMessages += Object.entries(fieldErrorsObj).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        } catch {
            fieldErrorMessages += detailedFieldErrors;
        }
        errorMessage = fieldErrorMessages;
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
  
  // This action relies on PocketBase question_bank collection's View Rule being public ("").
  // No server-side authentication check is performed here.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie || !authCookie.value) {
      console.warn(`[${actionName}] No auth cookie found. Proceeding as unauthenticated.`);
      // If rules are public, this is fine. If rules require auth, PB will reject.
  } else {
      pb.authStore.loadFromCookie(authCookie.value, true);
      try {
          console.log(`[${actionName}] Attempting authRefresh. Auth valid before: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
          await pb.collection('users').authRefresh();
          console.log(`[${actionName}] AuthRefresh successful. Auth valid after: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
      } catch (refreshError) {
          pb.authStore.clear();
          console.warn(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message, ". Proceeding as unauthenticated.");
          // If rules require auth, PB will reject. This is okay if it does.
      }
  }
  
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Current authStore valid: ${pb.authStore.isValid}`);

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
    let errorCode = `GLBSA_E003_SERVER`; // Generic error code
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match for subject '${subject}'. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}"`;
        errorCode = `GLBSA_E004_NOT_FOUND_SERVER`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required by PocketBase (Status: ${error.status}) to view lessons for '${subject}'. Ensure 'question_bank' View Rule is public or allows authenticated users. Original error: ${error.data?.message || 'No specific message.'}`;
        errorCode = `GLBSA_E005_PB_AUTH_OR_DENIED_SERVER`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch lessons for subject '${subject}'. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
        errorCode = `GLBSA_E006_PB_NET_ERR_SERVER`;
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
  
  // This action relies on PocketBase question_bank collection's View Rule being public ("").
  // No server-side authentication check is performed here.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie || !authCookie.value) {
      console.warn(`[${actionName}] No auth cookie found. Proceeding as unauthenticated.`);
  } else {
      pb.authStore.loadFromCookie(authCookie.value, true);
      try {
          console.log(`[${actionName}] Attempting authRefresh. Auth valid before: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
          await pb.collection('users').authRefresh();
          console.log(`[${actionName}] AuthRefresh successful. Auth valid after: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
      } catch (refreshError) {
          pb.authStore.clear();
          console.warn(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message, ". Proceeding as unauthenticated.");
      }
  }
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}. Current authStore valid: ${pb.authStore.isValid}`);

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
        questionImage: record.questionImage ? pb.getFileUrl(record, record.questionImage as string) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pb.getFileUrl(record, record.optionAImage as string) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pb.getFileUrl(record, record.optionBImage as string) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pb.getFileUrl(record, record.optionCImage as string) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pb.getFileUrl(record, record.optionDImage as string) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pb.getFileUrl(record, record.explanationImage as string) : undefined,
      };
    });

    console.log(`[${actionName}] Successfully fetched ${questions.length} questions for ${subject} - ${lessonName}`);
    return { success: true, questions, message: "Questions fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch questions for ${subject} - ${lessonName}.`;
    let errorCode = "GQBLA_E002_SERVER";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
       if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match for '${subject} - ${lessonName}'. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
        errorCode = `GQBLA_E004_NOT_FOUND_SERVER`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required by PocketBase (Status: ${error.status}) to view questions for '${subject} - ${lessonName}'. Ensure 'question_bank' View Rule is public or allows authenticated users. Original error: ${error.data?.message || 'No specific message.'}`;
        errorCode = `GQBLA_E005_PB_AUTH_OR_DENIED_SERVER`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch questions. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
        errorCode = `GQBLA_E006_PB_NET_ERR_SERVER`;
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
    console.log(`[${actionName}] Received payload:`, JSON.stringify(payload, null, 2));
    
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const authCookie = cookies().get('pb_auth');
    let currentUserId: string | null = payload.userId; // Use userId from payload initially

    console.log(`[${actionName}] Auth cookie from request headers: ${authCookie ? 'Exists' : 'Not Found'}`);
    console.log(`[${actionName}] Client-provided userId in payload: ${payload.userId}`);

    if (authCookie && authCookie.value) {
        pb.authStore.loadFromCookie(authCookie.value, true);
        console.log(`[${actionName}] Auth store loaded from cookie. AuthStore valid before refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
        try {
            await pb.collection('users').authRefresh();
            console.log(`[${actionName}] Auth refresh successful. AuthStore valid after refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
            if (pb.authStore.isValid && pb.authStore.model?.id) {
                currentUserId = pb.authStore.model.id; // Prioritize server-validated userId
                console.log(`[${actionName}] Server-validated userId from authStore: ${currentUserId}`);
            } else {
                 console.warn(`[${actionName}] Auth refresh done, but store is not valid or model ID is missing after refresh. AuthStore valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}. Will proceed with client-provided userId if available.`);
            }
        } catch (refreshError) {
            console.warn(`[${actionName}] Auth refresh failed. Error: ${refreshError.message}. Proceeding with client-provided userId if available.`);
            pb.authStore.clear(); 
        }
    } else {
         console.log(`[${actionName}] No auth cookie found. Proceeding with client-provided userId if available.`);
    }
    
    // If after all checks, currentUserId is still null (meaning no auth cookie and no client-provided ID, or client-provided ID was null)
    // And if your logic requires a userId to save an attempt, you might return an error here.
    // However, if dpp_attempts.userId is optional and Create Rule is public, we can proceed.
    // Your Create Rule is "", so unauthenticated (userId=null) creates are allowed.

    const dataToSaveOrUpdate = {
        userId: currentUserId, // This will be null if not authenticated and client didn't send one
        subject: payload.subject,
        lessonName: payload.lessonName,
        attemptDate: new Date().toISOString(),
        questionsAttempted: payload.questionsAttempted,
        score: payload.score,
        totalQuestions: payload.totalQuestions,
    };
    
    console.log(`[${actionName}] Data prepared for PocketBase (userId: ${dataToSaveOrUpdate.userId}):`, JSON.stringify(dataToSaveOrUpdate, null, 2));

    try {
        let existingAttempt = null;
        if (dataToSaveOrUpdate.userId) { // Only try to find/update if there's a userId
            const filter = `userId = "${dataToSaveOrUpdate.userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
            console.log(`[${actionName}] Checking for existing attempt for user ${dataToSaveOrUpdate.userId} with filter: ${filter}`);
            try {
                // Use the potentially authenticated 'pb' instance for find if user-specific rules apply.
                // If find rules are public, pbGlobal would also work.
                existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
                console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}) for user ${dataToSaveOrUpdate.userId}. Will update.`);
            } catch (findError) {
                if (findError instanceof ClientResponseError && findError.status === 404) {
                    console.log(`[${actionName}] No existing attempt found for user ${dataToSaveOrUpdate.userId}. Will create a new one.`);
                    existingAttempt = null;
                } else {
                    console.warn(`[${actionName}] Error finding existing attempt (not 404):`, findError.message, ". Will try to create new if allowed.");
                    existingAttempt = null; 
                }
            }
        } else {
            console.log(`[${actionName}] No userId available for save/update (anonymous attempt), will create a new attempt if Create Rule allows.`);
        }

        if (existingAttempt && dataToSaveOrUpdate.userId) {
            // For update, request needs to be authenticated AS THE USER if Update Rule is @request.auth.id = userId
            // The 'pb' instance here should be authenticated as the user from the cookie.
            console.log(`[${actionName}] Updating existing dpp_attempts record ID: ${existingAttempt.id}`);
            const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            // Create uses pbGlobal if no auth, or 'pb' if cookie was loaded (even if no auth, it's still an instance)
            // PocketBase "Create Rule" for dpp_attempts is "", so unauthenticated create is allowed.
            console.log(`[${actionName}] Creating new dpp_attempts record (userId: ${dataToSaveOrUpdate.userId}).`);
            const newRecord = await pbGlobal.collection('dpp_attempts').create(dataToSaveOrUpdate); // Use pbGlobal for create if it's truly public
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error) {
        console.error(`[${actionName}] Error during save/update DPP attempt:`, error);
        let errorMessage = "Failed to save DPP attempt.";
        let errorCode = "SDPPA_E004_SAVE_FAIL_SERVER";
        if (error instanceof ClientResponseError) {
          console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
          errorMessage = error.data?.message || errorMessage;
          errorCode = `SDPPA_PB_${error.status}_SERVER`;
          if (error.status === 403) { 
            errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. This usually means the Update Rule for dpp_attempts is preventing the operation (current Update Rule: "@request.auth.id != userId"). If trying to update own record, rule should be "@request.auth.id = userId". Error data: ${JSON.stringify(error.data)}`;
          } else if (error.status === 401) { 
            errorMessage = `Authentication Required by PocketBase (401) to save/update DPP attempt. This usually means the request was not authenticated, or the token is invalid, and a rule like "@request.auth.id == userId" is in place.`;
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
  details?: any;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to fetch live referral stats.`);
  
  try {
    const adminPb = await requirePocketBaseAdmin(); // This will throw if admin client fails to init/auth
    console.log(`[${actionName}] Admin client successfully obtained.`);
    
    const pbForCurrentUser = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const authCookie = cookies().get('pb_auth');
    let callingUserId: string | undefined;
    let callingUserReferralCode: string | undefined | null;

    if (authCookie && authCookie.value) {
      pbForCurrentUser.authStore.loadFromCookie(authCookie.value, true);
      try {
        await pbForCurrentUser.collection('users').authRefresh();
        if (pbForCurrentUser.authStore.isValid && pbForCurrentUser.authStore.model?.id) {
          callingUserId = pbForCurrentUser.authStore.model.id;
          callingUserReferralCode = pbForCurrentUser.authStore.model.referralCode;
          console.log(`[${actionName}] Calling user: ${callingUserId}, Referral Code: ${callingUserReferralCode}`);
        } else {
          console.warn(`[${actionName}] Calling user auth refresh completed, but store is not valid or model ID missing.`);
          return { success: false, message: "Current user session not valid. (GLRSA_E004_S)", error: "Invalid session" };
        }
      } catch (refreshError) {
        console.warn(`[${actionName}] Calling user auth refresh failed:`, refreshError);
        pbForCurrentUser.authStore.clear(); // Clear if refresh failed
        return { success: false, message: "Failed to validate current user session. (GLRSA_E003B_S)", error: "Session validation failed" };
      }
    } else {
      console.warn(`[${actionName}] No auth cookie found for calling user.`);
      return { success: false, message: "User not authenticated. (GLRSA_E003A_S)", error: "Not authenticated" };
    }

    if (!callingUserReferralCode) {
      console.log(`[${actionName}] Calling user ${callingUserId} does not have a referral code. Returning empty stats.`);
      return { success: true, stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 }, message: "User has no referral code." };
    }

    console.log(`[${actionName}] Fetching users referred by code: ${callingUserReferralCode} using admin client.`);
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${callingUserReferralCode}"`,
      fields: 'model',
    });
    console.log(`[${actionName}] Found ${referredUsers.length} users referred by ${callingUserReferralCode}.`);

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
      }
    });
    console.log(`[${actionName}] Calculated live stats:`, JSON.stringify(liveStats));
    return { success: true, stats: liveStats, message: "Live referral stats fetched successfully." };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during stats processing.";
    const errorCode = error instanceof Error && (error.message.includes("Admin client initialization") || error.message.includes("POCKETBASE_ADMIN_EMAIL"))
      ? "GLRSA_E001_ADMIN_AUTH_FAIL_S" 
      : (error instanceof ClientResponseError ? `GLRSA_PB_${error.status}_PROCESSING_S` : "GLRSA_E005_PROCESSING_S");
    
    console.error(`[${actionName}] Error in getLiveReferralStatsAction:`, error);
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMessage, error: errorCode, details: error.message || String(error) })}`);
    return { success: false, message: errorMessage, error: errorCode, details: error.message || String(error) };
  }
}

export async function getCollegeDetailsAction(
  input: CollegeDetailsInput
): Promise<{ success: boolean; details?: CollegeDetailsOutput; error?: string }> {
  const actionName = "Get College Details Action (AI)";
  console.log(`[${actionName}] Received request for college: ${input.collegeName}, District: ${input.collegeDistrict}`);
  try {
    // This Genkit flow call does not require user authentication in itself,
    // but the overall action should only be callable if user is authenticated
    // if this were a protected feature. For now, it's open.
    const details = await getCollegeDetails(input);
    console.log(`[${actionName}] Successfully fetched details from AI for ${input.collegeName}.`);
    return { success: true, details };
  } catch (error) {
    console.error(`[${actionName}] Error fetching college details from AI for ${input.collegeName}:`, error);
    let errorMessage = "Failed to get college details from AI.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
