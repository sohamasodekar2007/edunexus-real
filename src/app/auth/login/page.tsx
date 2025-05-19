// @ts-nocheck
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginFormData } from '@/lib/validationSchemas';
import { loginUserAction } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react'; // Using Send icon as a placeholder for Telegram

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      // Rename password to password_login for the action
      const actionData = { email: data.email, password_login: data.password };
      const result = await loginUserAction(actionData);

      if (result.success) {
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${result.userName || 'User'}!`,
        });
        // Store user info for header and dashboard display
        if (typeof window !== 'undefined') {
          localStorage.setItem('userName', result.userName || 'User');
          localStorage.setItem('userModel', result.userModel || 'Free'); // Default to Free if not present
          localStorage.setItem('userAvatarFallback', (result.userName || 'U').charAt(0).toUpperCase());
        }
        router.push('/dashboard'); 
      } else {
        toast({
          title: 'Login Failed',
          description: result.error || result.message || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) { // Added missing opening brace
      toast({
        title: 'Error',
        description: (error as Error).message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Link href="/landing" className="mb-6 inline-block">
            <Logo className="mx-auto h-12 w-12 text-primary" />
          </Link>
          <CardTitle className="text-3xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Enter your email below to access your EduNexus account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>
          </Form>

          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-muted"></div>
            <span className="mx-4 flex-shrink text-xs uppercase text-muted-foreground">Or continue with</span>
            <div className="flex-grow border-t border-muted"></div>
          </div>

          <Button variant="outline" className="w-full" disabled>
            <Send className="mr-2 h-4 w-4" /> Telegram Login (Not Configured)
          </Button>

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
