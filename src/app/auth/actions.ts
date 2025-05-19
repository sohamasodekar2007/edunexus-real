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
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();

    // Prepare data for createUserInPocketBase, ensuring field names match expectations
    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password, // Use 'password' from validated form data
      name: combinedName,
      phone,
      class: userClass,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      avatarUrl: `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`,
      dataAiHint: `${name.charAt(0).toUpperCase()} avatar`,
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
    console.error('Signup Action Error:', error); // Log the full error object
    let errorMessage = 'An unexpected error occurred during signup.';
    
    if (error instanceof ClientResponseError) {
        console.error('PocketBase ClientResponseError details:', JSON.stringify(error.data, null, 2));
        // Try to get a more specific message from PocketBase's response
        const pbErrorData = error.data.data;
        if (pbErrorData) {
            const fieldErrors = Object.keys(pbErrorData).map(key => {
                if (pbErrorData[key] && pbErrorData[key].message) {
                    return `${key}: ${pbErrorData[key].message}`;
                }
                return null;
            }).filter(Boolean).join('; ');
            if (fieldErrors) {
                errorMessage = `Validation issues: ${fieldErrors}`;
            } else if (error.data.message) {
                errorMessage = error.data.message;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    return { success: false, message: `Signup failed: ${errorMessage}`, error: errorMessage };
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

    const user = authData.record;
    const userFullName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(); 

    return { 
      success: true, 
      message: 'Login successful!', 
      token: authData.token, 
      userId: user.id, 
      userFullName: userFullName,
      userName: user.name || userFullName.split(' ')[0], 
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
        if (error.status === 400) { 
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
