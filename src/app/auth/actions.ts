
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin'; // For admin-only actions
import { format } from 'date-fns';


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();

  const pbInstanceToUse = await getPocketBaseAdmin() || pbGlobal;

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbInstanceToUse);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      // Do not return an error message if code is invalid, as per user request.
      return { success: false, message: "" }; 
    }
  } catch (error) {
    console.error('[Validate Referral Code Action] Error validating referral code:', error);
    return { success: false, message: "Error validating code. Please try again." }; // Internal error
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
      referredByCode: upperCaseReferredByCode, // Save the code the user entered
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
    // User creation uses pbGlobal, relying on public createRule for users collection
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal); 
    console.log("[Signup Action] User created successfully with pbGlobal:", newUser.id);

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

  // Update referrer stats IF a valid referral code was used
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    const adminPbForReferrerUpdate = await getPocketBaseAdmin(); // Attempt to get admin client
    if (adminPbForReferrerUpdate) {
      try {
        const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPbForReferrerUpdate);
        if (referrerToUpdateStats && referrerToUpdateStats.id) {
          console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
          const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
          const newReferrerStats: User['referralStats'] = {
            ...currentStats,
            referred_free: (currentStats.referred_free || 0) + 1, // Assuming new users are on Free model
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
      console.warn(`[Signup Action Warning] Admin PB instance not available for updating referrer stats for code ${upperCaseReferredByCode}. New user signup was successful, but referrer stats not updated. This may be expected if admin credentials are not set in .env or if admin auth failed.`);
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
  userName?: string, // First name part
  userModel?: UserModel | null,
  userRole?: UserRole | null,
  userClass?: UserClass | null,
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: number | null,
  userReferralCode?: string | null, // User's own referral code
  userReferredByCode?: string | null, // Code they used to sign up
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
    const userName = userFullName.split(' ')[0] || 'User'; // Extract first name for greeting

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
      dataForPocketBase.targetYear = !isNaN(year) ? year : null;
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." };
  }

  console.log(`[Update Profile Action] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);
  
  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
      console.warn("[Update Profile Action] Admin PB instance not available. Attempting update with global instance (might fail due to permissions).");
      // Attempt with global/user's own auth context. Might fail if PocketBase rules are strict for server-side updates.
      try {
          const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
          console.log(`[Update Profile Action] Profile updated successfully for user ${userId} (using global instance):`, updatedUserRecord);
          return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
      } catch (error) {
          console.error(`[Update Profile Action Error - Global Instance] Failed to update profile for user ${userId}:`, error);
          let errorMessage = "Failed to update profile. This might be a permission issue if admin credentials are not set for server actions.";
           if (error instanceof ClientResponseError) {
              errorMessage = error.data?.message || errorMessage;
           } else if (error instanceof Error) {
              errorMessage = error.message;
           }
          return { success: false, message: errorMessage, error: errorMessage };
      }
  }


  try {
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, adminPb);
    console.log(`[Update Profile Action] Profile updated successfully for user ${userId} (using admin instance):`, updatedUserRecord);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error - Admin Instance] Failed to update profile for user ${userId}:`, error);
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
           errorMessage = `Permission Denied: Could not update profile. Ensure PocketBase rules allow this update or admin credentials (if used by action) are valid with sufficient privileges.`;
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
    console.warn("[Get Referrer Info Action] No authenticated user found in pbGlobal.authStore.");
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

  const pbInstanceForReferrerLookup = await getPocketBaseAdmin() || pbGlobal; 

  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbInstanceForReferrerLookup);
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
    const authErrorMessage = "User not authenticated or user ID not available to server action. Please ensure you are logged in.";
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId; 
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId}`);

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
      const adminAuthError = "Admin PB instance not available for avatar update. This action requires admin credentials in .env to modify user records reliably from server actions.";
      console.warn(`[Update Avatar Action] ${adminAuthError}`);
      // Fallback to global instance, but this will likely fail due to permissions if not admin.
      // This is more for illustrating the problem than a real solution without admin auth.
      try {
        const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
        console.log(`[Update Avatar Action - Global Instance] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
        return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
      } catch (error) {
        console.error(`[Update Avatar Action Error - Global Instance] Failed to update avatar for user ${userId}:`, error);
        let errorMessage = "Failed to update avatar. This often happens if admin credentials are not set for server actions and user permissions are restrictive.";
        if (error instanceof ClientResponseError) {
            errorMessage = error.data?.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { success: false, message: errorMessage, error: errorMessage };
      }
  }

  try {
    const updatedRecord = await updateUserInPocketBase(userId, formData, adminPb);
    console.log(`[Update Avatar Action] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error - Admin Instance] Failed to update avatar for user ${userId}:`, error);
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
        errorMessage = "Permission Denied: Could not update avatar. Ensure PocketBase rules allow this update or admin credentials (if used) are valid.";
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
    const authErrorMessage = "User not authenticated or user ID not available to server action. Please ensure you are logged in.";
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId; 
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId}`);

  const adminPb = await getPocketBaseAdmin();
  if (!adminPb) {
      const adminAuthError = "Admin PB instance not available for avatar removal. This action requires admin credentials in .env to modify user records reliably from server actions.";
      console.warn(`[Remove Avatar Action] ${adminAuthError}`);
      // Fallback to global instance
      try {
        const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
        console.log(`[Remove Avatar Action - Global Instance] Avatar removed successfully for user ${userId}.`);
        return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
      } catch (error) {
        console.error(`[Remove Avatar Action Error - Global Instance] Failed to remove avatar for user ${userId}:`, error);
        let errorMessage = "Failed to remove avatar. This often happens if admin credentials are not set for server actions and user permissions are restrictive.";
        if (error instanceof ClientResponseError) {
            errorMessage = error.data?.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { success: false, message: errorMessage, error: errorMessage };
      }
  }

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, adminPb);
    console.log(`[Remove Avatar Action - Admin Instance] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error - Admin Instance] Failed to remove avatar for user ${userId}:`, error);
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
        errorMessage = "Permission Denied: Could not remove avatar. Ensure PocketBase rules allow this action or admin credentials (if used) are valid.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}


export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  console.log("[Add Question Action] Validating current user's auth context for adding question.");

  // Check if the user is authenticated and has the 'Admin' role on the server-side pbGlobal context
  // This relies on Next.js server actions somehow propagating the client's auth context to pbGlobal.
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model || pbGlobal.authStore.model.role !== 'Admin') {
    const authErrorMessage = "Failed to add question: User is not authenticated as an Admin or session is invalid. Please ensure you are logged in with an Admin account that has the 'Admin' role set in PocketBase.";
    console.warn("[Add Question Action] User not authenticated as Admin or authStore invalid. Auth model:", pbGlobal.authStore.model);
    return { success: false, message: authErrorMessage, error: "User not Admin or not authenticated for this action." };
  }
  
  console.log(`[Add Question Action] User ${pbGlobal.authStore.model.id} (Role: ${pbGlobal.authStore.model.role}) is attempting to add a question.`);
  console.log("[Add Question Action] Received form data keys:", Array.from(formData.keys()));

  try {
    // Using pbGlobal, relying on the calling user's ("Admin") auth token being passed with the request
    // and the PocketBase collection rules for `question_bank` (CreateRule: @request.auth.role = "Admin").
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log("[Add Question Action] Question added successfully to PocketBase:", newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error("[Add Question Action] Error adding question to PocketBase:", error);
    let errorMessage = "Failed to add question.";
    if (error instanceof ClientResponseError) {
      console.error("[Add Question Action] PocketBase ClientResponseError details:", JSON.stringify(error.data, null, 2));
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 400 && error.data?.data?.isPYQ?.message?.includes("cannot be blank")) {
        errorMessage = "Validation Error: 'Is PYQ' field is required. Please check the form.";
      } else if (error.status === 403) { // Permission Denied from PocketBase
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure your account has the 'Admin' role and the 'question_bank' collection rules in PocketBase are set correctly (e.g., CreateRule: @request.auth.id != \"\" && @request.auth.role = \"Admin\").";
      } else if (error.status === 0) { // Network error
        errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status.";
      } else {
        errorMessage = `PocketBase error (${error.status}): ${errorMessage}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

