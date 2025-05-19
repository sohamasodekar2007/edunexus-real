
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase'; 
import PocketBase, { ClientResponseError } from 'pocketbase'; 
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';


// Helper function to get an admin-authenticated PocketBase instance
async function getAdminPb(): Promise<PocketBase | null> { // Modified to return null on failure
  if (!process.env.POCKETBASE_ADMIN_EMAIL || !process.env.POCKETBASE_ADMIN_PASSWORD) {
    const errorMessage = "POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env file. Admin-specific operations (like updating referrer stats) cannot be performed.";
    console.warn("Admin PB Init Warning:", errorMessage); // Use warn, as it's not blocking core signup
    return null; // Return null instead of throwing, so core operations can proceed
  }
  const adminPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  try {
    await adminPb.admins.authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL!,
      process.env.POCKETBASE_ADMIN_PASSWORD!
    );
    // console.log("Admin PB authenticated successfully for an operation.");
    return adminPb;
  } catch (err) {
    console.error("Failed to authenticate admin PocketBase instance for an operation:", err);
    const specificError = err instanceof Error ? err.message : String(err);
    let clientErrorMessage = `Could not authenticate admin for a sub-operation. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file. Details: ${specificError}`;
    if (err instanceof ClientResponseError && err.status === 400) {
      clientErrorMessage = "Admin authentication failed for a sub-operation: Invalid admin email or password. Please check POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in your .env file.";
    }
    console.warn("Admin Auth Failure (sub-operation):", clientErrorMessage); // Warn, not error, as core signup might still work
    return null; // Return null on failure
  }
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    return { success: false, message: "" }; 
  }
  try {
    const upperCaseCode = code.trim().toUpperCase();
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
  let referrerToUpdateStats: User | null = null;
  
  if (upperCaseReferredByCode && upperCaseReferredByCode !== '') {
    try {
      referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal);
    } catch (e) {
      console.warn("Error looking up referral code during signup (this should not fail signup, but referrer might not get points):", e);
      referrerToUpdateStats = null;
    }
  }

  try {
    // Create new user with the global (potentially unauthenticated) PocketBase instance
    // This relies on the public createRule of the 'users' collection
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
      referredByCode: upperCaseReferredByCode || null, 
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null, 
      avatar: null, // PocketBase handles avatar field, no need to set avatarUrl directly here
    };
    
    // Use pbGlobal for creating the user, relying on public create rules
    const newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal); 

    // If a valid referrer was found, ATTEMPT to update their stats using admin credentials
    // This part is now optional and depends on admin credentials being set in .env
    if (newUser && newUser.id && referrerToUpdateStats && referrerToUpdateStats.id) {
      const adminPb = await getAdminPb(); // Attempt to get admin-authenticated PB
      if (adminPb) { // Only proceed if admin auth was successful
        try {
          const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
          const newReferrerStats: User['referralStats'] = {
            ...currentStats,
            referred_free: (currentStats.referred_free || 0) + 1,
          };
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
          console.log(`Referral stats updated for referrer: ${referrerToUpdateStats.name}`);
        } catch (statsError) {
          console.error(`Failed to update referral stats for referrer ${referrerToUpdateStats.id} (Admin Auth might be missing or failed, or other error):`, statsError);
          // Do not let this error block the main signup success message
        }
      } else {
        console.warn(`Admin PB instance not available for updating referrer stats. Referrer ${referrerToUpdateStats.name} will not have stats updated for this signup.`);
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
    } else if (error instanceof Error) { // Catch other generic errors
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
  userName?: string, // This was intended to be full name previously, ensure consistency
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
  userAvatarUrl?: string | null, // URL for the avatar
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
    const avatarFilename = user.avatar; // This is the filename string from PocketBase
    const avatarUrl = avatarFilename ? pbGlobal.getFileUrl(user, avatarFilename as string) : null;


    return { 
      success: true, 
      message: 'Login successful!', 
      token: authData.token, 
      userId: user.id, 
      userFullName: userFullName,
      userName: userFullName, // Consistent: userName is full name
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
      userAvatarUrl: avatarUrl, // Pass the derived URL
    };

  } catch (error) {
    console.error('Login Action Error:', error);
    let errorMessage = 'Invalid email or password.'; 
     if (error instanceof ClientResponseError) {
        if (error.status === 400) { // Specifically for failed authentication
           errorMessage = 'Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
        console.error('PocketBase Login Error Details:', JSON.stringify(error.data));
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
         dataForPocketBase.targetYear = null; 
      }
    }
  }
  
  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." }; 
  }

  try {
    const adminPb = await getAdminPb();
    if (!adminPb) {
      // If admin auth fails or isn't configured, attempt update with global/unauthenticated client.
      // This will rely on PocketBase rule `@request.auth.id = id` if the client has the user's token.
      // However, server actions don't carry client tokens by default.
      // For user self-updates, this should ideally be a client-side call or pass auth token.
      console.warn(`Admin PB not available for updateUserProfileAction. Attempting update with global PB instance for user ${userId}. This might fail due to permissions if PocketBase rule is '@request.auth.id = id' and server action is unauthenticated.`);
      const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal); // Attempt with global
      return { success: true, message: "Profile update attempted (check permissions if it didn't save)!", updatedUser: updatedUserRecord };
    }
    // If admin auth is available, use it.
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, adminPb);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
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
        } else if (error.status === 404) {
          errorMessage = "User not found. Could not update profile.";
        } else if (error.status === 403) {
           errorMessage = "Permission denied. You might not have rights to update this profile.";
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
    const currentUser = await findUserById(currentUserId, pbGlobal); 
    if (currentUser && currentUser.referredByCode) {
      const referrer = await findUserByReferralCode(currentUser.referredByCode.toUpperCase(), pbGlobal); 
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
  
  try {
    const adminPb = await getAdminPb(); 
    if (!adminPb) {
      console.warn(`Admin PB not available for updateUserAvatarAction. Attempting avatar update with global PB instance for user ${userId}. This might fail due to permissions.`);
       const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
       return { success: true, message: "Avatar update attempted (check permissions if it didn't save)!", updatedUserRecord: updatedRecord };
    }
    const updatedRecord = await updateUserInPocketBase(userId, formData, adminPb);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
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
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while updating avatar.";
      } else if (error.status === 403) {
        errorMessage = "Permission denied. You might not have rights to update this avatar.";
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

  try {
    const adminPb = await getAdminPb(); 
    if (!adminPb) {
      console.warn(`Admin PB not available for removeUserAvatarAction. Attempting avatar removal with global PB instance for user ${userId}. This might fail due to permissions.`);
      const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
      return { success: true, message: "Avatar removal attempted (check permissions if it didn't save)!", updatedUserRecord: updatedRecord };
    }
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, adminPb);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
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
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to the server while removing avatar.";
      } else if (error.status === 403) {
        errorMessage = "Permission denied. You might not have rights to remove this avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

