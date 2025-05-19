// @ts-nocheck
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { signupUserAction, validateReferralCodeAction } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Label is not explicitly used here due to FormLabel
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import type { UserClass } from '@/types';
import { Loader2 } from 'lucide-react'; 

const USER_CLASSES_OPTIONS: UserClass[] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}


export default function SignupPageContent() {
  const router = useRouter();
  const routeParams = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [referralMessageIsError, setReferralMessageIsError] = useState(false);

  const referralCodeFromUrl = typeof routeParams.code === 'string' ? routeParams.code : undefined;

  const form = useForm<SignupFormData>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      class: undefined, 
      referralCode: referralCodeFromUrl || '', // Pre-fill from URL
      terms: false,
    },
  });

  const handleReferralCodeChange = useCallback(
    debounce(async (code: string) => {
      if (!code || code.trim().length < 3) { 
        setReferralMessage(null);
        setReferralMessageIsError(false);
        return;
      }
      setIsCheckingReferral(true);
      setReferralMessage(null);
      try {
        const result = await validateReferralCodeAction(code.trim().toUpperCase());
        if (result.success) {
          setReferralMessage(result.message);
          setReferralMessageIsError(false);
        } else {
          setReferralMessage(result.message || "Invalid referral code.");
          setReferralMessageIsError(true);
        }
      } catch (error) {
        setReferralMessage("Error validating referral code.");
        setReferralMessageIsError(true);
      } finally {
        setIsCheckingReferral(false);
      }
    }, 700), 
    []
  );

  useEffect(() => {
    if (referralCodeFromUrl) {
      // Default value is set in useForm, so we just need to trigger validation.
      handleReferralCodeChange(referralCodeFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCodeFromUrl]); // handleReferralCodeChange is memoized

  async function onSubmit(data: SignupFormData) {
    setIsLoading(true);
    setReferralMessage(null); 
    try {
      const result = await signupUserAction(data);
      if (result.success) {
        toast({
          title: 'Signup Successful!',
          description: 'Your account has been created. Please log in.',
        });
        router.push('/auth/login');
      } else {
        toast({
          title: 'Signup Failed',
          description: result.error || result.message || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
       toast({
        title: 'Error',
        description: (error as Error).message || 'An unexpected error occurred during signup.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <Link href="/landing" className="mb-6 inline-block">
            <Logo className="mx-auto h-12 w-12 text-primary" />
          </Link>
          <CardTitle className="text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join EduNexus to start your exam preparation journey.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john.doe@example.com" {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="9876543210" {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                control={form.control}
                name="class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class / Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your class or role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_CLASSES_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Code (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Enter referral code" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e); 
                            handleReferralCodeChange(e.target.value); 
                          }}
                        />
                        {isCheckingReferral && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </FormControl>
                    {referralMessage && (
                      <p className={`text-xs mt-1 ${referralMessageIsError ? 'text-destructive' : 'text-green-600'}`}>
                        {referralMessage}
                      </p>
                    )}
                    <FormMessage /> 
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Accept terms and conditions
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        You agree to our Terms of Service and Privacy Policy.
                      </p>
                       <FormMessage className="!mt-1" />
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || isCheckingReferral}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
