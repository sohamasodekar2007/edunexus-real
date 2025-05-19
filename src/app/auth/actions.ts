
// @ts-nocheck
'use server';
import pb from '@/lib/pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { findUserByEmail, createUserInPocketBase, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { ClientResponseError } from 'pocketbase';

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;

  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();
    const avatarUrl = `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`;

    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      name: combinedName,
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      avatarUrl: avatarUrl,
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: referredByCodeInput || null,
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      targetYear: null, 
    };

    const newUser = await createUserInPocketBase(userDataForPocketBase);
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
    const userName = user.name?.split(' ')[0] || 'User'; 

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

  if (classToUpdate !== undefined) { // Allow empty string to clear, or specific class
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
        // Optionally handle invalid year string, though Select should prevent this
        console.warn(`Invalid target year string received: ${targetYearToUpdate}`);
      }
    }
  }
  
  if (Object.keys(dataForPocketBase).length === 0) {
    return { success: true, message: "No changes to save." }; // Or false if you prefer
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
