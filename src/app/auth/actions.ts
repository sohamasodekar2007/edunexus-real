
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
    const avatarUrl = `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`;
    // dataAiHint is for client-side image hints, not stored in PocketBase user record directly unless schema supports it.

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
      targetYear: null, // Assuming not collected at signup currently
    };

    const newUser = await createUserInPocketBase(userDataForPocketBase);
    return { success: true, message: 'Signup successful! Please log in.', userId: newUser.id };

  } catch (error) {
    console.error('Signup Action Error (Full Error Object):', error); // Logs the entire error object

    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.'; // Default

    if (error instanceof ClientResponseError) {
        // Log the structured PocketBase error data if available
        console.error('PocketBase ClientResponseError details (error.data):', JSON.stringify(error.data, null, 2));
        
        // Use PocketBase's top-level message as the generic message if available
        genericMessage = error.data?.message || genericMessage; 

        const pbFieldErrors = error.data?.data; // This is where field-specific errors usually are
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
      // Prepend generic message if it's not too generic, or just use details if generic is unhelpful
      if (genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.') {
        finalErrorMessage = `${genericMessage}. Details: ${specificDetails}`;
      } else {
        finalErrorMessage = specificDetails; // Prioritize specific field errors if the generic one is too vague
      }
    }
    
    // Ensure a fallback if everything somehow ends up empty
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
  userName?: string, // This was intended for first name
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

    const user = authData.record as User; // Cast to User type
    const userFullName = user.name || 'User'; 
    const userName = user.name?.split(' ')[0] || 'User'; // First part of full name or fallback

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
