
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase'; // Use a different name to avoid conflict with local instance
import PocketBase, { ClientResponseError } from 'pocketbase'; // Import PocketBase class for local admin instance
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';


// Helper function to get an admin-authenticated PocketBase instance
async function getAdminPb() {
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
      throw new Error("Could not authenticate admin for server action.");
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
    // Use global pb for reads if it doesn't require special auth for this lookup
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      // Don't show "Invalid referral code" here, as per user request
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
  const adminPb = await getAdminPb(); // Get admin client for potential updates later

  if (referredByCodeInput && referredByCodeInput.trim() !== '') {
    const upperCaseReferredByCode = referredByCodeInput.trim().toUpperCase();
    actualReferredByCodeForNewUser = upperCaseReferredByCode; // Save what user entered (uppercased)
    try {
      // Validate if the code belongs to an actual user
      referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPb);
    } catch (e) {
      console.warn("Error looking up referral code during signup (this should not fail signup):", e);
      // Referrer not found or error, but signup proceeds with the entered code saved
      referrerToUpdateStats = null;
    }
  }


  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();
    const avatarFallback = name.charAt(0).toUpperCase();
    // PocketBase generates its own avatar file names. We don't set avatarUrl directly at creation.
    // Initial avatar will be null/empty, placeholder logic on client handles display.

    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      name: combinedName,
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      // avatarUrl: undefined, // Let PocketBase handle this. It's a file field.
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

    const newUser = await createUserInPocketBase(userDataForPocketBase, adminPb); // Use admin client for creation

    if (newUser && newUser.id && referrerToUpdateStats && referrerToUpdateStats.id) {
      try {
        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
        console.log(`Referral stats updated for referrer: ${referrerToUpdateStats.name}`);
      } catch (statsError) {
        console.error(`Failed to update referral stats for referrer ${referrerToUpdateStats.id}:`, statsError);
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
    } else if (error instanceof Error) {
        genericMessage = error.message || genericMessage;
    } else if (typeof error === 'string') {
        genericMessage = error || genericMessage;
    }
    
    let finalErrorMessage = genericMessage;
    if (specificDetails) {
      if (genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.') {
        finalErrorMessage = `${genericMessage}. Details: ${specificDetails}`;
      } else {
        finalErrorMessage = specificDetails; 
      }
    }
    
    if (!finalErrorMessage.trim()) {
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
    // Use the global pb instance for login, as it's a client-like operation
    const authData = await pbGlobal.collection('users').authWithPassword(email.toLowerCase(), password);

    if (!authData || !authData.record) {
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }

    const user = authData.record as User; 
    const userFullName = user.name || 'User'; 
    const userName = user.name?.split(' ')[0] || 'User'; 
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
    const adminPb = await getAdminPb();
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
    // Use global pb for reads
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
    return { success: false, message: "User not authenticated.", error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`updateUserAvatarAction: Updating avatar for user ID: ${userId}`);

  try {
    const adminPb = await getAdminPb();
    // PocketBase's 'users' collection uses 'avatar' as the default file field name.
    // The formData should contain a file under the key 'avatar'.
    const updatedRecord = await adminPb.collection('users').update(userId, formData);
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
        errorMessage = "User record not found for avatar update. Please ensure you are logged in correctly.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return { success: false, message: "User not authenticated.", error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`removeUserAvatarAction: Removing avatar for user ID: ${userId}`);
  try {
    const adminPb = await getAdminPb();
    const updatedRecord = await adminPb.collection('users').update(userId, { 'avatar': null });
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
        errorMessage = "User record not found for avatar removal. Please ensure you are logged in correctly.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

