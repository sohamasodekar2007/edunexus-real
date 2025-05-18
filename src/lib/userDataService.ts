// @ts-nocheck
'use server';
import fs from 'fs/promises';
import path from 'path';
import type { User } from '@/types';

// Path to the users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'users.json');

async function readUsersFromFile(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf-8');
    return JSON.parse(data) as User[];
  } catch (error) {
    // If the file doesn't exist or is empty, return an empty array
    if (error.code === 'ENOENT') {
      await fs.writeFile(USERS_FILE_PATH, JSON.stringify([])); // Create file if not exists
      return [];
    }
    console.error('Error reading users from file:', error);
    throw new Error('Could not read user data.');
  }
}

async function writeUsersToFile(users: User[]): Promise<void> {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users to file:', error);
    throw new Error('Could not save user data.');
  }
}

export async function getUsers(): Promise<User[]> {
  return readUsersFromFile();
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const users = await readUsersFromFile();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

export async function findUserById(id: string): Promise<User | undefined> {
  const users = await readUsersFromFile();
  return users.find(user => user.id === id);
}

export async function saveUser(newUser: User): Promise<User> {
  const users = await readUsersFromFile();
  
  // Check for email uniqueness before saving (should also be done in the action)
  if (users.some(user => user.email.toLowerCase() === newUser.email.toLowerCase())) {
    throw new Error('Email already exists.');
  }
  
  users.push(newUser);
  await writeUsersToFile(users);
  return newUser;
}

// In a real app, you'd have updateUser, deleteUser, etc.
