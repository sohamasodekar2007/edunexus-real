
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { format } from 'date-fns';
import { requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      setReferralMessage(null);
      setReferralMessageIsError(false);
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error('[Validate Referral Code Action] Error validating referral code:', error);
    setReferralMessage(null);
    setReferralMessageIsError(false);
    return { success: false, message: "" };
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
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
      },
      targetYear: null,
      avatar: null,
      emailVisibility: true,
      verified: false,
    };

    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log("[Signup Action] User created successfully:", newUser.id);

  } catch (error) {
    console.error('[Signup Action Error] User Creation Failed:', error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
        console.error('[Signup Action Error] PocketBase ClientResponseError (User Creation) details (error.data):', JSON.stringify(error.data, null, 2));
        genericMessage = error.data?.message || genericMessage;
        const pbFieldErrors = error.data?.data;
        if (pbFieldErrors && typeof pbFieldErrors === 'object') {
            specificDetails = Object.keys(pbFieldErrors).map(key => {
                if (pbFieldErrors[key] && pbFieldErrors[key].message) {
                    return `${key}: ${pbFieldErrors[key].message}`;
                }
                return null;
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
      if (genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.') {
        finalErrorMessage = `${genericMessage}. Details: ${specificDetails}`;
      } else {
        finalErrorMessage = specificDetails;
      }
    }
     if (!finalErrorMessage || !finalErrorMessage.trim()) {
        finalErrorMessage = 'An unknown error occurred during signup.';
    }
    return { success: false, message: `Signup failed: ${finalErrorMessage}`, error: finalErrorMessage };
  }

  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    let adminPbForReferrerUpdate;
    try {
      adminPbForReferrerUpdate = await requirePocketBaseAdmin(); // Use require to ensure admin client is available
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPbForReferrerUpdate);
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          referred_free: (currentStats.referred_free || 0) + 1, // New users are 'Free'
          referred_chapterwise: (currentStats.referred_chapterwise || 0),
          referred_full_length: (currentStats.referred_full_length || 0),
          referred_combo: (currentStats.referred_combo || 0),
        };

        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPbForReferrerUpdate);
        console.log(`[Signup Action] Successfully updated referral stats for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
      } else {
        console.warn(`[Signup Action] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated.`);
      }
    } catch (statsError) {
      console.warn(`[Signup Action Warning] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. This typically means admin credentials in .env are missing or invalid, or the PocketBase server is unreachable for admin operations. Error:`, statsError.message);
      // Do not let this error block the main signup success message
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
  userTargetYear?: number | string | null,
  userReferralCode?: string | null,
  userReferredByCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User';
    const avatarFilename = user.avatar;
    const avatarUrl = avatarFilename ? pbGlobal.getFileUrl(user, avatarFilename as string) : null;

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
      userTargetYear: user.targetYear || null,
      userReferralCode: user.referralCode || null,
      userReferredByCode: user.referredByCode || null,
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error('[Login Action Error]:', error);
    let errorMessage = 'Login Failed: Invalid email or password.';
     if (error instanceof ClientResponseError) {
        console.error('[Login Action Error] PocketBase ClientResponseError details:', JSON.stringify(error.data));
        if (error.status === 400) {
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) {
          errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
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
  console.log(`[Update Profile Action] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  if (!userId) {
    return { success: false, message: "User ID is required for profile update.", error: "User ID missing (UPA_E001)" };
  }

  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};

  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }

  if (targetYearToUpdate !== undefined) {
    if (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '') {
      dataForPocketBase.targetYear = null;
    } else {
      const year = parseInt(targetYearToUpdate, 10);
      dataForPocketBase.targetYear = !isNaN(year) ? year : null;
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." };
  }

  console.log(`[Update Profile Action] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    let pbInstance = pbGlobal; // Default to global instance
    // Check if user is trying to update their own record, if so pbGlobal (with client's auth) should work
    // if PocketBase `users` collection Update Rule is `@request.auth.id = id`
    if (pbGlobal.authStore.model && pbGlobal.authStore.model.id === userId) {
        console.log("[Update Profile Action] User is updating their own record. Using client's auth context.");
    } else {
        // This case should ideally not happen if client-side logic only allows users to update their own profile.
        // If an admin needs to update any user, requirePocketBaseAdmin would be appropriate here,
        // but per user's request, we are avoiding admin auth for this.
        // This might fail if the user isn't authenticated as the one being updated.
        console.warn(`[Update Profile Action] Attempting to update profile for user ${userId} potentially without their specific auth context. Update rule @request.auth.id = id might block this unless called by the user themselves.`);
    }
    
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbInstance);
    console.log(`[Update Profile Action] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile (UPA_E002).";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this profile. Ensure your PocketBase 'users' collection updateRule is '@request.auth.id = id' and the action is called with the user's auth context (UPA_E003).";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not update profile (UPA_E004).";
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const currentAuthUser = pbGlobal.authStore.model;
  if (!currentAuthUser || !currentAuthUser.id) {
    console.warn("[Get Referrer Info Action] No authenticated user found in pbGlobal.authStore for server action.");
    return { referrerName: null, error: "User not authenticated or user context not available to server action (GRIA_E001)." };
  }

  let currentUserRecord;
  try {
    currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal); 
  } catch (e) {
     console.error("[Get Referrer Info Action] Error fetching current user's record:", e);
     return { referrerName: null, error: "Could not fetch current user details (GRIA_E002)." };
  }

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    return { referrerName: null };
  }

  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
    if (referrer && referrer.name) {
      return { referrerName: referrer.name };
    } else {
      console.warn(`[Get Referrer Info Action] Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing.`);
      return { referrerName: null, error: "Referrer not found or name missing (GRIA_E003)." };
    }
  } catch (error) {
    console.error(`[Get Referrer Info Action] Error fetching referrer by code ${currentUserRecord.referredByCode}:`, error);
    return { referrerName: null, error: "Error fetching referrer details (GRIA_E004)." };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (UAA_E001).";
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId} using user's auth context.`);

  try {
    // Relies on PocketBase 'users' collection updateRule like "@request.auth.id = id"
    // and pbGlobal carrying the client's auth token when invoked by an authenticated client.
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[Update Avatar Action] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar (UAA_E002).";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this avatar. Ensure PocketBase 'users' updateRule is '@request.auth.id = id' (UAA_E003).";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not update avatar (UAA_E004).";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (RAA_E001).";
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId} using user's auth context.`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[Remove Avatar Action] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar (RAA_E002).";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to remove this avatar. Ensure PocketBase 'users' updateRule is '@request.auth.id = id' (RAA_E003).";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not remove avatar (RAA_E004).";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  console.log("[Add Question Action] Attempting to add question.");
  console.log("[Add Question Action] Received form data keys:", Array.from(formData.keys()));

  // This action now relies on the client-side guard in admin-panel/layout.tsx ensuring only 'Admin' role users
  // can access the page, and then PocketBase collection rule will do the final authorization.
  // PocketBase 'question_bank' Create Rule should be: @request.auth.id != "" && @request.auth.role = "Admin"
  
  // We are not using super-admin for this. Instead, we rely on the calling user being authenticated
  // and having the 'Admin' role, which PocketBase will verify against the collection's Create Rule.
  // The pbGlobal instance, when a server action is invoked by an authenticated client,
  // should carry the client's auth token.

  if (!pbGlobal.authStore.isValid) {
    const authErrorMsg = "User is not authenticated. Cannot add question. (AQA_E001)";
    console.warn("[Add Question Action]", authErrorMsg);
    return { success: false, message: authErrorMsg, error: "Authentication Required" };
  }

  if (pbGlobal.authStore.model?.role !== 'Admin') {
    const roleErrorMsg = "User is not an Admin. Cannot add question. (AQA_E002)";
    console.warn("[Add Question Action]", roleErrorMsg, "User role:", pbGlobal.authStore.model?.role);
    return { success: false, message: roleErrorMsg, error: "Permission Denied" };
  }

  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log("[Add Question Action] Question added successfully to PocketBase:", newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error("[Add Question Action] Error adding question to PocketBase:", error);
    let errorMessage = "Failed to add question (AQA_E003).";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error("[Add Question Action] PocketBase ClientResponseError details:", JSON.stringify(error.data, null, 2));

      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) { // Forbidden
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure your account has the 'Admin' role and PocketBase 'question_bank' collection Create Rule is '@request.auth.id != \"\" && @request.auth.role = \"Admin\"' (AQA_E004).";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors} (AQA_E005)`;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
         errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status (AQA_E006).";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status}) (AQA_E007)`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: "PocketBase operation failed. See server logs for detailed error data and client toast for specifics." };
  }
}

