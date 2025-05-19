
// @ts-nocheck
'use server';
import type PocketBaseClient from 'pocketbase'; // Use type import for PocketBase
import pbGlobal from './pocketbase'; // The global, potentially unauthenticated instance
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { ClientResponseError } from 'pocketbase';

// Default to global pb instance if no specific instance is provided
export async function findUserByEmail(email: string, pbInstance: PocketBaseClient = pbGlobal): Promise<User | null> {
  try {
    const record = await pbInstance.collection('users').getFirstListItem(`email="${email.toLowerCase()}"`);
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
      avatar: record.avatar, // Keep the raw avatar field name
      avatarUrl: record.avatar ? pbInstance.getFileUrl(record, record.avatar) : null,
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

export async function createUserInPocketBase(
  userData: Omit<User, 'id' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'username' | 'verified' | 'avatarUrl' | 'avatar'> & { password?: string },
  pbInstance: PocketBaseClient = pbGlobal // Expect an admin-authenticated instance for creation
): Promise<User> {
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
      // avatar field is for file upload, not URL. PocketBase handles file storage.
      // avatarUrl is derived, not stored directly.
      totalPoints: userData.totalPoints || 0,
      targetYear: userData.targetYear,
      referralCode: userData.referralCode, 
      referredByCode: userData.referredByCode, 
      referralStats: userData.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
      emailVisibility: true, 
      verified: false, 
    };

    const record = await pbInstance.collection('users').create(dataForPocketBase);

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
      avatar: record.avatar,
      avatarUrl: record.avatar ? pbInstance.getFileUrl(record, record.avatar) : null,
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

export async function findUserById(id: string, pbInstance: PocketBaseClient = pbGlobal): Promise<User | null> {
  try {
    const record = await pbInstance.collection('users').getOne(id);
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
      avatar: record.avatar,
      avatarUrl: record.avatar ? pbInstance.getFileUrl(record, record.avatar) : null,
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

export async function updateUserInPocketBase(
  userId: string, 
  data: Partial<Pick<User, 'class' | 'targetYear' | 'referralStats' | 'avatar'>>, // 'avatar' can be FormData for upload or null for removal
  pbInstance: PocketBaseClient = pbGlobal // Expect an admin-authenticated instance for updates
): Promise<User> {
  console.log(`userDataService.updateUserInPocketBase: Updating user ID: ${userId} with data:`, data);
  try {
    // If data contains 'avatar' and it's FormData, it's an upload.
    // If data contains 'avatar' and it's null, it's a removal.
    // Otherwise, it's a regular field update.
    const record = await pbInstance.collection('users').update(userId, data);
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
      avatar: record.avatar,
      avatarUrl: record.avatar ? pbInstance.getFileUrl(record, record.avatar) : null,
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
       if (error.status === 404) {
         console.error(`userDataService.updateUserInPocketBase: User ID ${userId} not found in PocketBase.`);
       }
    }
    throw error;
  }
}


export async function findUserByReferralCode(referralCode: string, pbInstance: PocketBaseClient = pbGlobal): Promise<User | null> {
  if (!referralCode || referralCode.trim() === '') return null;
  try {
    const record = await pbInstance.collection('users').getFirstListItem(`referralCode="${referralCode.trim()}"`);
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
      avatar: record.avatar,
      avatarUrl: record.avatar ? pbInstance.getFileUrl(record, record.avatar) : null,
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
    return null;
  }
}

export async function updateUserReferralStats(userId: string, newStats: User['referralStats'], pbInstance: PocketBaseClient = pbGlobal): Promise<User | null> {
  try {
    const updatedRecord = await pbInstance.collection('users').update(userId, { referralStats: newStats });
    // Map to User type if needed, or just return the record
    return {
        id: updatedRecord.id,
        email: updatedRecord.email,
        name: updatedRecord.name,
        phone: updatedRecord.phone,
        class: updatedRecord.class as UserClass,
        model: updatedRecord.model as UserModel,
        role: updatedRecord.role as UserRole,
        expiry_date: updatedRecord.expiry_date,
        created: updatedRecord.created,
        updated: updatedRecord.updated,
        avatar: updatedRecord.avatar,
        avatarUrl: updatedRecord.avatar ? pbInstance.getFileUrl(updatedRecord, updatedRecord.avatar) : null,
        totalPoints: updatedRecord.totalPoints,
        targetYear: updatedRecord.targetYear,
        referralCode: updatedRecord.referralCode,
        referredByCode: updatedRecord.referredByCode,
        referralStats: updatedRecord.referralStats,
        collectionId: updatedRecord.collectionId,
        collectionName: updatedRecord.collectionName,
        username: updatedRecord.username,
        verified: updatedRecord.verified,
    };
  } catch (error) {
    console.error(`Error updating referral stats for user ${userId}:`, error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details for referral stats update:', JSON.stringify(error.data));
    }
    throw error; 
  }
}
