// @ts-nocheck
'use server';
import pb from '@/lib/pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { findUserByEmail, createUserInPocketBase } from '@/lib/userDataService';
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
    // PocketBase's create action will handle email uniqueness check.
    // const existingUser = await findUserByEmail(email); // This check is redundant if createRule is robust in PB
    // if (existingUser) {
    //   return { success: false, message: 'User already exists with this email.', error: 'User already exists with this email.' };
    // }

    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();

    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password_signup: password, // Pass the raw password for PocketBase to hash
      name: combinedName,
      surname, // Not directly in PB schema, but useful for other parts if needed, otherwise remove
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0], // Format YYYY-MM-DD
      avatarUrl: `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`,
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
    console.error('Signup Action Error:', error);
    let errorMessage = 'An unexpected error occurred during signup.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    // Check for PocketBase specific errors if possible
    if (error instanceof ClientResponseError) {
        const pbErrorData = error.data.data;
        if (pbErrorData?.email?.message) {
            errorMessage = pbErrorData.email.message;
        } else if (error.data?.message) {
            errorMessage = error.data.message;
        }
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function loginUserAction(data: { email: string, password_login: string }): Promise<{ 
  success: boolean; 
  message: string; 
  error?: string; 
  userId?: string, 
  userFullName?: string, 
  userModel?: UserModel | null, 
  userRole?: UserRole | null, 
  userClass?: UserClass | null, 
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: number | null,
  userReferralCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userName?: string // For dashboard greeting
  token?: string // PocketBase auth token
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

    const user = authData.record;
    const userFullName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(); // PocketBase might use 'name' or split first/last

    return { 
      success: true, 
      message: 'Login successful!', 
      token: authData.token, // Important for subsequent authenticated requests
      userId: user.id, 
      userFullName: userFullName,
      userName: user.name || userFullName.split(' ')[0], // Get first name for greeting
      userModel: user.model as UserModel || null,
      userRole: user.role as UserRole || null,
      userClass: user.class as UserClass || null,
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
        if (error.status === 400) { // PocketBase often returns 400 for failed auth
            errorMessage = 'Invalid email or password. Please try again.';
        } else {
            errorMessage = error.data?.message || 'An error occurred during login.';
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}
