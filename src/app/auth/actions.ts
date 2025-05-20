
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';


// Helper function to get an admin-authenticated PocketBase instance
async function getAdminPb(): Promise<PocketBase | null> {
  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
  const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  console.log(`[Admin PB Init] Attempting to get admin PB instance.`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_EMAIL detected: ${adminEmail ? '****' : '[NOT SET]'}`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_PASSWORD detected: ${adminPassword ? '[SET]' : '[NOT SET]'}`);
  console.log(`[Admin PB Init] NEXT_PUBLIC_POCKETBASE_URL detected: ${pocketbaseUrl || '[NOT SET]'}`);


  if (!adminEmail || !adminPassword) {
    const errorMessage = "POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file. Admin-specific operations cannot be performed.";
    console.warn("[Admin PB Init Warning]:", errorMessage);
    return null;
  }

  if (!pocketbaseUrl) {
    const errorMessage = "NEXT_PUBLIC_POCKETBASE_URL is not set in .env file. Cannot initialize PocketBase client for admin operations.";
    console.error("[Admin PB Init Error]:", errorMessage);
    return null;
  }

  // Create a new instance for admin auth to avoid interfering with global pb.authStore
  const adminPb = new PocketBase(pocketbaseUrl);
  try {
    await adminPb.admins.authWithPassword(adminEmail, adminPassword);
    console.log("[Admin PB Init] Admin authentication successful.");
    return adminPb;
  } catch (err) {
    console.error("[Admin PB Init Error] Failed to authenticate admin PocketBase instance:", err);
    let clientErrorMessage = "Could not authenticate admin for a server action. Please check server logs.";
    if (err instanceof ClientResponseError) {
      console.error("[Admin PB Init Error] PocketBase ClientResponseError details:", JSON.stringify(err.data, null, 2));
      if (err.status === 404) {
        clientErrorMessage = `Admin authentication failed: Endpoint /api/admins/auth-with-password not found (404). This usually means NEXT_PUBLIC_POCKETBASE_URL in your .env file (current value: ${pocketbaseUrl}) is incorrect. It should be the ROOT URL of your PocketBase instance (e.g., https://your-domain.com or http://127.0.0.1:8090), not including '/api' or other subpaths.`;
      } else if (err.status === 400) {
        clientErrorMessage = "Admin authentication failed: Invalid admin email or password. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file and ensure the Next.js server was restarted.";
      } else if (err.status === 0) {
        clientErrorMessage = "Admin authentication failed: Network error. Could not connect to PocketBase server. Check server status and NEXT_PUBLIC_POCKETBASE_URL."
      } else {
        clientErrorMessage = `Admin authentication failed with PocketBase status ${err.status}. Response: ${JSON.stringify(err.data)}`;
      }
    }
    console.warn("[Admin PB Init Failure]:", clientErrorMessage);
    return null;
  }
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();

  const adminPb = await getAdminPb();
  let pbInstanceToUse = adminPb || pbGlobal; // Fallback to global if admin auth fails, but this find might fail on rules

  if (!adminPb) {
    console.warn("[Validate Referral Action] Admin PB instance not available for validation. Falling back to global instance. This may lead to incorrect validation results if user collection list/view rules are strict.");
  }

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbInstanceToUse);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "Invalid referral code. Please use another one." };
    }
  } catch (error) {
    console.error('Error validating referral code action:', error);
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
    // Use global pb instance for user creation, relying on public create rule
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
    const adminPbForReferrerUpdate = await getAdminPb(); // This is where admin auth is needed
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
      console.warn(`[Signup Action Warning] Admin PB instance not available for updating referrer stats for code ${upperCaseReferredByCode}. New user signup was successful, but referrer stats not updated. Check server logs for admin auth issues detailed by getAdminPb().`);
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
      userName: userName, // For dashboard greeting, first name is usually enough
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
        if (error.status === 400) { // PocketBase often returns 400 for auth failures
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) {
          errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message; // Fallback to generic error message
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

  const adminPb = await getAdminPb();
  if (!adminPb) {
     const authErrorMsg = "Profile update failed: Could not authenticate admin for this server action. Please check server logs for details on the admin authentication failure.";
    console.warn(`[Update Profile Action] Admin PB instance not available. User: ${userId}. Cannot update profile securely. Check server logs for admin auth details. This might fail if the user is trying to update their own profile and PocketBase rules expect user-specific auth.`);
    return { success: false, message: authErrorMsg, error: "Admin authentication failed for server action. Check server logs." };
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

  const currentUserRecord = await findUserById(currentAuthUser.id, pbGlobal); // Use global PB to fetch current user's own record
  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    return { referrerName: null }; // No referredByCode, so no referrer name to fetch
  }

  // Use admin to fetch the referrer's details because there's no guarantee the current user
  // has permission to view other users' records (even just for a name).
  const adminPb = await getAdminPb();
  if (!adminPb) {
    console.warn("[Get Referrer Info Action] Admin PB instance not available to find referrer by code. This might prevent fetching the referrer's name. Check server logs for admin auth details.");
    return { referrerName: null, error: "Could not authenticate admin to fetch referrer details. Check server logs." };
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

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Avatar update failed: Could not authenticate admin for this server action. Please check server logs for details on the admin authentication failure.";
    console.warn(`[Update Avatar Action] Admin PB instance not available. User: ${userId}. Cannot update avatar securely. Check server logs for admin auth details.`);
    return { success: false, message: authErrorMsg, error: "Admin authentication failed for server action. Check server logs." };
  }

  try {
    // formData should directly contain the 'avatar' file field
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

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Avatar removal failed: Could not authenticate admin for this server action. Please check server logs for details on the admin authentication failure.";
    console.warn(`[Remove Avatar Action] Admin PB instance not available. User: ${userId}. Cannot remove avatar securely. Check server logs for admin auth details.`);
    return { success: false, message: authErrorMsg, error: "Admin authentication failed for server action. Check server logs." };
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

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const adminAuthErrorMessage = "Failed to add question: Could not authenticate admin for this server action. Please check server logs for details on the admin authentication failure (e.g., missing/incorrect .env variables POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD, or misconfigured NEXT_PUBLIC_POCKETBASE_URL).";
    console.warn("[Add Question Action] Admin PB instance not available. Detailed error logged by getAdminPb().");
    return { success: false, message: adminAuthErrorMessage, error: "Admin authentication failed for server action. Check server logs." };
  }

  try {
    console.log("[Add Question Action] Attempting to create question record in PocketBase with admin privileges.");
    // Directly pass FormData. PocketBase SDK handles file uploads and field mapping if names match.
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
