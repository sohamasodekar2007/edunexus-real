
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { format } from 'date-fns';


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    console.warn("[Validate Referral Action] Admin PB instance not available for validation. Falling back to global instance. This may lead to incorrect validation results if user collection list/view rules are strict.");
    try {
        const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); 
        if (referrer) {
          return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
        } else {
          return { success: false, message: "Invalid referral code. Please use another one." };
        }
    } catch (error) {
        console.error('Error validating referral code action (fallback):', error);
        return { success: false, message: "Error validating code. Please try again." };
    }
  }


  try {
    const referrer = await findUserByReferralCode(upperCaseCode, adminPb);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "Invalid referral code. Please use another one." };
    }
  } catch (error) {
    console.error('Error validating referral code action with adminPb:', error);
    return { success: false, message: "Error validating code. Please try again." };
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

    console.log("[Signup Action] Attempting to create user with data (password omitted):", { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Use global pb for new user creation, relying on public create rule.
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

  // Attempt to update referrer stats if a referral code was used and a new user was created
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    const adminPbForReferrerUpdate = await getPocketBaseAdmin();
    if (adminPbForReferrerUpdate) {
      try {
        const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPbForReferrerUpdate);
        if (referrerToUpdateStats && referrerToUpdateStats.id) {
          console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
          const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
          const newReferrerStats: User['referralStats'] = {
            ...currentStats,
            referred_free: (currentStats.referred_free || 0) + 1, 
          };
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPbForReferrerUpdate);
          console.log(`[Signup Action] Referral stats updated for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
        } else {
          console.warn(`[Signup Action] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. The entered code was saved for the new user, but no referrer was credited.`);
        }
      } catch (statsError) {
        console.warn(`[Signup Action Warning] Failed to update referral stats for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError);
      }
    } else {
      console.warn(`[Signup Action Warning] Admin PB instance not available for updating referrer stats for code ${upperCaseReferredByCode}. New user signup was successful, but referrer stats not updated. Check server logs for admin client initialization issues logged by pocketbaseAdmin.ts.`);
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
  userTargetYear?: number | null,
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
    let errorMessage = 'Invalid email or password.';
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
    return { success: false, message: "User ID is required for profile update.", error: "User ID missing" };
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
      if (!isNaN(year)) {
        dataForPocketBase.targetYear = year;
      } else {
        console.warn(`[Update Profile Action] Invalid target year string received: ${targetYearToUpdate}. Setting to null.`);
         dataForPocketBase.targetYear = null;
      }
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." };
  }

  console.log(`[Update Profile Action] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    const authErrorMsg = "Profile update failed: Could not get admin client for this server action. Check server logs for details on admin client initialization failure.";
    console.warn(`[Update Profile Action] Admin PB instance not available. User: ${userId}. Cannot update profile. Check server logs for admin client init details.`);
    return { success: false, message: authErrorMsg, error: "Admin client unavailable for server action. Check server logs." };
  }

  try {
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, adminPb);
    console.log(`[Update Profile Action] Profile updated successfully for user ${userId}:`, updatedUserRecord);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to the server while updating profile.";
        } else if (error.status === 404) {
          errorMessage = "User not found. Could not update profile.";
        } else if (error.status === 403) {
           errorMessage = "Permission denied by PocketBase to update profile. Ensure the admin account has sufficient privileges.";
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
    console.warn("[Get Referrer Info Action] No authenticated user found in pbGlobal.authStore. This action might be called in an unauthenticated context on the server or client needs to be logged in.");
    return { referrerName: null, error: "User not authenticated." };
  }

  let currentUserRecord;
  try {
    currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal);
  } catch (e) {
     console.error("[Get Referrer Info Action] Error fetching current user's record:", e);
     return { referrerName: null, error: "Could not fetch current user details." };
  }
  
  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    return { referrerName: null }; 
  }

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    console.warn("[Get Referrer Info Action] Admin PB instance not available to find referrer by code. This might prevent fetching the referrer's name. Check server logs for admin client init details.");
    return { referrerName: null, error: "Admin client unavailable to fetch referrer details. Check server logs." };
  }

  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, adminPb);
    if (referrer && referrer.name) {
      return { referrerName: referrer.name };
    } else {
      console.warn(`[Get Referrer Info Action] Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing.`);
      return { referrerName: null, error: "Referrer not found or name missing." };
    }
  } catch (error) {
    console.error(`[Get Referrer Info Action] Error fetching referrer by code ${currentUserRecord.referredByCode}:`, error);
    return { referrerName: null, error: "Error fetching referrer details." };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null. User might not be properly authenticated on the client before calling this action, or client auth context is not available to server action's pbGlobal.");
     return { success: false, message: "User not authenticated or user ID not available to server action. Please ensure you are logged in.", error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId;
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId}`);

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    const authErrorMsg = "Avatar update failed: Could not get admin client for this server action. Check server logs for details on admin client initialization failure.";
    console.warn(`[Update Avatar Action] Admin PB instance not available. User: ${userId}. Cannot update avatar. Check server logs for admin client init details.`);
    return { success: false, message: authErrorMsg, error: "Admin client unavailable for server action. Check server logs." };
  }

  try {
    const updatedRecord = await updateUserInPocketBase(userId, formData, adminPb); 
    console.log(`[Update Avatar Action] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 404) {
        errorMessage = "User record not found for avatar update.";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while updating avatar.";
      } else if (error.status === 403) {
        errorMessage = "Permission denied by PocketBase to update avatar. Ensure admin has rights.";
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
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null. User might not be properly authenticated on the client before calling this action, or client auth context is not available to server action's pbGlobal.");
    return { success: false, message: "User not authenticated or user ID not available to server action. Please ensure you are logged in.", error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId;
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId}`);

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    const authErrorMsg = "Avatar removal failed: Could not get admin client for this server action. Check server logs for details on admin client initialization failure.";
    console.warn(`[Remove Avatar Action] Admin PB instance not available. User: ${userId}. Cannot remove avatar. Check server logs for admin client init details.`);
    return { success: false, message: authErrorMsg, error: "Admin client unavailable for server action. Check server logs." };
  }

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, adminPb);
    console.log(`[Remove Avatar Action] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
      if (error.status === 404) {
        errorMessage = "User record not found for avatar removal.";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while removing avatar.";
      } else if (error.status === 403) {
        errorMessage = "Permission denied by PocketBase to remove avatar. Ensure admin has rights.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}


export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  console.log("[Add Question Action] Received form data keys:", Array.from(formData.keys()));

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
    const adminAuthErrorMessage = "Failed to add question: Could not authenticate admin for this server action. Please check server logs for details on the admin authentication failure (e.g., missing/incorrect .env variables POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD, or misconfigured NEXT_PUBLIC_POCKETBASE_URL).";
    console.warn("[Add Question Action] Admin PB instance not available. Detailed error logged by pocketbaseAdmin.ts.");
    return { success: false, message: adminAuthErrorMessage, error: "Admin authentication failed for server action. Check server logs." };
  }

  try {
    console.log("[Add Question Action] Attempting to create question record in PocketBase with admin privileges.");
    const newQuestionRecord = await adminPb.collection('question_bank').create(formData);

    console.log("[Add Question Action] Question added successfully to PocketBase:", newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error("[Add Question Action] Error adding question to PocketBase:", error);
    let errorMessage = "Failed to add question.";
    if (error instanceof ClientResponseError) {
      console.error("[Add Question Action] PocketBase ClientResponseError details:", JSON.stringify(error.data));
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 400 && error.data?.data?.isPYQ?.message?.includes("cannot be blank")) {
        errorMessage = "Validation Error: 'Is PYQ' field is required. Please check the form.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getAllUsersAction(): Promise<{ success: boolean; users?: Partial<User>[]; error?: string; message?: string }> {
  console.log("[Get All Users Action] Attempting to fetch all users.");
  const adminPb = await getPocketBaseAdmin();

  if (!adminPb) {
    console.warn("[Get All Users Action] Admin PB instance not available. Cannot fetch all users as per collection rules.");
    return { success: false, error: "Admin auth missing", message: "Admin authentication required to fetch users. Check server logs for details." };
  }

  try {
    const records = await adminPb.collection('users').getFullList({
      sort: '-created',
    });

    const users = records.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role as UserRole,
      model: record.model as UserModel,
      created: record.created ? format(new Date(record.created), "PPpp") : 'N/A',
      avatarUrl: record.avatar ? adminPb.getFileUrl(record, record.avatar) : null,
    }));

    console.log(`[Get All Users Action] Successfully fetched ${users.length} users.`);
    return { success: true, users };
  } catch (error) {
    console.error("[Get All Users Action] Error fetching users from PocketBase:", error);
    let errorMessage = "Failed to fetch users.";
     if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error (${error.status}): Failed to fetch users.`;
      if (error.status === 403) {
        errorMessage = "Permission denied: Admin does not have rights to list users. Check PocketBase collection rules for 'users'.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage, message: errorMessage };
  }
}
