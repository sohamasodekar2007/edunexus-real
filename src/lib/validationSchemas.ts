import { z } from 'zod';
import type { UserClass } from '@/types';

export const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

const USER_CLASSES: [UserClass, ...UserClass[]] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];

export const SignupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  surname: z.string().min(2, { message: "Surname must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+$/, { message: "Phone number must contain only digits." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
  class: z.enum(USER_CLASSES, { errorMap: () => ({ message: "Please select a valid class." }) }),
  referralCode: z.string().optional(), // This is the code they enter (referredByCode)
  terms: z.boolean().refine(val => val === true, {message: "You must accept the terms and conditions."})
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"], // Point the error to the confirmPassword field
});

export type SignupFormData = z.infer<typeof SignupSchema>;
