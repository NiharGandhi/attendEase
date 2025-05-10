
"use client";

import type { InstituteFormData } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase'; // Import auth
import { addDoc, collection, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Import createUser
import { useRouter } from 'next/navigation'; 
import React from 'react';
import Link from 'next/link'; // Import Link

const formSchema = z.object({
  name: z.string().min(2, { message: 'Institute name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  contactEmail: z.string().email({ message: 'Invalid email address.' }),
  contactPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  adminPassword: z.string().min(6, { message: 'Password must be at least 6 characters.'}),
});

export default function RegisterInstituteForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
      adminPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      // 1. Create Firebase Auth user for the institute admin
      const userCredential = await createUserWithEmailAndPassword(auth, values.contactEmail, values.adminPassword);
      const user = userCredential.user;

      // 2. Create the institute document in Firestore
      const instituteData: Omit<InstituteFormData, 'adminPassword'> & { createdAt: any, adminUid?: string } = {
        name: values.name,
        address: values.address,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        createdAt: serverTimestamp(),
        adminUid: user.uid, // Store admin UID
      };
      const instituteDocRef = await addDoc(collection(db, 'institutes'), instituteData);
      const instituteId = instituteDocRef.id;

      // 3. Create an employee document for this admin user
      const employeeData = {
        instituteId: instituteId,
        name: "Admin " + values.name, // Or prompt for admin name
        email: values.contactEmail,
        role: 'admin',
        firebaseUid: user.uid, // Link to Firebase Auth user
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'employees'), employeeData);
      
      toast({
        title: 'Institute Registered!',
        description: `Welcome, ${values.name}! Your institute ID is ${instituteId}. Admin account created.`,
      });
      
      router.push(`/institute/dashboard?instituteId=${instituteId}`);
    } catch (error: any) {
      console.error('Error registering institute:', error);
      let errorMessage = 'An error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Try logging in.';
      }
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Institute Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., University of Technology" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Address</FormLabel>
              <FormControl>
                <Input placeholder="123 University Ave, City, Country" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin Contact Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="admin@university.edu" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="adminPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+1234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting}>
          {isSubmitting ? 'Registering...' : 'Register Institute & Create Admin'}
        </Button>
        <div className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Login
          </Link>
        </div>
      </form>
    </Form>
  );
}
