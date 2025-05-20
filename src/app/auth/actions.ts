
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { format } from 'date-fns';


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
      // For this flow, don't indicate "invalid code" explicitly. Let signup proceed.
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error('[Validate Referral Code Action] Error validating referral code:', error);
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
      referredByCode: upperCaseReferredByCode, // Save the entered code, valid or not
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

  // Update referrer stats IF a valid referral code was used AND a referrer was found
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to find referrer and update stats.`);
    try {
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); 
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        // This part will attempt to use pbGlobal. It may fail if rules are restrictive for updating other users.
        // If POCKETBASE_ADMIN_EMAIL/PASSWORD were set, we'd use getAdminPb() here.
        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbGlobal);
        console.log(`[Signup Action] Referral stats update attempted for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
      } else {
        console.warn(`[Signup Action] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated.`);
      }
    } catch (statsError) {
      console.warn(`[Signup Action Warning] Failed to update referral stats for ${upperCaseReferredByCode} (using pbGlobal). User signup itself was successful. This might be due to collection permissions. Error:`, statsError);
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
    const userName = userFullName; 
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
  
  // This action will use pbGlobal. It relies on PocketBase rules for user self-update (e.g., @request.auth.id = id)
  // and the server action framework correctly propagating the client's auth context.
  // If pbGlobal isn't correctly authed as the user, this will fail.
  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
      console.warn("[Update Profile Action] Warning: Attempting update with pbGlobal, but current server-side auth context in pbGlobal does not match target userId or is invalid. Update might fail due to PocketBase rules. Client-side must be authenticated.");
  }


  try {
    // Attempting with pbGlobal. PocketBase will check if @request.auth.id = id for updateRule.
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[Update Profile Action] Profile updated successfully for user ${userId} (using pbGlobal for user self-update):`, updatedUserRecord);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error - Global Instance] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile. Check PocketBase rules (e.g., users can update their own records).";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { // Forbidden
           errorMessage = "Permission Denied: You may not have permission to update this profile. Ensure you are updating your own profile and collection rules allow it.";
        } else if (error.status === 404) { // Not Found
           errorMessage = "User not found. Could not update profile.";
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  // This action assumes pbGlobal on the server might have the current user's auth context
  // if the server action framework passes it. Otherwise, this needs client-side initiation or token passing.
  const currentAuthUser = pbGlobal.authStore.model;
  if (!currentAuthUser || !currentAuthUser.id) {
    console.warn("[Get Referrer Info Action] No authenticated user found in pbGlobal.authStore for server action.");
    return { referrerName: null, error: "User not authenticated or user context not available to server action." };
  }

  let currentUserRecord;
  try {
    // Fetch the full record for the current user to get their referredByCode
    currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal); 
  } catch (e) {
     console.error("[Get Referrer Info Action] Error fetching current user's record:", e);
     return { referrerName: null, error: "Could not fetch current user details." };
  }
  

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    return { referrerName: null }; // No referral code used or found
  }

  // Use pbGlobal for this read operation. Relies on appropriate view rules for users collection.
  try {
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
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
   // This action will use pbGlobal. Relies on PocketBase rules for user self-update of avatar.
   // The client making the call to this server action must be authenticated.
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available to server action. Please ensure you are logged in.";
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId; 
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId} using pbGlobal (user self-update).`);

  try {
    // Attempting with pbGlobal. PocketBase will check if @request.auth.id = id for updateRule.
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[Update Avatar Action - Global Instance] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error - Global Instance] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar. Check PocketBase rules for user avatar updates.";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) { // Forbidden
           errorMessage = "Permission Denied: You may not have permission to update this avatar. Ensure you are updating your own avatar and collection rules allow it.";
        } else if (error.status === 404) { // Not Found
           errorMessage = "User not found. Could not update avatar.";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   // This action will use pbGlobal. Relies on PocketBase rules for user self-update of avatar.
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available to server action. Please ensure you are logged in.";
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId; 
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId} using pbGlobal (user self-update).`);

  try {
    // Attempting with pbGlobal. PocketBase will check if @request.auth.id = id for updateRule.
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[Remove Avatar Action - Global Instance] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error - Global Instance] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar. Check PocketBase rules for user avatar updates.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) { // Forbidden
           errorMessage = "Permission Denied: You may not have permission to remove this avatar. Ensure you are updating your own avatar and collection rules allow it.";
        } else if (error.status === 404) { // Not Found
           errorMessage = "User not found. Could not remove avatar.";
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

  // We are relying on PocketBase rules: @request.auth.id != "" && @request.auth.role = "Admin"
  // The pbGlobal instance, when used in a server action called by an authenticated client,
  // should carry the client's auth token. PocketBase will then enforce the rule.

  // Client-side layout already guards access to the Add Question page for Admins.
  // An additional server-side check on pbGlobal.authStore.model?.role here might be redundant
  // if Next.js auth propagation to server-side pbGlobal isn't perfectly reliable.
  // The ultimate authority is PocketBase's rule engine using the token from the request.

  if (!pbGlobal.authStore.isValid) {
    const authErrorMessage = "User is not authenticated. Cannot add question. Please ensure you are logged in with an Admin account.";
    console.warn(`[Add Question Action] ${authErrorMessage} (pbGlobal.authStore.isValid is false on server)`);
    return { success: false, message: authErrorMessage, error: "Authentication required for this action." };
  }
  
  // This server-side check on pbGlobal.authStore.model might not always reflect the client's actual role
  // if auth context isn't fully propagated to pbGlobal in server actions.
  // PocketBase's collection rule is the definitive check.
  console.log(`[Add Question Action] Current pbGlobal authStore model role (on server): ${pbGlobal.authStore.model?.role}`);


  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log("[Add Question Action] Question added successfully to PocketBase:", newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error("[Add Question Action] Error adding question to PocketBase:", error);
    let errorMessage = "Failed to add question.";
    if (error instanceof ClientResponseError) {
      // PocketBase specific error
      console.error("[Add Question Action] PocketBase ClientResponseError details:", JSON.stringify(error.data, null, 2));
      
      let detailedFieldErrors = "";
      if (error.data?.data) { // Field-specific errors
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }
      
      // Construct the final message
      if (detailedFieldErrors) {
        errorMessage = `Failed to create record. Details: ${detailedFieldErrors}`;
      } else if (error.data?.message) {
        errorMessage = error.data.message; // Use PocketBase's main message
      } else {
        errorMessage = "Failed to create record. Please check inputs."; // Fallback
      }

      if (error.status === 403) { // Forbidden
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure your account has the 'Admin' role and the 'question_bank' collection rules in PocketBase are correctly set to '@request.auth.id != \"\" && @request.auth.role = \"Admin\"'.";
      } else if (error.status === 0) { // Network error
        errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status.";
      }
      // For other statuses, use the already constructed errorMessage.
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: "PocketBase operation failed. See server logs for detailed error data and client toast for specifics." };
  }
}

// getAllUsersAction removed as per previous request.
// If User Management is re-added, this needs to be restored and use requirePocketBaseAdmin()
// as the listRule for users is typically admin-only.
