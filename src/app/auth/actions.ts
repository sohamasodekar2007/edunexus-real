
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

  console.log(`[Admin PB Init] Attempting to get admin PB instance.`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_EMAIL detected: ${adminEmail ? '****' : '[NOT SET]'}`);
  console.log(`[Admin PB Init] POCKETBASE_ADMIN_PASSWORD detected: ${adminPassword ? '[SET]' : '[NOT SET]'}`);


  if (!adminEmail || !adminPassword) {
    const errorMessage = "POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file. Admin-specific operations cannot be performed.";
    console.warn("[Admin PB Init Warning]:", errorMessage);
    return null;
  }

  const adminPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
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
        clientErrorMessage = `Admin authentication failed: Endpoint /api/admins/auth-with-password not found (404). This usually means NEXT_PUBLIC_POCKETBASE_URL in your .env file is incorrect (e.g., includes '/api' or other subpaths, or points to the wrong server/port). It should be the ROOT URL of your PocketBase instance.`;
      } else if (err.status === 400) {
        clientErrorMessage = "Admin authentication failed: Invalid admin email or password. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file and ensure the Next.js server was restarted.";
      } else if (err.status === 0) {
        clientErrorMessage = "Admin authentication failed: Network error. Could not connect to PocketBase server. Check server status and NEXT_PUBLIC_POCKETBASE_URL."
      } else {
        clientErrorMessage = `Admin authentication failed with PocketBase status ${err.status}. Check server logs.`;
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
  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "" }; 
    }
  } catch (error) {
    console.error('Error validating referral code action:', error);
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
  const upperCaseReferredByCode = referredByCodeInput?.trim().toUpperCase();

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
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0], // ~78 years from now
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: upperCaseReferredByCode || null,
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

    console.log("[Signup Action] Attempting to create user with data:", { ...userDataForPocketBase, password: '***' });
    // Use adminPb for creating user to ensure it works even if default rules are tightened later
    const pbInstanceForCreate = await getAdminPb();
    if (!pbInstanceForCreate) {
        // If admin auth fails, try creating with global instance (relies on public create rule)
        console.warn("[Signup Action] Admin PB instance not available for user creation. Attempting with global PB instance. This relies on a public 'users' collection create rule.");
        newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    } else {
        newUser = await createUserInPocketBase(userDataForPocketBase, pbInstanceForCreate);
    }
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

  if (newUser && newUser.id && upperCaseReferredByCode && upperCaseReferredByCode !== '') {
    console.log(`[Signup Action] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    const adminPbForReferrerUpdate = await getAdminPb(); 
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
          console.warn(`[Signup Action] Referrer with code ${upperCaseReferredByCode} not found for stats update, though signup was successful.`);
        }
      } catch (statsError) {
        console.warn(`[Signup Action Warning] Failed to update referral stats. This part requires admin privileges. User signup itself was successful. Error:`, statsError);
      }
    } else {
      console.warn(`[Signup Action Warning] Admin PB instance not available for updating referrer stats (POCKETBASE_ADMIN_EMAIL/PASSWORD likely not set or invalid in .env, or admin auth failed). User signup was successful. Referrer stats not updated.`);
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

    const user = authData.record as User;
    const userFullName = user.name || 'User';
    const avatarFilename = user.avatar; 
    const avatarUrl = avatarFilename ? pbGlobal.getFileUrl(user, avatarFilename as string) : null;


    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userId: user.id,
      userFullName: userFullName,
      userName: userFullName, 
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
        if (error.status === 400) { 
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) { 
          errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
        console.error('[Login Action Error] PocketBase ClientResponseError details:', JSON.stringify(error.data));
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

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Profile update failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted, OR ensure the PocketBase 'users' collection update rule allows user self-updates without admin context.";
    console.warn(`[Update Profile Action] Admin PB instance not available. User: ${userId}. Attempting with global PB instance. This might fail if PocketBase rules require admin or specific user auth for updates from server actions.`);
     try {
        // Attempt with global instance, relying on client-side auth potentially being recognized if PB setup allows
        const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
        console.log(`[Update Profile Action (using global PB)] Profile updated successfully for user ${userId}:`, updatedUserRecord);
        return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
     } catch (globalPbError) {
        console.error(`[Update Profile Action (using global PB) Error] Failed to update profile for user ${userId}:`, globalPbError);
        // Fall through to return a generic error message or the admin auth error message
        return { success: false, message: authErrorMsg, error: "Admin auth missing or update permission denied" };
     }
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
           errorMessage = "Permission denied by PocketBase to update profile.";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return { referrerName: null, error: "User not authenticated." };
  }
  const currentUserId = pbGlobal.authStore.model.id;
  console.log(`[Get Referrer Info Action] Current user ID: ${currentUserId}`);

  try {
    const pbToUseForRead = await getAdminPb() || pbGlobal; 

    const currentUser = await findUserById(currentUserId, pbToUseForRead); 
    if (currentUser && currentUser.referredByCode) {
      console.log(`[Get Referrer Info Action] Current user was referred by code: ${currentUser.referredByCode}`);
      const referrer = await findUserByReferralCode(currentUser.referredByCode.toUpperCase(), pbToUseForRead); 
      if (referrer) {
        console.log(`[Get Referrer Info Action] Found referrer: ${referrer.name}`);
        return { referrerName: referrer.name };
      } else {
        console.warn(`[Get Referrer Info Action] Current user ${currentUserId} has referredByCode ${currentUser.referredByCode}, but referrer not found.`);
        return { referrerName: null, error: "Referrer details not found." };
      }
    }
    console.log(`[Get Referrer Info Action] Current user ${currentUserId} was not referred by anyone or referredByCode is null.`);
    return { referrerName: null };
  } catch (error) {
    console.error('[Get Referrer Info Action Error] Error fetching referrer info:', error);
    let message = "Could not fetch referrer information.";
    if (error instanceof ClientResponseError && error.data?.message?.includes("Admin authentication failed")) {
        message = "Could not fetch referrer information due to admin auth failure. Please check server logs.";
    }
    return { referrerName: null, error: message };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return { success: false, message: "User not authenticated for avatar update.", error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[Update Avatar Action] Updating avatar for user ID: ${userId}`);

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Avatar update failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted, OR ensure PocketBase 'users' collection update rule allows user self-updates for avatar without admin context.";
    console.warn(`[Update Avatar Action] Admin PB instance not available. User: ${userId}. Attempting with global PB. This may fail due to permissions.`);
    try {
        const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
        console.log(`[Update Avatar Action (using global PB)] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
        return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
    } catch (globalPbError) {
         console.error(`[Update Avatar Action (using global PB) Error] Failed to update avatar for user ${userId}:`, globalPbError);
         return { success: false, message: authErrorMsg, error: "Admin auth missing or update permission denied" };
    }
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
        errorMessage = "Permission denied by PocketBase to update avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return { success: false, message: "User not authenticated for avatar removal.", error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[Remove Avatar Action] Removing avatar for user ID: ${userId}`);

  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Avatar removal failed: Admin authentication required for this server action. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted, OR ensure PocketBase 'users' collection update rule allows user self-updates for avatar without admin context.";
    console.warn(`[Remove Avatar Action] Admin PB instance not available. User: ${userId}. Attempting with global PB. This may fail due to permissions.`);
    try {
        const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
        console.log(`[Remove Avatar Action (using global PB)] Avatar removed successfully for user ${userId}.`);
        return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
    } catch (globalPbError) {
        console.error(`[Remove Avatar Action (using global PB) Error] Failed to remove avatar for user ${userId}:`, globalPbError);
        return { success: false, message: authErrorMsg, error: "Admin auth missing or update permission denied" };
    }
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
        errorMessage = "Permission denied by PocketBase to remove avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getAllUsersAction(): Promise<{ success: boolean; users?: Partial<User>[]; message?: string; error?: string }> {
  console.log("[Get All Users Action] Attempting to fetch all users.");
  const adminPb = await getAdminPb();
  if (!adminPb) {
    const authErrorMsg = "Admin authentication required to fetch users. Please ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are correctly set in .env and the server is restarted. The PocketBase 'users' collection listRule requires admin privileges.";
    console.warn("[Get All Users Action] Admin PB instance not available. Cannot fetch all users as per collection rules.");
    return { success: false, message: authErrorMsg, error: "Admin auth missing" };
  }

  try {
    const records = await adminPb.collection('users').getFullList({
      sort: '-created', 
    });
    console.log(`[Get All Users Action] Fetched ${records.length} users.`);

    const users = records.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role as UserRole,
      model: record.model as UserModel,
      created: record.created,
      avatarUrl: record.avatar ? adminPb.getFileUrl(record, record.avatar as string) : null,
    }));

    return { success: true, users };
  } catch (error) {
    console.error("[Get All Users Action Error] Error fetching all users:", error);
    let errorMessage = "Failed to fetch users.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to the server while fetching users.";
      } else if (error.status === 403) { 
           errorMessage = "Permission denied by PocketBase to fetch all users.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

