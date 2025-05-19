
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase'; 
import PocketBase, { ClientResponseError } from 'pocketbase'; 
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';


// Helper function to get an admin-authenticated PocketBase instance
async function getAdminPb(): Promise<PocketBase> {
  if (!process.env.POCKETBASE_ADMIN_EMAIL || !process.env.POCKETBASE_ADMIN_PASSWORD) {
    console.error("Admin PB: POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file. Some operations may fail.");
    throw new Error("POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set. Admin operations cannot be performed.");
  }
  const adminPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  // Avoid re-authenticating if already valid and is an admin
  if (adminPb.authStore.isValid && adminPb.authStore.model?.email === process.env.POCKETBASE_ADMIN_EMAIL) {
    // console.log("Admin PB already authenticated");
  } else {
    try {
      // console.log("Attempting to authenticate admin PB");
      await adminPb.admins.authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL!,
        process.env.POCKETBASE_ADMIN_PASSWORD!
      );
      // console.log("Admin PB authenticated successfully");
    } catch (err) {
      console.error("Failed to authenticate admin PocketBase instance:", err);
      const specificError = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not authenticate admin for server action. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file. Details: ${specificError}`);
    }
  }
  return adminPb;
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" }; 
  }
  try {
    const upperCaseCode = code.trim().toUpperCase();
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); // Uses global instance for read
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error('Error validating referral code action:', error);
    return { success: false, message: "Could not validate referral code. Please try again." };
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;

  let referrerToUpdateStats: User | null = null;
  let actualReferredByCodeForNewUser: string | null = null;
  
  if (referredByCodeInput && referredByCodeInput.trim() !== '') {
    const upperCaseReferredByCode = referredByCodeInput.trim().toUpperCase();
    actualReferredByCodeForNewUser = upperCaseReferredByCode; 
    try {
      // Validate if the code belongs to an actual user using global PB for read
      referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal);
    } catch (e) {
      console.warn("Error looking up referral code during signup (this should not fail signup):", e);
      referrerToUpdateStats = null;
    }
  }

  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();
    
    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      name: combinedName,
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: actualReferredByCodeForNewUser, 
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null, 
    };

    // Create new user using the global, unauthenticated pbGlobal instance.
    // This relies on PocketBase's users collection createRule being public (which is default for auth collections).
    const newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal); 

    if (newUser && newUser.id && referrerToUpdateStats && referrerToUpdateStats.id) {
      try {
        const adminPbForReferrerUpdate = await getAdminPb(); // Admin auth IS needed to update another user's record
        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPbForReferrerUpdate);
        console.log(`Referral stats updated for referrer: ${referrerToUpdateStats.name}`);
      } catch (statsError) {
        console.error(`Failed to update referral stats for referrer ${referrerToUpdateStats.id} (Admin Auth might be missing or failed):`, statsError);
        // Signup still considered successful even if referrer update fails.
      }
    }
    
    return { success: true, message: 'Signup successful! Please log in.', userId: newUser.id };

  } catch (error) {
    console.error('Signup Action Error (Full Error Object):', error); 
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.'; 

    if (error instanceof ClientResponseError) {
        console.error('PocketBase ClientResponseError details (error.data):', JSON.stringify(error.data, null, 2));
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

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(email.toLowerCase(), password);

    if (!authData || !authData.record) {
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }

    const user = authData.record as User; 
    const userFullName = user.name || 'User'; 
    const avatarUrl = user.avatar ? pbGlobal.getFileUrl(user, user.avatar as string) : null;

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
    console.error('Login Action Error:', error);
    let errorMessage = 'Invalid email or password.';
     if (error instanceof ClientResponseError) {
        const pbErrorData = error.data?.data;
        if (error.status === 400) { 
          if (pbErrorData && Object.keys(pbErrorData).length > 0) {
             errorMessage = Object.values(pbErrorData).map((err: any) => err.message).join(' ');
          } else {
            errorMessage = error.data?.message || 'Invalid email or password. Please try again.';
          }
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to the server. Please check your internet connection and the server status.";
        } else {
            errorMessage = error.data?.message || 'An error occurred during login.';
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
  console.log(`updateUserProfileAction: Attempting to update user with ID: ${userId}`);
  if (!userId) {
    return { success: false, message: "User ID is required.", error: "User ID missing" };
  }
  
  // IMPORTANT: Without admin authentication or passing the user's own auth token,
  // this action will likely fail due to PocketBase's updateRule (e.g., "@request.auth.id = id").
  // The global pbGlobal instance used by default in updateUserInPocketBase is unauthenticated on the server.
  // For this to work for user self-updates without admin, this server action would need
  // to be authenticated as the user (e.g., by passing and using their auth token).
  console.warn("updateUserProfileAction: This action is attempting to update user data without specific user authentication or admin rights. It may fail due to PocketBase permissions.");

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
        console.warn(`Invalid target year string received: ${targetYearToUpdate}`);
      }
    }
  }
  
  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." }; 
  }

  try {
    // Attempting update with pbGlobal (likely unauthenticated for this specific user on server)
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    return { success: true, message: "Profile update attempt successful (verify in DB)!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error('Update User Profile Action Error:', error);
    let errorMessage = "Failed to update profile.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to the server while updating profile.";
        } else if (error.status === 403 || error.status === 401) {
          errorMessage = "Permission denied. You may not have rights to update this profile. (This is expected if not using admin auth or user-specific auth in server action).";
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

  try {
    const currentUser = await findUserById(currentUserId, pbGlobal); // Read with global is fine
    if (currentUser && currentUser.referredByCode) {
      const referrer = await findUserByReferralCode(currentUser.referredByCode.toUpperCase(), pbGlobal); // Read with global
      if (referrer) {
        return { referrerName: referrer.name };
      } else {
        console.warn(`Current user ${currentUserId} has referredByCode ${currentUser.referredByCode}, but referrer not found.`);
        return { referrerName: null, error: "Referrer details not found." };
      }
    }
    return { referrerName: null }; 
  } catch (error) {
    console.error('Error fetching referrer info for current user:', error);
    return { referrerName: null, error: "Could not fetch referrer information." };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return { success: false, message: "User not authenticated for avatar update.", error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`updateUserAvatarAction: Updating avatar for user ID: ${userId}`);
  
  // IMPORTANT: Similar to updateUserProfileAction, this will likely fail
  // due to PocketBase permissions if pbGlobal is used without admin or user-specific auth.
  console.warn("updateUserAvatarAction: This action is attempting to update user avatar without specific user authentication or admin rights. It may fail due to PocketBase permissions.");

  try {
    // Attempting update with pbGlobal
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    return { success: true, message: "Avatar update attempt successful (verify in DB)!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error('Update User Avatar Action Error:', error);
    let errorMessage = "Failed to update avatar.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
       if (error.status === 404) {
        errorMessage = "User record not found for avatar update.";
      } else if (error.status === 403 || error.status === 401) {
        errorMessage = "Permission denied. You may not have rights to update this avatar. (This is expected if not using admin auth or user-specific auth in server action).";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while updating avatar.";
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
  console.log(`removeUserAvatarAction: Removing avatar for user ID: ${userId}`);

  // IMPORTANT: Similar to updateUserProfileAction, this will likely fail
  // due to PocketBase permissions if pbGlobal is used without admin or user-specific auth.
  console.warn("removeUserAvatarAction: This action is attempting to remove user avatar without specific user authentication or admin rights. It may fail due to PocketBase permissions.");

  try {
    // Attempting update with pbGlobal
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    return { success: true, message: "Avatar removal attempt successful (verify in DB)!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error('Remove User Avatar Action Error:', error);
    let errorMessage = "Failed to remove avatar.";
     if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
      if (error.status === 404) {
        errorMessage = "User record not found for avatar removal.";
      } else if (error.status === 403 || error.status === 401) {
        errorMessage = "Permission denied. You may not have rights to remove this avatar. (This is expected if not using admin auth or user-specific auth in server action).";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while removing avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}
