
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
// Removed: import { getCollegeDetails } from '@/ai/flows/college-details-flow';
// Removed: import type { CollegeDetailsInput, CollegeDetailsOutput } from '@/ai/flows/college-details-flow';


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
      setReferralMessage(null); // Clear message on invalid code
      setReferralMessageIsError(false);
      return { success: false, message: "" }; // No error message for invalid code
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    setReferralMessage(null); // Clear message on error
    setReferralMessageIsError(false);
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
      avatar: null, // Avatar field added to PocketBase for users, can be null initially
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

  // Update referrer stats if a valid referral code was used
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
                    referred_free: (currentStats.referred_free || 0) + 1, // New users are 'Free'
                };
                await updateUserReferralStats(referrer.id, newStats, adminPb);
                console.log(`[${actionName}] Successfully updated referrer stats for ${referrer.id} using admin client. New stats:`, newStats);
            } else {
                 console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found using admin client. No stats updated.`);
            }
        } else {
             console.warn(`[${actionName}] Admin client (getPocketBaseAdmin) returned null for referrer stats update. Referrer stats update skipped. This usually means POCKETBASE_ADMIN_EMAIL/PASSWORD are not set or are invalid.`);
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
  userTargetYear?: string | null, // Changed to string to match localStorage
  userReferralCode?: string | null,
  userReferredByCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null, // Added for avatar
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
    const userFullName = user.name || 'User'; // From PB 'name' field
    const userName = userFullName; // Using full name as userName
    const avatarFilename = user.avatar as string | undefined; // PocketBase stores avatar as filename
    const avatarUrl = avatarFilename ? pb.getFileUrl(user, avatarFilename) : null;
    const userReferredByCode = user.referredByCode || null; // Fetch this field

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
      userTargetYear: user.targetYear?.toString() || null, // Convert number to string
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
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_NO_AUTH_COOKIE_SERVER");
  }
  pb.authStore.loadFromCookie(authCookie.value, true);

  try {
    await pb.collection('users').authRefresh();
  } catch (refreshError) {
    pb.authStore.clear();
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
    const updatedUserRecord = await pb.collection('users').update(authenticatedUserId, dataForPocketBase);
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
  const currentUserRecord = await findUserById(currentAuthUserId, pb);
  const currentUserReferredByCode = currentUserRecord?.referredByCode;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    return { referrerName: null }; // No error, just no referrer
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
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
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}.`);

  try {
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
        errorMessage = `Permission Denied by PocketBase (403) for avatar update. Ensure 'users' collection Update Rule allows self-update. Details: ${JSON.stringify(error.data)}`;
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
        errorMessage = `Permission Denied by PocketBase (403) for avatar removal. Ensure 'users' collection Update Rule allows self-update. Details: ${JSON.stringify(error.data)}`;
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

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie || !authCookie.value) {
    console.warn(`[${actionName}] No auth cookie found. Relying on public create rule for question_bank.`);
    // If create rule is public, this might still work, but we can't check user's role here.
  } else {
    pb.authStore.loadFromCookie(authCookie.value, true);
    try {
      console.log(`[${actionName}] Attempting authRefresh before adding question. Current auth valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
      await pb.collection('users').authRefresh();
      console.log(`[${actionName}] AuthRefresh successful. New auth valid: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}, Role: ${pb.authStore.model?.role}`);
    } catch (refreshError) {
      pb.authStore.clear();
      console.warn(`[${actionName}] Auth refresh failed during addQuestion:`, (refreshError as Error).message, ". Proceeding as unauthenticated for question_bank create.");
    }
  }

  // Server-side check (relying on PocketBase rules for final enforcement)
  // This check relies on the client-side layout ensuring only 'Admin' role users (from localStorage) can access the page.
  // The PocketBase collection rule `@request.auth.id != "" && @request.auth.role = "Admin"` is the ultimate gatekeeper.
  if (pb.authStore.isValid && pb.authStore.model?.role !== 'Admin') {
     console.warn(`[${actionName}] User ${pb.authStore.model.id} (Role: ${pb.authStore.model.role}) is authenticated but not an Admin. Question add will likely be denied by PocketBase rules unless CreateRule is public.`);
     // We still proceed, letting PocketBase deny if rules are strict.
  } else if (!pb.authStore.isValid) {
    console.warn(`[${actionName}] User is not authenticated in server action. Question add will likely be denied by PocketBase rules unless CreateRule is public.`);
  }

  console.log(`[${actionName}] Preparing to create question in PocketBase.`);

  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData); // Use pbGlobal for public create
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
        errorMessage = `Permission Denied by PocketBase (403): You do not have permission to create questions. Ensure your account has the 'Admin' role and the 'question_bank' Create Rule is correctly set (e.g., '@request.auth.id != "" && @request.auth.role = "Admin"'). Details: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) {
         errorMessage = `Authentication Required by PocketBase (401). This indicates an issue with the auth token or the action wasn't called by an authenticated user with proper role.`;
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
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');
  let cookieFound = false;

  if (authCookie && authCookie.value) {
    cookieFound = true;
    console.log(`[${actionName}] Auth cookie found. Attempting to load and refresh.`);
    pb.authStore.loadFromCookie(authCookie.value, true);
    try {
      await pb.collection('users').authRefresh(); // This validates the token and populates authStore.model
      if (!pb.authStore.isValid) {
        console.warn(`[${actionName}] Auth refresh completed, but store is not valid. Model ID: ${pb.authStore.model?.id}`);
        return createErrorResponse("User not authenticated after refresh. Please log in.", "GLBSA_AUTH_REFRESH_INVALID_SERVER");
      }
      console.log(`[${actionName}] Auth refresh successful. User ID: ${pb.authStore.model?.id}. Proceeding to fetch lessons.`);
    } catch (refreshError) {
      console.warn(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
      pb.authStore.clear();
      return createErrorResponse("Session invalid or expired. Please log in. (GLBSA_AUTH_REFRESH_FAIL_SERVER)", "GLBSA_AUTH_REFRESH_FAIL_SERVER", (refreshError as Error).message);
    }
  } else {
    console.warn(`[${actionName}] No auth cookie found.`);
    // Since question_bank viewRule is @request.auth.id != "", PocketBase will deny unauthenticated requests.
    // This action must be called by an authenticated user.
    return createErrorResponse("User not authenticated. Please log in to view lessons. (GLBSA_NO_AUTH_COOKIE_SERVER)", "GLBSA_NO_AUTH_COOKIE_SERVER");
  }

  try {
    // Use the request-scoped, authenticated pb instance
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName',
    });
    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));
    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };
  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_SERVER`;
    let errorDetails = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match for subject '${subject}'. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}"`;
        errorCode = `GLBSA_E004_NOT_FOUND_SERVER`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required by PocketBase (Status: ${error.status}) to view lessons. Ensure you are logged in and the 'question_bank' View Rule (@request.auth.id != "") is met. Cookie found: ${cookieFound}. Auth valid after refresh: ${pb.authStore.isValid}. User ID from token: ${pb.authStore.model?.id}. Original error: ${error.data?.message || 'No specific message.'}`;
        errorCode = `GLBSA_E005_PB_AUTH_OR_DENIED_SERVER`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch lessons. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
        errorCode = `GLBSA_E006_PB_NET_ERR_SERVER`;
      } else {
        errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
      }
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const authCookie = cookies().get('pb_auth');
  let cookieFound = false;

  if (authCookie && authCookie.value) {
    cookieFound = true;
    console.log(`[${actionName}] Auth cookie found. Attempting to load and refresh.`);
    pb.authStore.loadFromCookie(authCookie.value, true);
    try {
      await pb.collection('users').authRefresh();
      if (!pb.authStore.isValid) {
        console.warn(`[${actionName}] Auth refresh completed, but store is not valid. Model ID: ${pb.authStore.model?.id}`);
        return createErrorResponse("User not authenticated after refresh. Please log in to view questions.", "GQBLA_AUTH_REFRESH_INVALID_SERVER");
      }
      console.log(`[${actionName}] Auth refresh successful. User ID: ${pb.authStore.model?.id}. Proceeding to fetch questions.`);
    } catch (refreshError) {
      console.warn(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
      pb.authStore.clear();
      return createErrorResponse("Session invalid or expired. Please log in to view questions. (GQBLA_AUTH_REFRESH_FAIL_SERVER)", "GQBLA_AUTH_REFRESH_FAIL_SERVER", (refreshError as Error).message);
    }
  } else {
    console.warn(`[${actionName}] No auth cookie found.`);
    // PocketBase 'question_bank' View Rule is @request.auth.id != ""
    return createErrorResponse("User not authenticated. Please log in to view questions. (GQBLA_NO_AUTH_COOKIE_SERVER)", "GQBLA_NO_AUTH_COOKIE_SERVER");
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
        errorMessage = `Collection 'question_bank' not found or no records match. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
        errorCode = `GQBLA_E004_NOT_FOUND_SERVER`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required by PocketBase (Status: ${error.status}) to view questions. Ensure you are logged in and the 'question_bank' View Rule (@request.auth.id != "") is met. Cookie found: ${cookieFound}. Auth valid after refresh: ${pb.authStore.isValid}. User ID from token: ${pb.authStore.model?.id}. Original error: ${error.data?.message || 'No specific message.'}`;
        errorCode = `GQBLA_E005_PB_AUTH_OR_DENIED_SERVER`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch questions. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
        errorCode = `GQBLA_E006_PB_NET_ERR_SERVER`;
      } else {
         errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      }
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
    const actionName = "Save DPP Attempt Action";
    console.log(`[${actionName}] Received payload:`, JSON.stringify(payload, null, 2));

    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const authCookie = cookies().get('pb_auth');

    console.log(`[${actionName}] Auth cookie from request headers: ${authCookie ? authCookie.value.substring(0, 20) + '...' : 'Not Found'}`); // Log truncated cookie

    if (authCookie && authCookie.value) {
        console.log(`[${actionName}] Auth cookie found. Attempting to load and refresh.`);
        pb.authStore.loadFromCookie(authCookie.value, true);
        console.log(`[${actionName}] Auth store loaded from cookie. AuthStore valid before refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
        try {
            await pb.collection('users').authRefresh(); // This validates the token and populates authStore.model
            console.log(`[${actionName}] Auth refresh successful. AuthStore valid after refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
        } catch (refreshError: any) {
            console.warn(`[${actionName}] Auth refresh failed. Error: ${refreshError?.message || String(refreshError)}. Details: ${JSON.stringify(refreshError)}`);
            pb.authStore.clear();
            // For public dpp_attempts create rule, we might allow anonymous saves or rely on payload.userId
            // However, if the intent is to associate with a logged-in user, this is a failure point.
            // The current createRule for dpp_attempts is "", meaning public create is allowed.
        }
    } else {
         console.log(`[${actionName}] No auth cookie found. Proceeding with payload.userId if available, or as anonymous attempt if collection rule allows.`);
    }

    // Determine userId for the record
    // If user is authenticated on server, use that ID. Otherwise, use ID from payload (which client sets if logged in).
    // If neither, userId will be null, for anonymous attempt (if allowed by PB rules).
    const recordUserId = (pb.authStore.isValid && pb.authStore.model?.id) ? pb.authStore.model.id : payload.userId;
    console.log(`[${actionName}] Determined recordUserId for dpp_attempt: ${recordUserId}`);


    const dataToSaveOrUpdate = {
        userId: recordUserId,
        subject: payload.subject,
        lessonName: payload.lessonName,
        attemptDate: new Date().toISOString(),
        questionsAttempted: payload.questionsAttempted,
        score: payload.score,
        totalQuestions: payload.totalQuestions,
    };

    console.log(`[${actionName}] Data prepared for PocketBase:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

    try {
        let existingAttempt = null;
        if (dataToSaveOrUpdate.userId) { // Only try to find/update if there's a userId
            const filter = `userId = "${dataToSaveOrUpdate.userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
            console.log(`[${actionName}] Checking for existing attempt for user ${dataToSaveOrUpdate.userId} with filter: ${filter}`);
            try {
                // Use the 'pb' instance (which is now request-scoped and potentially authenticated)
                existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
                console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}) for user ${dataToSaveOrUpdate.userId}. Will update.`);
            } catch (findError: any) {
                if (findError instanceof ClientResponseError && findError.status === 404) {
                    console.log(`[${actionName}] No existing attempt found for user ${dataToSaveOrUpdate.userId}. Will create a new one.`);
                    existingAttempt = null;
                } else {
                    console.warn(`[${actionName}] Error finding existing attempt (not 404):`, findError?.message || String(findError), ". Will try to create new if allowed.");
                    existingAttempt = null;
                }
            }
        } else {
            console.log(`[${actionName}] No userId available for save/update (anonymous attempt), will create a new attempt as collection rule is public.`);
        }

        if (existingAttempt && dataToSaveOrUpdate.userId) {
            // For update, request needs to be authenticated AS THE USER if Update Rule is @request.auth.id = userId
            // The 'pb' instance here should be authenticated as the user from the cookie.
            console.log(`[${actionName}] Updating existing dpp_attempts record ID: ${existingAttempt.id}`);
            const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            // Create uses pb (request-scoped, potentially unauth if cookie was bad/missing, but dpp_attempts createRule is public)
            console.log(`[${actionName}] Creating new dpp_attempts record (userId: ${dataToSaveOrUpdate.userId}).`);
            const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error: any) {
        console.error(`[${actionName}] Error during save/update DPP attempt:`, error);
        let errorMessage = "Failed to save DPP attempt.";
        let errorCode = "SDPPA_E004_SAVE_FAIL_SERVER";
        let errorDetails = JSON.stringify(error?.data || error?.response || error);

        if (error instanceof ClientResponseError) {
          console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
          errorMessage = error.data?.message || errorMessage;
          errorCode = `SDPPA_PB_${error.status}_SERVER`;
          if (error.status === 403) {
            errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. This usually means the Create/Update Rule for dpp_attempts is preventing the operation. Current Create Rule: "". Current Update Rule: "@request.auth.id != userId" (Update this rule to "@request.auth.id == userId" if users should update their own attempts). Error data: ${JSON.stringify(error.data)}`;
          } else if (error.status === 401) {
            errorMessage = `Authentication Required by PocketBase (401) to save/update DPP attempt. This usually means the request was not authenticated, or the token is invalid, and a rule like "@request.auth.id == userId" is in place for an operation that needs user-specific auth.`;
          } else if (error.status === 0) {
             errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
          } else if (error.data?.data){
            const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
            errorMessage = `Validation errors from server: ${fieldErrors}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        return createErrorResponse(errorMessage, errorCode, errorDetails);
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
  let adminPb: PocketBase | null = null;

  try {
    adminPb = await requirePocketBaseAdmin(); // This will throw if admin client fails to init/auth
    console.log(`[${actionName}] Admin client successfully obtained for getLiveReferralStatsAction.`);

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
          return { success: false, message: "Current user session not valid. (GLRSA_E004_S)", error: "Invalid session (GLRSA_E004_S)" };
        }
      } catch (refreshError: any) {
        console.warn(`[${actionName}] Calling user auth refresh failed:`, refreshError?.message || String(refreshError));
        pbForCurrentUser.authStore.clear(); // Clear if refresh failed
        return { success: false, message: "Failed to validate current user session. (GLRSA_E003B_S)", error: "Session validation failed (GLRSA_E003B_S)" };
      }
    } else {
      console.warn(`[${actionName}] No auth cookie found for calling user.`);
      return { success: false, message: "User not authenticated. (GLRSA_E003A_S)", error: "Not authenticated (GLRSA_E003A_S)" };
    }

    if (!callingUserReferralCode) {
      console.log(`[${actionName}] Calling user ${callingUserId} does not have a referral code. Returning empty stats.`);
      return { success: true, stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 }, message: "User has no referral code." };
    }

    console.log(`[${actionName}] Fetching users referred by code: ${callingUserReferralCode} using admin client.`);
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${callingUserReferralCode}"`,
      fields: 'model', // Only fetch the 'model' field
    });
    console.log(`[${actionName}] Found ${referredUsers.length} users referred by ${callingUserReferralCode}.`);

    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
      referred_dpp: 0, // Initialize dpp counter
    };

    referredUsers.forEach(user => {
      switch (user.model as UserModel) { // Cast to UserModel for type safety
        case 'Free': liveStats.referred_free = (liveStats.referred_free || 0) + 1; break;
        case 'Chapterwise': liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1; break;
        case 'Full_length': liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1; break;
        case 'Combo': liveStats.referred_combo = (liveStats.referred_combo || 0) + 1; break;
        case 'Dpp': liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1; break;
      }
    });
    console.log(`[${actionName}] Calculated live stats:`, JSON.stringify(liveStats));
    const finalResponse = { success: true, stats: liveStats, message: "Live referral stats fetched successfully." };
    console.log(`[${actionName}] Returning success: ${JSON.stringify(finalResponse)}`);
    return finalResponse;

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during stats processing.";
    const errorCode = error instanceof Error && (error.message.includes("Admin client initialization") || error.message.includes("POCKETBASE_ADMIN_EMAIL"))
      ? "GLRSA_E001_ADMIN_AUTH_FAIL_S"
      : (error instanceof ClientResponseError ? `GLRSA_PB_${error.status}_PROCESSING_S` : "GLRSA_E005_PROCESSING_S");

    console.error(`[${actionName}] Error in getLiveReferralStatsAction:`, error);
    const errorResponse = { success: false, message: errorMessage, error: errorCode, details: error.message || String(error) };
    console.log(`[${actionName}] Returning error: ${JSON.stringify(errorResponse)}`);
    return errorResponse;
  }
}

// Removed: export async function getCollegeDetailsAction(...)
