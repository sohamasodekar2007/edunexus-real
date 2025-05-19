
// @ts-nocheck
'use server';
import pb from './pocketbase';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { ClientResponseError } from 'pocketbase';

export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const record = await pb.collection('users').getFirstListItem(`email="${email.toLowerCase()}"`);
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      class: record.class as UserClass,
      model: record.model as UserModel,
      role: record.role as UserRole,
      expiry_date: record.expiry_date,
      created: record.created,
      updated: record.updated,
      avatarUrl: record.avatarUrl,
      totalPoints: record.totalPoints,
      targetYear: record.targetYear,
      referralCode: record.referralCode,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      username: record.username,
      verified: record.verified,
    };
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null; 
    }
    console.error('Error finding user by email in PocketBase:', error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details:', JSON.stringify(error.data));
    }
    return null;
  }
}

export async function createUserInPocketBase(userData: Omit<User, 'id' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'username' | 'verified'> & { password?: string }): Promise<User> {
  try {
    const dataForPocketBase = {
      email: userData.email.toLowerCase(),
      password: userData.password, 
      passwordConfirm: userData.password, 
      name: userData.name, 
      phone: userData.phone,
      class: userData.class,
      model: userData.model || 'Free', 
      role: userData.role || 'User',   
      expiry_date: userData.expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0], 
      avatarUrl: userData.avatarUrl,
      totalPoints: userData.totalPoints || 0,
      targetYear: userData.targetYear,
      referralCode: userData.referralCode, // User's own new referral code
      referredByCode: userData.referredByCode, // Code they used to sign up (if any)
      referralStats: userData.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
      emailVisibility: true, 
      verified: false, 
    };

    const record = await pb.collection('users').create(dataForPocketBase);

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      class: record.class as UserClass,
      model: record.model as UserModel,
      role: record.role as UserRole,
      expiry_date: record.expiry_date,
      created: record.created,
      updated: record.updated,
      avatarUrl: record.avatarUrl,
      totalPoints: record.totalPoints,
      targetYear: record.targetYear,
      referralCode: record.referralCode,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      username: record.username,
      verified: record.verified,
    };
  } catch (error) {
    console.error('Error creating user in PocketBase (userDataService):', error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details (userDataService):', JSON.stringify(error.data, null, 2));
    }
    throw error; 
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    const record = await pb.collection('users').getOne(id);
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      class: record.class as UserClass,
      model: record.model as UserModel,
      role: record.role as UserRole,
      expiry_date: record.expiry_date,
      created: record.created,
      updated: record.updated,
      avatarUrl: record.avatarUrl,
      totalPoints: record.totalPoints,
      targetYear: record.targetYear,
      referralCode: record.referralCode,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      username: record.username,
      verified: record.verified,
    };
  } catch (error) {
     if (error instanceof ClientResponseError && error.status === 404) {
      return null; 
    }
    console.error('Error finding user by ID in PocketBase:', error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details:', JSON.stringify(error.data));
    }
    return null;
  }
}

export async function updateUserInPocketBase(userId: string, data: Partial<Pick<User, 'class' | 'targetYear' | 'referralStats' >>): Promise<User> {
  try {
    const record = await pb.collection('users').update(userId, data);
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      class: record.class as UserClass,
      model: record.model as UserModel,
      role: record.role as UserRole,
      expiry_date: record.expiry_date,
      created: record.created,
      updated: record.updated,
      avatarUrl: record.avatarUrl,
      totalPoints: record.totalPoints,
      targetYear: record.targetYear, 
      referralCode: record.referralCode,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      username: record.username,
      verified: record.verified,
    };
  } catch (error) {
    console.error('Error updating user in PocketBase (userDataService):', error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details for update (userDataService):', JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
}


export async function findUserByReferralCode(referralCode: string): Promise<User | null> {
  if (!referralCode || referralCode.trim() === '') return null;
  try {
    const record = await pb.collection('users').getFirstListItem(`referralCode="${referralCode.trim()}"`);
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      class: record.class as UserClass,
      model: record.model as UserModel,
      role: record.role as UserRole,
      expiry_date: record.expiry_date,
      created: record.created,
      updated: record.updated,
      avatarUrl: record.avatarUrl,
      totalPoints: record.totalPoints,
      targetYear: record.targetYear,
      referralCode: record.referralCode,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      username: record.username,
      verified: record.verified,
    };
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null; // Code not found
    }
    // Don't log here as it might be a common case for invalid codes. Let the action log if it's unexpected.
    // console.error('Error finding user by referral code in PocketBase:', error);
    return null;
  }
}

export async function updateUserReferralStats(userId: string, newStats: User['referralStats']): Promise<User | null> {
  try {
    const updatedRecord = await pb.collection('users').update(userId, { referralStats: newStats });
    return updatedRecord as User; // Or map to User type
  } catch (error) {
    console.error(`Error updating referral stats for user ${userId}:`, error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details for referral stats update:', JSON.stringify(error.data));
    }
    throw error; // Rethrow to be caught by the calling action
  }
}
