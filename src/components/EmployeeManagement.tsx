
"use client";

import type { Employee, EmployeeFormData } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase'; // auth imported
// createUserWithEmailAndPassword can be used if we want to create auth users here
// For now, we'll just store an email that could be used for an Auth account.
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { FileUp, PlusCircle, Trash2, UploadCloud } from 'lucide-react'; // Added UploadCloud

// Note: Password field is not included here for simplicity. 
// Creating users with passwords securely requires more UI/UX.
// This form assumes an admin might create a placeholder record,
// and the user would later set/reset their password through a different flow
// or be invited.
const employeeFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  role: z.string().min(1, { message: "Role is required." }),
});

export default function EmployeeManagement() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  const action = searchParams.get('action');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(action === 'add');

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
    },
  });

  useEffect(() => {
    setShowAddForm(action === 'add');
  }, [action]);
  
  useEffect(() => {
    if (instituteId) {
      fetchEmployees();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchEmployees() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'employees'), where('instituteId', '==', instituteId));
      const querySnapshot = await getDocs(q);
      const fetchedEmployees: Employee[] = [];
      querySnapshot.forEach((doc) => {
        fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(fetchedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch employees.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof employeeFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      // Future: Optionally create a Firebase Auth user here.
      // For now, just creates the Firestore record.
      // If creating Auth user:
      // const userCredential = await createUserWithEmailAndPassword(auth, values.email, "defaultPassword123"); // Handle password securely!
      // const firebaseUid = userCredential.user.uid;

      const employeeData: Omit<Employee, 'id' | 'createdAt'> & { createdAt: any; firebaseUid?: string } = {
        ...values,
        instituteId,
        createdAt: serverTimestamp(),
        // firebaseUid: firebaseUid, // If auth user created
      };
      await addDoc(collection(db, 'employees'), employeeData);
      toast({ title: 'Employee Added', description: `${values.name} has been added successfully.` });
      form.reset();
      setShowAddForm(false);
      fetchEmployees(); // Refresh list
    } catch (error: any) {
      console.error('Error adding employee:', error);
      let desc = 'Failed to add employee.';
      if (error.code === 'auth/email-already-in-use') {
        desc = 'This email is already in use by another authenticated account.';
      } else if (error.code === 'auth/weak-password') {
        desc = 'The password provided is too weak.';
      }
      toast({ variant: 'destructive', title: 'Error', description: desc });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleBatchUpload = () => {
    // Placeholder for batch upload functionality
    // In a real app, this would open a file dialog, parse a CSV/Excel, etc.
    toast({ title: "Batch Upload Employees", description: "This feature is coming soon! You'll be able to upload a CSV file to add multiple employees at once."});
  }

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found. Please ensure you are accessing this page correctly.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl">Manage Employees</CardTitle>
                <CardDescription>Add, view, or batch upload institute staff.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {showAddForm ? 'Cancel' : 'Add Employee'}
                </Button>
                <Button variant="outline" onClick={handleBatchUpload}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Batch Upload Employees
                </Button>
            </div>
        </CardHeader>
        {showAddForm && (
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-md">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                {/* 
                Future: Add password field if creating Auth user directly here
                <FormField
                    control={form.control}
                    name="password" // Add to schema if used
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password (temporary)</FormLabel>
                        <FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                /> 
                */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Employee'}
                </Button>
                </form>
            </Form>
            </CardContent>
        )}
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading employees...</p>
          ) : employees.length === 0 ? (
            <p>No employees found for this institute.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell className="capitalize">{employee.role}</TableCell>
                    <TableCell>
                        {employee.createdAt instanceof Timestamp 
                            ? employee.createdAt.toDate().toLocaleDateString() 
                            : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => toast({title: "Edit", description: "Edit functionality coming soon."})}>
                        <Trash2 className="h-4 w-4 text-destructive" /> {/* Placeholder for edit/delete */}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
