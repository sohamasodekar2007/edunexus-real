
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo } from '@/types';
import { format } from 'date-fns';
// import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin'; // Admin client not used for these actions anymore based on recent requests


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const actionName = "Validate Referral Code Action";
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" }; // No error message for invalid codes until submission
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
        referred_dpp: 0, // Added referred_dpp
      },
      targetYear: null,
      avatar: null,
      emailVisibility: true,
      verified: false,
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data:`, Omit(userDataForPocketBase, 'password', 'passwordConfirm'));
    
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUser.id}`);

  } catch (error) {
    console.error(`[${actionName}] User Creation Failed in PocketBase:`, error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError (User Creation) details (error.data):`, JSON.stringify(error.data, null, 2));
        genericMessage = error.data?.message || genericMessage;
        const pbFieldErrors = error.data?.data;
        if (pbFieldErrors && typeof pbFieldErrors === 'object') {
            specificDetails = Object.keys(pbFieldErrors).map(key => {
                const fieldError = pbFieldErrors[key];
                if (fieldError && fieldError.message) {
                    return `${key}: ${fieldError.message}`;
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
    console.log(`[${actionName}] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
      const adminPb = null; // Removed dependency on getAdminPb()
      // const adminPb = await getPocketBaseAdmin(); // This would be for super-admin update

      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); // Use pbGlobal
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
        
        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        
        // Updating another user's stats typically requires admin privileges or specific collection rules.
        // If adminPb is null (not using super-admin), this next line will likely fail unless rules permit.
        // For now, we'll log a warning if adminPb is not available for this specific operation.
        if (adminPb) {
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
          console.log(`[${actionName}] Successfully updated referral stats for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
        } else {
          console.warn(`[${actionName}] Admin PocketBase client not available. Could not update referral stats for referrer ${referrerToUpdateStats.name}. User signup was successful. This operation typically requires admin privileges or specific rules to update another user's record.`);
        }
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message, statsError);
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
  const actionName = "Login User Action";
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();
  console.log(`[${actionName}] Attempting login for: ${normalizedEmail}`);

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
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
      userTargetYear: user.targetYear || null,
      userReferralCode: user.referralCode || null, 
      userReferredByCode: user.referredByCode || null, 
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error(`[${actionName}] Login Error for ${normalizedEmail}:`, error);
    let errorMessage = 'Login Failed: Invalid email or password.';
     if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data));
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
  const actionName = "Update User Profile Action";
  console.log(`[${actionName}] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  
  if (!userId) {
    const errorMsg = "User ID is required for profile update. (UPA_E001)";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: errorMsg };
  }

  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
    console.warn(`[${actionName}] Permission Denied: Attempt to update profile for user ${userId} without proper authentication as that user.`);
    return { success: false, message: "Permission Denied: You can only update your own profile.", error: "Permission Denied (UPA_E_AUTH)" };
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
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }

  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    // User updates their own record, using their current auth context (pbGlobal)
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[${actionName}] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile (UPA_E002).";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to update this profile. (UPA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not update profile (UPA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update profile (UPA_E005).";
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";
  const currentAuthUser = pbGlobal.authStore.model;

  if (!currentAuthUser || !currentAuthUser.id) {
    const noAuthMsg = "User not authenticated or user context not available to server action (GRIA_E001).";
    console.warn(`[${actionName}] ${noAuthMsg}`);
    return { referrerName: null, error: noAuthMsg };
  }

  let currentUserRecord;
  try {
    currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal);
  } catch (e) {
     const fetchUserError = `Error fetching current user's record (ID: ${currentAuthUser.id}): ${e.message} (GRIA_E002).`;
     console.error(`[${actionName}] ${fetchUserError}`);
     return { referrerName: null, error: fetchUserError };
  }

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUser.id}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUser.id}) was referred by code: ${currentUserRecord.referredByCode}`);

  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserRecord.referredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      const notFoundMsg = `Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing (GRIA_E003).`;
      console.warn(`[${actionName}] ${notFoundMsg}`);
      return { referrerName: null, error: notFoundMsg };
    }
  } catch (error) {
    const fetchReferrerError = `Error fetching referrer by code ${currentUserRecord.referredByCode}: ${error.message} (GRIA_E004).`;
    console.error(`[${actionName}] ${fetchReferrerError}`);
    return { referrerName: null, error: fetchReferrerError };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Update User Avatar Action";
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (UAA_E001).";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using user's auth context (pbGlobal).`);

  try {
    // User updates their own record, using their current auth context (pbGlobal)
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar (UAA_E002).";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to update this avatar. (UAA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not update avatar (UAA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update avatar (UAA_E005).";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Remove User Avatar Action";
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available. Please log in (RAA_E001).";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = currentAuthUserId;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using user's auth context (pbGlobal).`);

  try {
    // User updates their own record, using their current auth context (pbGlobal)
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar (RAA_E002).";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { 
           errorMessage = "Permission Denied: You may not have permission to remove this avatar. (RAA_E003 - Check PocketBase 'users' updateRule).";
        } else if (error.status === 404) { 
           errorMessage = `User not found (ID: ${userId}). Could not remove avatar (RAA_E004).`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to remove avatar (RAA_E005).";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question.`);
  console.log(`[${actionName}] Received form data keys:`, Array.from(formData.keys()));
  
  // Relies on PocketBase 'question_bank' "Create Rule" being appropriate.
  // If client is authenticated & role is Admin, PocketBase SDK will send their token.
  // If PocketBase rule is "" (public), then unauthenticated pbGlobal works.
  // If PocketBase rule is "@request.auth.id != "" && @request.auth.role = "Admin"", then the authenticated user's role will be checked by PB.
  
  // Assuming client-side check in admin-panel/layout.tsx already verified user's role is Admin.
  // The pbGlobal instance, if called from an authenticated client context (as Server Actions usually are),
  // should carry the user's auth token.

  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question (AQA_E003).";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));

      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) { 
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure you are logged in with an Admin account and the collection rules are set correctly. (AQA_E004)";
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
    return { success: false, message: errorMessage, error: errorMessage };
  }
}


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to calculate live referral stats.`);
  
  let adminPb: PocketBase | null = null; // Declare PocketBase type here

  try {
    // This action needs admin to list all users to calculate live stats.
    // adminPb = await requirePocketBaseAdmin(); // This line would require admin auth.
    // Since we're trying to avoid super-admin dependency, this approach is flawed if not admin.
    // For now, to make it *potentially* work if rules allowed or for testing, we'll keep it.
    // A more robust solution for non-super-admin might involve a dedicated backend function in PB.
    
    // Simulating the case where requirePocketBaseAdmin might not be available or desired:
    // This action, as intended to count across ALL users for a given referral code, fundamentally
    // needs broad read access (like an admin has, or a very open 'users' list rule).
    // Let's assume for a moment the admin client IS available.
    // This will cause a client-side error if POCKETBASE_ADMIN_EMAIL/PASSWORD are not set.
    const { getPocketBaseAdmin, requirePocketBaseAdmin } = await import('@/lib/pocketbaseAdmin');
    adminPb = await requirePocketBaseAdmin();


    let targetUserReferralCode: string | null = null;
    if (pbGlobal.authStore.isValid && pbGlobal.authStore.model?.referralCode) {
        targetUserReferralCode = pbGlobal.authStore.model.referralCode as string;
    } else {
        const noClientUserMsg = "No authenticated client user found to get referral code for live stats. (GLRSA_E002B_NO_CLIENT_USER)";
        console.warn(`[${actionName}] ${noClientUserMsg}`);
        console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, stats: undefined, message: noClientUserMsg, error: noClientUserMsg })}`);
        return { success: false, stats: undefined, message: noClientUserMsg, error: noClientUserMsg };
    }
    
    if (!targetUserReferralCode) {
        const noCodeMsg = "Authenticated user does not have a referral code. (GLRSA_E002C_NO_CODE)";
        console.warn(`[${actionName}] ${noCodeMsg}`);
         console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, stats: undefined, message: noCodeMsg, error: noCodeMsg })}`);
        return { success: false, stats: undefined, message: noCodeMsg, error: noCodeMsg };
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
      switch (user.model as UserModel) { // Cast to UserModel
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
        case 'Dpp':
           liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1;
           break;
        // Teacher model is not counted in referral stats typically
        default:
          break;
      }
    });
    console.log(`[${actionName}] Successfully calculated live stats:`, JSON.stringify(liveStats));
     console.log(`[${actionName}] Returning success: ${JSON.stringify({ success: true, stats: liveStats, message: "Stats fetched successfully." })}`);
    return { success: true, stats: liveStats, message: "Stats fetched successfully." };

  } catch (error) {
    console.error(`[${actionName}] Error calculating live referral stats:`, error);
    let errMessage = `Failed to calculate live referral stats. (GLRSA_E003_OUTER_CATCH)`;
    let errCode = `GLRSA_E003_OUTER_CATCH`;

    if (error instanceof ClientResponseError) {
        errMessage = error.data?.message || `PocketBase error: ${error.status}. (GLRSA_E004_PB_ERROR)`;
        errCode = `GLRSA_E004_PB_${error.status}`;
        if (error.status === 403) { 
            errMessage = "Permission Denied: You do not have permission to list all users to calculate live referral stats. This action may require admin privileges. (GLRSA_E005_PB_403)";
            errCode = `GLRSA_E005_PB_403`;
        } else if (error.status === 0) {
          errMessage = "Network Error: Could not connect to PocketBase for live stats. (GLRSA_E007_PB_0)";
          errCode = `GLRSA_E007_PB_0`;
        }
    } else if (error instanceof Error && error.message) {
        if (error.message.startsWith("Admin client initialization")) {
            errMessage = error.message; 
            errCode = "GLRSA_E001_ADMIN_INIT_FAIL";
        } else {
            errMessage = error.message;
        }
    }
    console.log(`[${actionName}] Returning error from outer catch: ${JSON.stringify({ success: false, stats: undefined, message: errMessage, error: errCode })}`);
    return { success: false, stats: undefined, message: errMessage, error: errCode };
  }
}


export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);
  
  if (!subject) {
    const errorMsg = "Subject is required to fetch lessons (GLBSA_E002_NO_SUBJECT).";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: "Subject required." };
  }

  try {
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));
    
    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);
    let errorMessage = `Failed to fetch lessons for ${subject}. (GLBSA_E003_FETCH_FAIL)`;
    let errorCode = `GLBSA_E003_FETCH_FAIL`;

    if (error instanceof ClientResponseError) {
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found, or no records for subject '${subject}'. Check PocketBase setup and collection rules. (URL: ${error.url}) (GLBSA_E006_PB_404)`;
        errorCode = `GLBSA_E006_PB_404`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'. (GLBSA_E007_PB_0)`;
        errorCode = `GLBSA_E007_PB_0`;
      } else {
        errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}': ${error.status}. (GLBSA_E004_PB_ERROR)`;
        errorCode = `GLBSA_E004_PB_${error.status}`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    
    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMessage, error: errorCode })}`);
    return { 
      success: false, 
      message: errorMessage,
      error: errorCode 
    };
  }
}

type PocketBase = import('pocketbase').default; // Import type for PocketBase
    
```

I am still having the error "TypeError: Cannot read properties of undefined (reading 'split')"
```