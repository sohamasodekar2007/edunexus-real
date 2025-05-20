// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { format } from 'date-fns';
import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); // Can use pbGlobal if view rule is public or user-accessible
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error('[Validate Referral Code Action] Error validating referral code:', error);
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
    
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal); // Create user with global/public PB instance
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
    try {
      const adminPb = await getPocketBaseAdmin(); 
      if (adminPb) {
        const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPb);
        if (referrerToUpdateStats && referrerToUpdateStats.id) {
          console.log(`[Signup Action] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
          
          // Initialize stats if null or undefined, ensuring all keys are present
          const currentStats = referrerToUpdateStats.referralStats || {};
          const newReferrerStats: User['referralStats'] = {
            referred_free: (currentStats.referred_free || 0),
            referred_chapterwise: (currentStats.referred_chapterwise || 0),
            referred_full_length: (currentStats.referred_full_length || 0),
            referred_combo: (currentStats.referred_combo || 0),
          };

          // New users are 'Free' by default
          newReferrerStats.referred_free = (newReferrerStats.referred_free || 0) + 1;
          
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
          console.log(`[Signup Action] Successfully updated referral stats for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats);
        } else {
          console.warn(`[Signup Action] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated.`);
        }
      } else {
         console.warn("[Signup Action] Admin PB client not available for updating referrer stats. Referrer stats update skipped. This might be due to missing admin credentials in .env or admin auth failure.");
      }
    } catch (statsError) {
      console.warn(`[Signup Action Warning] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError);
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
  
  try {
    // Attempting with global pb. If user is authenticated client-side, token might propagate for self-update.
    // This relies on PocketBase 'users' collection updateRule like "@request.auth.id = id"
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[Update Profile Action] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[Update Profile Action Error] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile.";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this profile. Ensure you are updating your own profile and collection rules allow it (@request.auth.id = id).";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not update profile.";
        }
         console.warn("[Update Profile Action] Update failed, possibly due to permissions. Server actions for user self-updates without admin auth can be tricky. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id' and the client's auth context is correctly used by pbGlobal here.");
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
    return { referrerName: null, error: "User not authenticated or user context not available to server action." };
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
   const currentAuthUserId = pbGlobal.authStore.model?.id;
   if (!currentAuthUserId) {
    const authErrorMessage = "User not authenticated or user ID not available to server action. Please ensure you are logged in.";
    console.warn("[Update Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId;
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId} using user's auth context.`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal); // Use pbGlobal for user self-update
    console.log(`[Update Avatar Action] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Update Avatar Action Error] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this avatar.";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not update avatar.";
        }
        console.warn("[Update Avatar Action] Update failed, possibly due to permissions. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id'.");
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
    console.warn("[Remove Avatar Action] pbGlobal.authStore.model.id is null for server action.", authErrorMessage);
    return { success: false, message: authErrorMessage, error: "Authentication required or user context missing." };
  }
  const userId = currentAuthUserId;
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId} using user's auth context.`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal); // Use pbGlobal for user self-update
    console.log(`[Remove Avatar Action] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[Remove Avatar Action Error] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to remove this avatar.";
        } else if (error.status === 404) {
           errorMessage = "User not found. Could not remove avatar.";
        }
        console.warn("[Remove Avatar Action] Removal failed, possibly due to permissions. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id'.");
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  console.log("[Add Question Action] Attempting to add question.");
  console.log("[Add Question Action] Received form data keys:", Array.from(formData.keys()));

  // Relying on client-side check in admin-panel/layout.tsx and PocketBase collection rule
  // PocketBase rule for question_bank.createRule should be: @request.auth.id != "" && @request.auth.role = "Admin"
  
  try {
    // The pbGlobal instance, when used in a server action initiated by an authenticated client,
    // should carry the client's auth token. PocketBase will then verify permissions based on this token and collection rules.
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log("[Add Question Action] Question added successfully to PocketBase:", newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error("[Add Question Action] Error adding question to PocketBase:", error);
    let errorMessage = "Failed to add question.";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error("[Add Question Action] PocketBase ClientResponseError details:", JSON.stringify(error.data, null, 2));
      
      if (error.data?.data) { 
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }
      
      if (error.status === 403) { 
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure your account has the 'Admin' role and your PocketBase collection rules allow it.";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors}`;
      } else if (error.data?.message) {
        errorMessage = error.data.message; 
      } else if (error.status === 0) {
         errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status.";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status})`;
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
  
  let adminPb;
  try {
    adminPb = await requirePocketBaseAdmin(); // This will throw if admin auth fails
  } catch (adminError) {
    console.error('[Get Live Referral Stats Action] Failed to get admin client:', adminError);
    return { success: false, message: (adminError as Error).message || "Admin client initialization failed. Check server logs.", error: "Admin auth missing" };
  }

  const currentAuthUser = pbGlobal.authStore.model;
  if (!currentAuthUser || !currentAuthUser.id || !currentAuthUser.referralCode) {
    console.warn("[Get Live Referral Stats Action] No authenticated user or referral code found on pbGlobal.authStore.model.");
    // Attempt to fetch current user details if pbGlobal.authStore is not populated server-side as expected
    let currentUserDetails;
    if (pbGlobal.authStore.isValid && pbGlobal.authStore.model?.id) { // Check if there's at least an ID
        try {
            currentUserDetails = await adminPb.collection('users').getOne(pbGlobal.authStore.model.id);
             if (!currentUserDetails.referralCode) {
                return { success: false, message: "Current user does not have a referral code.", error: "User referral code missing" };
            }
        } catch(fetchErr) {
             console.error("[Get Live Referral Stats Action] Could not fetch current user details even with ID:", fetchErr);
             return { success: false, message: "User not authenticated or no referral code available.", error: "User auth/referral code missing" };
        }
    } else {
        return { success: false, message: "User not authenticated or no referral code available.", error: "User auth/referral code missing" };
    }
    // This block might be redundant if pbGlobal.authStore.model is reliably populated server-side
    // For now, let's assume it might not be and the adminPb fetch above is the source of current user data if needed.
    // The logic below uses currentAuthUser, which would be null here.
    // This needs currentAuthUser to be populated, or use currentUserDetails from adminPb.
    // For simplicity, let's assume currentAuthUser from pbGlobal if the server action context provides it.
    // This is a known complexity with server actions and global auth state.
    // A robust solution might involve the client passing its user ID if pbGlobal.authStore is not reliable server-side.
     return { success: false, message: "User not authenticated or no referral code available for current user context.", error: "User auth/referral code missing" };
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
          // Optionally count unknown or other models if needed
          break;
      }
    });
    console.log('[Get Live Referral Stats Action] Successfully calculated stats:', liveStats);
    return { success: true, stats: liveStats };

  } catch (error) {
    console.error("[Get Live Referral Stats Action] Error fetching or calculating stats:", error);
    let errorMessage = "Failed to calculate live referral stats.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}