// Removed getAllUsersAction as per user request to remove User Management from Admin Panel
// If you re-add User Management, this action (or a similar one) would be needed.
// It would require admin privileges as per default PocketBase rules for listing users.
/*
export async function getAllUsersAction(): Promise<{ success: boolean; users?: Partial<User>[]; message?: string, error?: string }> {
  console.log("[Get All Users Action] Attempting to fetch all users.");
  const adminPb = await requirePocketBaseAdmin(); // This will throw if admin auth fails

  try {
    const records = await adminPb.collection('users').getFullList({
      sort: '-created',
      // fields: "id,name,email,role,model,created,avatar" 
    });

    const users = records.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role as UserRole | null,
      model: record.model as UserModel | null,
      created: format(new Date(record.created), "PPP"), 
      avatarUrl: record.avatar ? adminPb.getFileUrl(record, record.avatar as string) : null,
    }));
    
    return { success: true, users };
  } catch (error) {
    console.error('[Get All Users Action] Error fetching users with admin client:', error);
    let message = 'Failed to fetch users.';
    let errorString = String(error);
    if (error instanceof ClientResponseError) {
        message = error.data?.message || message;
        errorString = JSON.stringify(error.data) || errorString;
         if (error.status === 0) {
          message = "Network Error: Could not connect to PocketBase to fetch users.";
        }
    } else if (error instanceof Error) {
        message = error.message;
        errorString = error.message;
    }
    return { success: false, message, error: errorString };
  }
}
*/