export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  console.log('[Get Live Referral Stats Action] Attempting to fetch live referral stats.');
  const errorResponseBase = { success: false, stats: undefined };
  let adminPb;

  try {
    adminPb = await requirePocketBaseAdmin();
  } catch (initError) {
    const errMessage = (initError instanceof Error && initError.message) ? initError.message : "Admin client initialization failed (GLRSA_E001).";
    console.error('[Get Live Referral Stats Action] Admin client initialization error:', initError);
    const returnError = { ...errorResponseBase, message: errMessage, error: errMessage };
    console.log('[Get Live Referral Stats Action] Returning error (admin auth init):', JSON.stringify(returnError));
    return returnError;
  }

  const currentAuthUser = pbGlobal.authStore.model;
  if (!currentAuthUser || !currentAuthUser.id || !currentAuthUser.referralCode) {
    const noUserMsg = "User not authenticated or no referral code available for current user context (GLRSA_E002).";
    console.warn("[Get Live Referral Stats Action]", noUserMsg);
    const returnError = { ...errorResponseBase, message: noUserMsg, error: noUserMsg };
    console.log('[Get Live Referral Stats Action] Returning error (no user/code):', JSON.stringify(returnError));
    return returnError;
  }

  const currentUserReferralCode = currentAuthUser.referralCode;
  console.log(`[Get Live Referral Stats Action] Current user's referral code: ${currentUserReferralCode}`);

  try {
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${currentUserReferralCode}"`,
    });

    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
    };

    referredUsers.forEach(user => {
      switch (user.model) {
        case 'Free':
          liveStats.referred_free = (liveStats.referred_free || 0) + 1;
          break;
        case 'Chapterwise':
          liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1;
          break;
        case 'Full_length':
          liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1;
          break;
        case 'Combo':
          liveStats.referred_combo = (liveStats.referred_combo || 0) + 1;
          break;
        default:
          // Optionally handle or log users with unexpected models
          break;
      }
    });
    console.log('[Get Live Referral Stats Action] Successfully calculated stats:', liveStats);
    return { success: true, stats: liveStats, message: "Stats fetched successfully." };

  } catch (error) {
    console.error("[Get Live Referral Stats Action] Error fetching or calculating stats (after admin auth):", error);
    let errMessage = "Failed to calculate live referral stats (GLRSA_E003).";
    if (error instanceof ClientResponseError) {
      errMessage = error.data?.message || `PocketBase error: ${error.status} (GLRSA_E004).`;
    } else if (error instanceof Error && error.message) {
      errMessage = error.message;
    }
    const returnError = { ...errorResponseBase, message: errMessage, error: errMessage };
    console.log('[Get Live Referral Stats Action] Returning error (stats calculation):', JSON.stringify(returnError));
    return returnError;
  }
}

export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  console.log(`[Get Lessons Action] Attempting to fetch lessons for subject: ${subject}`);
  let adminPb;
  try {
    adminPb = await requirePocketBaseAdmin();
  } catch (initError) {
    const errMessage = (initError instanceof Error && initError.message) ? initError.message : "Admin client initialization failed (GLBSA_E001).";
    console.error(`[Get Lessons Action] Admin client initialization error for subject ${subject}:`, initError);
    return { success: false, message: errMessage, error: errMessage };
  }

  if (!subject) {
    return { success: false, message: "Subject is required to fetch lessons.", error: "Subject required (GLBSA_E002)." };
  }

  try {
    const records = await adminPb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));
    
    console.log(`[Get Lessons Action] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames };

  } catch (error) {
    console.error(`[Get Lessons Action] Error fetching lessons for subject ${subject}:`, error);
    let errorMessage = `Failed to fetch lessons for ${subject} (GLBSA_E003).`;
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error while fetching lessons: ${error.status} (GLBSA_E004).`;
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}
