
"use client";

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase'; // Import auth
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const loginFormSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Attempt to find the user in the 'employees' collection to get their instituteId
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('email', '==', user.email));
      const querySnapshot = await getDocs(q);

      let instituteId: string | null = null;
      if (!querySnapshot.empty) {
        // Assuming an employee belongs to one institute and has instituteId in their doc
        const employeeDoc = querySnapshot.docs[0];
        instituteId = employeeDoc.data().instituteId as string;
      }
      
      toast({
        title: 'Login Successful!',
        description: `Welcome back!`,
      });

      if (instituteId) {
        router.push(`/institute/dashboard?instituteId=${instituteId}`);
      } else {
        // Fallback if instituteId is not found (e.g., user is not an employee or data is missing)
        // This could be a central admin not tied to one institute, or an error.
        // For now, redirect to home page, or a page prompting to associate with an institute.
        toast({
          title: 'Institute Not Found',
          description: 'Your account is not associated with an institute. Redirecting to home.',
          variant: 'destructive'
        });
        router.push('/');
      }

    } catch (error: any) {
      console.error('Error logging in:', error);
      let errorMessage = 'An error occurred. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
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
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </Button>
        <div className="text-center text-sm">
          Don&apos;t have an institute account?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Register your institute
          </Link>
        </div>
      </form>
    </Form>
  );
}
