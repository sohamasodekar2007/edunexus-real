
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo } from '@/types';
import { format } from 'date-fns';
// import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin'; // Admin client removed for now

// Helper function for error responses
function createErrorResponse(message: string, errorCode: string, details?: any) {
  const response = { success: false, message, error: errorCode, details };
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
    // Uses global pb instance, assumes users collection view rule is permissive enough for this lookup
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" }; // No error message, just no success
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // No error message, just no success
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const actionName = "Signup User Action";
  console.log(`[${actionName}] Attempting signup for email: ${data.email}`);
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.warn(`[${actionName}] Validation failed: ${errorMessages}`);
    return createErrorResponse("Validation failed", "SIGNUP_VALIDATION_ERROR", errorMessages);
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
        referred_dpp: 0,
      },
      targetYear: null,
      avatar: null, // PocketBase handles avatar field internally
      emailVisibility: true,
      verified: false,
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted from log):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });

    // Uses global pb instance. Relies on PocketBase users collection 'createRule' being public.
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
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); // Use global pb for read
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };

        // This part might fail if users collection update rule is restrictive & not using admin
        // For now, we assume `@request.auth.id = id` or more permissive for self-updates,
        // or that this specific referral stat update is allowed for admins if getAdminPb was used.
        // Since getAdminPb is removed for general use, this update will likely rely on PocketBase rules
        // that might not permit one user (even admin) to update another without specific setup.
        // It's safer if an admin-context PB instance is used here IF this must be robust.
        // For now, we'll let it attempt with pbGlobal, which may fail for cross-user updates.
        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbGlobal); // Attempt with global pb
        console.warn(`[${actionName}] Attempted to update referral stats for referrer ${referrerToUpdateStats.name} to`, newReferrerStats, ". This may fail if cross-user update permissions are not set or if not using an admin client.");
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message, statsError);
      // Do not block signup success due to referral stat update failure
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
    if (user.avatar) {
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

  // Check client-side auth for the user calling this action.
  // This relies on pbGlobal's authStore being populated by the client's token when action is invoked.
  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
     console.warn(`[${actionName}] Auth mismatch or invalid session: Auth store valid: ${pbGlobal.authStore.isValid}, Auth store user ID: ${pbGlobal.authStore.model?.id}, Target user ID: ${userId}`);
     return createErrorResponse("Permission Denied: You can only update your own profile or your session is invalid. Please re-login.", "UPA_E_AUTH_MISMATCH_SERVER");
  }


  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};

  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }

  if (targetYearToUpdate !== undefined) {
    dataForPocketBase.targetYear = (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '') ? null : parseInt(targetYearToUpdate, 10);
    if (isNaN(dataForPocketBase.targetYear as number)) dataForPocketBase.targetYear = null;
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }

  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    // Uses pbGlobal, relying on user's own auth token (for rule @request.auth.id = id)
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

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated or user context not available to server action.", "GRIA_E001_NO_AUTH", null);
  }
  const currentAuthUserId = pbGlobal.authStore.model.id;

  let currentUserRecord;
  try {
    // Use global pb instance, assumes users view rule allows self-view or is public
    currentUserRecord = await findUserById(currentAuthUserId, pbGlobal);
  } catch (e) {
    return createErrorResponse(`Error fetching current user's record (ID: ${currentAuthUserId}): ${e.message}.`, "GRIA_E002_FETCH_USER_FAIL", e.message);
  }

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserRecord.referredByCode}`);

  try {
    // Use global pb instance, assumes users view rule allows this lookup
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserRecord.referredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      return createErrorResponse(`Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing.`, "GRIA_E003_REFERRER_NOT_FOUND", null);
    }
  } catch (error) {
    return createErrorResponse(`Error fetching referrer by code ${currentUserRecord.referredByCode}: ${error.message}.`, "GRIA_E004_FETCH_REFERRER_FAIL", error.message);
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using current user's auth context (pbGlobal).`);

  try {
    // Uses pbGlobal, relying on user's own auth token (for rule @request.auth.id = id)
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
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using current user's auth context (pbGlobal).`);

  try {
    // Uses pbGlobal, relying on user's own auth token (for rule @request.auth.id = id)
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

  // Relies on client-side check for admin role and PocketBase question_bank createRule
  // being "" (public) or "@request.auth.id != "" && @request.auth.role = "Admin""
  // If rule requires Admin role, pbGlobal (acting on behalf of client) must have Admin role.

  try {
    // If question_bank createRule is "", this will succeed regardless of pbGlobal.authStore.
    // If rule is "@request.auth.id != "" && @request.auth.role = "Admin"",
    // then pbGlobal.authStore must be valid and represent an Admin user.
    // (pbGlobal on server usually unauth unless client token passed & used)
    // For simplicity here, assuming the client-side routing to admin panel is the primary gate.
    // PocketBase will do the final auth check based on its rules.

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
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure you are logged in with an Admin account and PocketBase 'question_bank' collection Create Rule is correctly set (e.g., to allow Admin role or be public).";
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
    // This action requires admin to list all users for calculation.
    // If .env admin creds are not set, requirePocketBaseAdmin will throw, caught below.
    adminPb = await requirePocketBaseAdmin();
  } catch (adminAuthError) {
    const errMessage = adminAuthError instanceof Error ? adminAuthError.message : "Unknown error during admin authentication.";
    console.error(`[${actionName}] Admin client initialization failed: ${errMessage}`);
    // Ensure a structured error is always returned
    return {
      success: false,
      message: `Admin client initialization failed: ${errMessage}. Check server logs. (GLRSA_E001)`,
      error: `Admin client initialization failed. (GLRSA_E001_DETAIL: ${errMessage})`
    };
  }

  // If adminPb is null here (which it shouldn't be if requirePocketBaseAdmin didn't throw, but as a safeguard)
  if (!adminPb) {
    console.error(`[${actionName}] Admin PB instance is null after requirePocketBaseAdmin. This should not happen.`);
    return {
      success: false,
      message: "Critical error: Admin client not available after requirement check. (GLRSA_E002)",
      error: "Admin client unavailable. (GLRSA_E002_DETAIL)"
    };
  }

  try {
    let targetUserReferralCode: string | null = null;

    if (pbGlobal.authStore.isValid && pbGlobal.authStore.model?.referralCode) {
      targetUserReferralCode = pbGlobal.authStore.model.referralCode as string;
    } else {
      return createErrorResponse("No authenticated client user found (or no referral code) to get referral code for live stats.", "GLRSA_E002B_NO_CLIENT_USER", "Current user not authenticated or lacks referral code.");
    }

    console.log(`[${actionName}] Calculating stats for users referred by code: ${targetUserReferralCode} using admin client.`);
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
    return createErrorResponse(clientErrorMessage, clientErrorCode, errorDetails);
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
    // Uses global pb instance. Relies on PocketBase question_bank collection list/view rules.
    // If rule is "@request.auth.id != """, then pbGlobal (acting for client) must be auth'd.
    // If rule is public "", then no auth needed by PB.
    // Client-side check in dpps/page ensures user is auth'd before calling this.
    // Removed internal !pbGlobal.authStore.isValid check, relies on PB rules.

    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName',
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
    // Relies on PocketBase 'question_bank' collection list/view rules.
    // If rule is "@request.auth.id != """, then pbGlobal (acting for client) must be auth'd.
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
        tags: record.tags || undefined, // Assuming tags is stored as a comma-separated string or parsed JSON
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
// Ensure this is the last line of actual code.
