// @ts-nocheck
'use server';
import pb from './pocketbase';
import type { User, UserModel, UserRole, UserClass } from '@/types';
import { ClientResponseError } from 'pocketbase';

export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const record = await pb.collection('users').getFirstListItem(`email="${email.toLowerCase()}"`);
    // Map PocketBase record to our User type
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
      return null; // User not found
    }
    console.error('Error finding user by email in PocketBase:', error);
    // It's good to check the actual error object from PocketBase for more details
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details:', JSON.stringify(error.data));
    }
    throw new Error('Could not retrieve user data.');
  }
}

export async function createUserInPocketBase(userData: Omit<User, 'id' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'username' | 'verified'> & { password_signup: string }): Promise<User> {
  try {
    const dataForPocketBase = {
      email: userData.email.toLowerCase(),
      password: userData.password_signup,
      passwordConfirm: userData.password_signup, // PocketBase requires passwordConfirm
      name: userData.name, // Already combined name + surname
      phone: userData.phone,
      class: userData.class,
      model: userData.model || 'Free', // Default model
      role: userData.role || 'User',   // Default role
      expiry_date: userData.expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0], // Default expiry, format YYYY-MM-DD
      avatarUrl: userData.avatarUrl,
      totalPoints: userData.totalPoints || 0,
      targetYear: userData.targetYear,
      referralCode: userData.referralCode,
      referredByCode: userData.referredByCode,
      referralStats: userData.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
      emailVisibility: true, // Default according to PocketBase schema often
      verified: false, // Users usually start as unverified
    };

    const record = await pb.collection('users').create(dataForPocketBase);

    // Map PocketBase record to our User type
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
    console.error('Error creating user in PocketBase:', error);
     if (error instanceof ClientResponseError) {
      console.error('PocketBase error details:', JSON.stringify(error.data));
      // Provide more specific error messages based on PocketBase response
      if (error.data?.data?.email?.code === 'validation_invalid_email' || error.data?.data?.email?.message?.includes('already exists')) {
        throw new Error('Email already exists or is invalid.');
      }
      throw new Error(error.data?.message || 'Could not create user account.');
    }
    throw new Error('Could not create user account.');
  }
}

// Example: Find user by ID (if needed elsewhere)
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
      return null; // User not found
    }
    console.error('Error finding user by ID in PocketBase:', error);
    if (error instanceof ClientResponseError) {
      console.error('PocketBase error details:', JSON.stringify(error.data));
    }
    throw new Error('Could not retrieve user data.');
  }
}
