// @ts-nocheck
'use server'; // Corrected: This file defines Server Actions.
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { hashPassword, verifyPassword, generateReferralCode } from '@/lib/authUtils';
import { findUserByEmail, saveUser } from '@/lib/userDataService';
import type { User } from '@/types';
import { randomUUID } from 'crypto'; // Node.js built-in for UUID

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return { success: false, message: 'User already exists with this email.', error: 'User already exists with this email.' };
    }

    const hashedPassword = await hashPassword(password);
    const newUserReferralCode = generateReferralCode();

    const newUser: User = {
      id: randomUUID(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      surname,
      phone,
      class: userClass,
      model: 'Free', // Default model
      role: 'User', // Default role
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString(), // Default: 2099-12-31
      createdAt: new Date().toISOString(),
      avatarUrl: `https://placehold.co/100x100.png?text=${name.charAt(0).toUpperCase()}`, // Placeholder avatar using first letter of first name
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: referredByCodeInput || null,
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
      },
      // Optional fields can be null or undefined
      targetYear: null,
      telegramId: null,
      telegramUsername: null,
    };

    await saveUser(newUser);
    return { success: true, message: 'Signup successful! Please log in.', userId: newUser.id };

  } catch (error) {
    console.error('Signup Action Error:', error);
    return { success: false, message: (error as Error).message || 'An unexpected error occurred during signup.', error: (error as Error).message };
  }
}

export async function loginUserAction(data: { email: string, password_login: string }): Promise<{ success: boolean; message: string; error?: string; userId?: string, userName?: string }> {
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login}); // map password_login to password for validation
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }
  
  const { email, password } = validation.data;

  try {
    const user = await findUserByEmail(email);
    if (!user || !user.password) {
      return { success: false, message: 'Invalid email or password.', error: 'Invalid email or password.'  };
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid email or password.', error: 'Invalid email or password.' };
    }

    // IMPORTANT: In a real app, you would set up a session here (e.g., using cookies, JWT)
    // For this prototype, we just return success.
    return { success: true, message: 'Login successful!', userId: user.id, userName: user.name };

  } catch (error) {
    console.error('Login Action Error:', error);
    return { success: false, message: (error as Error).message || 'An unexpected error occurred during login.', error: (error as Error).message };
  }
}
