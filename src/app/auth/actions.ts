
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
      return { success: false, message: "" }; // No error message for invalid code
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // No error message
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
      avatar: null, // PocketBase handles avatar filenames, not URLs here
      emailVisibility: true,
      verified: false, // Email verification can be handled by PocketBase
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Use global pb instance for creating user as per simplified admin panel
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
        const adminPb = null; // No longer attempting admin auth for this by default
        // const adminPb = await getPocketBaseAdmin(); // Old logic
        if (adminPb) { // This block will likely not run if adminPb is null
            const referrer = await findUserByReferralCode(upperCaseReferredByCode, adminPb);
            if (referrer) {
                console.log(`[${actionName}] Found referrer ${referrer.id}. Current stats:`, referrer.referralStats);
                const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
                const newStats = {
                    ...currentStats,
                    referred_free: (currentStats.referred_free || 0) + 1,
                };
                await updateUserReferralStats(referrer.id, newStats, adminPb);
                console.log(`[${actionName}] Successfully updated referrer stats for ${referrer.id} using admin client. Stats:`, newStats);
            } else {
                 console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found. No stats updated.`);
            }
        } else {
            console.warn(`[${actionName}] Admin client not available. Skipping referrer stats update for ${upperCaseReferredByCode}. This is expected if POCKETBASE_ADMIN_EMAIL/PASSWORD are not set or admin auth failed.`);
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
  userRecordFromPb?: any, // This is the PocketBase RecordModel
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL); // Create new instance for this request

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
      userRecordFromPb: authData.record, // Send the full PocketBase record
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
  userId, // userId is now passed directly
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string, // Expect userId to be passed
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  let pb: PocketBase;

  console.log(`[${actionName}] Initializing PocketBase client for profile update.`);
  const authCookie = cookies().get('pb_auth');

  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_NO_AUTH_COOKIE");
  }

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  pb.authStore.loadFromCookie(authCookie.value, true); // true to verify the cookie

  try {
    console.log(`[${actionName}] Attempting authRefresh. Current store valid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] authRefresh successful. New store valid: ${pb.authStore.isValid}, model ID: ${pb.authStore.model?.id}`);
  } catch (refreshError) {
    pb.authStore.clear();
    console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
    if (refreshError instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh:`, JSON.stringify(refreshError.data));
    }
    return createErrorResponse("Session invalid or expired. Please log in again.", "UPA_AUTH_REFRESH_FAIL");
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id || pb.authStore.model.id !== userId) {
    console.log(`[${actionName}] User session not valid, model ID mismatch, or not the correct user. Auth ID: ${pb.authStore.model?.id}, Provided UserID: ${userId}`);
    return createErrorResponse("User session not valid or action not permitted for this user.", "UPA_SESSION_INVALID_OR_MISMATCH");
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
  let pb: PocketBase;

  const authCookie = cookies().get('pb_auth');
  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return { referrerName: null, error: "User not authenticated. (No auth cookie - GRICA_NO_AUTH_COOKIE_SERVER)" };
  }

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  pb.authStore.loadFromCookie(authCookie.value, true);

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
  const currentUserRecord = await findUserById(currentAuthUserId, pb); // Use authenticated pb
  const currentUserReferredByCode = currentUserRecord?.referredByCode;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // Use authenticated pb instance to find referrer as well, though public find should work if rules allow
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
  let pb: PocketBase;

  const authCookie = cookies().get('pb_auth');
  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_NO_AUTH_COOKIE");
  }

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  pb.authStore.loadFromCookie(authCookie.value, true);

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
  let pb: PocketBase;

  const authCookie = cookies().get('pb_auth');
  if (!authCookie?.value) {
    console.log(`[${actionName}] No auth cookie found.`);
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_NO_AUTH_COOKIE");
  }

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  pb.authStore.loadFromCookie(authCookie.value, true);

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
        errorMessage = `Permission Denied by PocketBase (403) for avatar removal. Ensure 'users' collection Update Rule allows self-update (e.g. '@request.auth.id = id'). Details: ${JSON.stringify(error.data)}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}


export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action (Simplified - Public Create Rule)";
  console.log(`[${actionName}] Attempting to add question. FormData keys:`, Array.from(formData.keys()));
  
  // Directly use pbGlobal, relying on client-side role check and PocketBase's public "Create Rule"
  // No server-side authStore check needed for this simplified approach
  console.log(`[${actionName}] Using global PocketBase instance. Relies on public 'question_bank' Create Rule.`);

  try {
    // Log the data being sent to PocketBase for easier debugging
    const dataToLog = {};
    for (const [key, value] of formData.entries()) {
      dataToLog[key] = value instanceof File ? `File: ${value.name}` : value;
    }
    console.log(`[${actionName}] Data being sent to PocketBase:`, JSON.stringify(dataToLog, null, 2));

    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };
  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_E003_CREATE_FAIL_SERVER_PUBLIC";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));
      detailedFieldErrors = error.data?.data ? JSON.stringify(error.data.data) : "";

      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403): This is unexpected if Create Rule is public. Check PocketBase 'question_bank' Create Rule. Details: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) {
         errorMessage = `Authentication Required by PocketBase (401). This is unexpected if Create Rule is public.`;
      } else if (detailedFieldErrors && detailedFieldErrors !== '{}') {
        let fieldErrorMessages = "Validation errors: ";
        try {
            const fieldErrorsObj = JSON.parse(detailedFieldErrors);
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
  const actionName = "Get Lessons By Subject Action (Public Read)";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);
  console.log(`[${actionName}] Using global PocketBase instance with baseUrl: ${pbGlobal.baseUrl}. Relies on public 'question_bank' List/Search rule.`);

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
    let errorCode = `GLBSA_E003_FETCH_FAIL_SERVER_PUBLIC`; // Changed error code
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match filter for subject '${subject}'. Check PocketBase URL (${pbGlobal.baseUrl}) and collection name. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view lessons for '${subject}'. This is unexpected with public rules. Check PocketBase 'question_bank' List/Search rule. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pbGlobal.baseUrl}) to fetch lessons for subject '${subject}'. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
        errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action (Public Read)";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  console.log(`[${actionName}] Using global PocketBase instance with baseUrl: ${pbGlobal.baseUrl}. Relies on public 'question_bank' View rule.`);

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
        questionImage: record.questionImage ? pbGlobal.getFileUrl(record, record.questionImage as string) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pbGlobal.getFileUrl(record, record.optionAImage as string) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pbGlobal.getFileUrl(record, record.optionBImage as string) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pbGlobal.getFileUrl(record, record.optionCImage as string) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pbGlobal.getFileUrl(record, record.optionDImage as string) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pbGlobal.getFileUrl(record, record.explanationImage as string) : undefined,
      };
    });

    console.log(`[${actionName}] Successfully fetched ${questions.length} questions for ${subject} - ${lessonName}`);
    return { success: true, questions, message: "Questions fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch questions for ${subject} - ${lessonName}.`;
    let errorCode = "GQBLA_E002_FETCH_FAIL_SERVER_PUBLIC"; // Changed error code
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
       if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match for '${subject} - ${lessonName}'. Check PocketBase URL (${pbGlobal.baseUrl}) and collection name. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view questions for '${subject} - ${lessonName}'. This is unexpected with public rules. Check PocketBase 'question_bank' View rule. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pbGlobal.baseUrl}) to fetch questions. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
         errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
    const actionName = "Save DPP Attempt Action (Public Create/Update)";
    console.log(`[${actionName}] Received payload for user: ${payload.userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName}`);
    
    // Use global pbGlobal instance, as dpp_attempts Create/Update rules are public ("").
    // Relies on payload.userId being correctly sent from client.
    const pb = pbGlobal; 
    const userIdForRecord = payload.userId || null; // Allow null for anonymous if client sends null
    
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
        if (userIdForRecord) { 
            const filter = `userId = "${userIdForRecord}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
            console.log(`[${actionName}] Checking for existing attempt for user ${userIdForRecord} with filter: ${filter} using global pb`);
            try {
                existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
                console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}) for user ${userIdForRecord}. Will update.`);
            } catch (findError) {
                if (findError instanceof ClientResponseError && findError.status === 404) {
                    console.log(`[${actionName}] No existing attempt found for user ${userIdForRecord}. Will create a new one.`);
                    existingAttempt = null;
                } else {
                    console.error(`[${actionName}] Error finding existing attempt (not 404):`, findError);
                    throw findError; 
                }
            }
        } else {
            console.log(`[${actionName}] No userId provided (anonymous attempt), will create a new attempt.`);
        }

        if (existingAttempt && userIdForRecord) {
            console.log(`[${actionName}] Updating existing dpp_attempts record ID: ${existingAttempt.id} using global pb.`);
            const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            console.log(`[${actionName}] Creating new dpp_attempts record using global pb.`);
            const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error) {
        console.error(`[${actionName}] Error during save/update DPP attempt:`, error);
        let errorMessage = "Failed to save DPP attempt.";
        let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER_PUBLIC";
        if (error instanceof ClientResponseError) {
          console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
          errorMessage = error.data?.message || errorMessage;
          errorCode = `SDPPA_PB_${error.status}_PUBLIC`;
          if (error.status === 403) {
            errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. This is unexpected with public rules. Check PocketBase rules for 'dpp_attempts'. Error data: ${JSON.stringify(error.data)}`;
          } else if (error.status === 401) {
            errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. This is unexpected with public rules.`;
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
  let callingUserPb: PocketBase;
  let callingUserId: string | undefined;
  let callingUserReferralCode: string | undefined | null;

  try {
    // This admin client will be used to list all users referred by the calling user's code.
    // If admin credentials are not set, this specific part will fail.
    // adminPb = await getPocketBaseAdmin(); 
    // Re-evaluating the need for adminPb here. If we only need calling user's referrals, we don't need to list ALL users.
    // Let's assume we only need the stats for the calling user's referrals.
    // The `signupUserAction` handles updating the referrer's stats directly on the referrer's record.
    // This action might be better reframed as "get current user's referral stats" from their own record.
    // For now, keeping the logic but adminPb might be null if admin auth fails.

    callingUserPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const authCookie = cookies().get('pb_auth');
    if (!authCookie?.value) {
        console.log(`[${actionName}] No auth cookie found for calling user.`);
        return { success: false, message: "User not authenticated. Please log in to view referral stats. (GLRSA_E003)", error: "User not authenticated (no cookie). (GLRSA_E003_S)" };
    }
    callingUserPb.authStore.loadFromCookie(authCookie.value, true);
    await callingUserPb.collection('users').authRefresh();

    if (!callingUserPb.authStore.isValid || !callingUserPb.authStore.model?.id) {
      console.log(`[${actionName}] Calling user session not valid after authRefresh.`);
      return { success: false, message: "Your session is invalid. Please log in again. (GLRSA_E004)", error: "Calling user session invalid. (GLRSA_E004_S)" };
    }
    callingUserId = callingUserPb.authStore.model.id;
    callingUserReferralCode = callingUserPb.authStore.model.referralCode; // This is the user's own referral code
    
    // The stats we display should be the ones on the user's own record
    const userRecord = callingUserPb.authStore.model as unknown as User;
    const userStats = userRecord.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
    console.log(`[${actionName}] Fetched referral stats directly from calling user's record (${callingUserId}):`, JSON.stringify(userStats));
    return { success: true, stats: userStats, message: "Referral stats fetched successfully from your record." };


  } catch (error) {
    console.error(`[${actionName}] Error during live referral stats processing:`, error);
    let errorMessage = "Failed to process referral stats.";
    let errorCode = "GLRSA_E005_PROCESSING";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || `PocketBase error (${error.status}) during stats processing.`;
        errorCode = `GLRSA_PB_${error.status}_PROCESSING`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    console.log(`[${actionName}] Returning error from main catch:`, JSON.stringify({ success: false, message: errorMessage, error: errorCode }));
    return createErrorResponse(errorMessage, errorCode, JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
}
