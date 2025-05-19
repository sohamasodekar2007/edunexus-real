
// @ts-nocheck
'use server';
import pb from '@/lib/pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { ClientResponseError } from 'pocketbase';

export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  if (!code || code.trim().length === 0) {
    // Optionally, don't return error for empty, let UI handle it or return a specific non-error state
    return { success: false, message: "" }; // Silent failure for empty string for better UX on blur
  }
  try {
    const referrer = await findUserByReferralCode(code.trim());
    if (referrer) {
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      return { success: false, message: "Invalid referral code. Please use another one." };
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

  let referrer: User | null = null;
  if (referredByCodeInput && referredByCodeInput.trim() !== '') {
    try {
      referrer = await findUserByReferralCode(referredByCodeInput.trim());
      if (!referrer) {
        return { success: false, message: "Invalid referral code provided. Please check the code and try again.", error: "Invalid referral code." };
      }
    } catch (e) {
      console.error("Error checking referral code during signup:", e);
      return { success: false, message: "Could not verify referral code. Please try again or sign up without one.", error: "Referral code verification failed." };
    }
  }

  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();
    // Generate avatar using first letter of first name
    const avatarFallback = name.charAt(0).toUpperCase();
    const avatarUrl = `https://placehold.co/100x100.png?text=${avatarFallback}`;

    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      name: combinedName,
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0], // ~78 years for "lifetime"
      avatarUrl: avatarUrl,
      totalPoints: 0,
      referralCode: newUserReferralCode, // New user's own code
      referredByCode: referrer ? referrer.referralCode : null, // Store the code they used
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null, 
    };

    const newUser = await createUserInPocketBase(userDataForPocketBase);

    // If signup was successful and a valid referrer exists, update their stats
    if (newUser && newUser.id && referrer && referrer.id) {
      try {
        const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        await updateUserReferralStats(referrer.id, newReferrerStats);
        console.log(`Referral stats updated for referrer: ${referrer.name}`);
      } catch (statsError) {
        console.error(`Failed to update referral stats for referrer ${referrer.id}:`, statsError);
        // Do not fail the main signup if updating referrer stats fails, but log it.
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
  userName?: string, // This is usually first name
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
  token?: string 
}> {
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }
  
  const { email, password } = validation.data;

  try {
    const authData = await pb.collection('users').authWithPassword(email.toLowerCase(), password);

    if (!authData || !authData.record) {
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }

    const user = authData.record as User; 
    const userFullName = user.name || 'User'; 
    const userName = user.name?.split(' ')[0] || 'User'; // Typically first name

    return { 
      success: true, 
      message: 'Login successful!', 
      token: authData.token, 
      userId: user.id, 
      userFullName: userFullName,
      userName: userName, // First name
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
    };

  } catch (error) {
    console.error('Login Action Error:', error);
    let errorMessage = 'Invalid email or password.';
     if (error instanceof ClientResponseError) {
        if (error.status === 400) { 
            errorMessage = error.data?.message || 'Invalid email or password. Please try again.';
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
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error('Update User Profile Action Error:', error);
    let errorMessage = "Failed to update profile.";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      if (error.data?.data) {
        const fieldErrors = Object.entries(error.data.data).map(([key, val]) => `${key}: ${val.message}`).join('; ');
        errorMessage += ` Details: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    return { referrerName: null, error: "User not authenticated." };
  }
  const currentUserId = pb.authStore.model.id;

  try {
    const currentUser = await findUserById(currentUserId);
    if (currentUser && currentUser.referredByCode) {
      const referrer = await findUserByReferralCode(currentUser.referredByCode);
      if (referrer) {
        return { referrerName: referrer.name };
      } else {
        // This case should ideally not happen if referredByCode was validated at signup
        console.warn(`Current user ${currentUserId} has referredByCode ${currentUser.referredByCode}, but referrer not found.`);
        return { referrerName: null, error: "Referrer details not found." };
      }
    }
    return { referrerName: null }; // No referral code used by current user
  } catch (error) {
    console.error('Error fetching referrer info for current user:', error);
    return { referrerName: null, error: "Could not fetch referrer information." };
  }
}
