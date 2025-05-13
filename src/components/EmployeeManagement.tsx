
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
import { db, auth } from '@/lib/firebase'; 
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { FileUp, PlusCircle, Trash2, UploadCloud, Edit3 } from 'lucide-react'; // Added Edit3

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
  const [showForm, setShowForm] = useState(action === 'add');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
    },
  });

  useEffect(() => {
    if (action === 'add' && !editingEmployee) {
      setShowForm(true);
      form.reset({ name: '', email: '', role: '' });
    }
  }, [action, form, editingEmployee]);
  
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

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      name: employee.name,
      email: employee.email,
      role: employee.role,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setShowForm(false);
    form.reset({ name: '', email: '', role: '' });
  };


  async function onSubmit(values: z.infer<typeof employeeFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      // Note: Email update for an existing Firebase Auth user is more complex and typically requires re-authentication.
      // This implementation only updates the Firestore record's email.
      // If values.email !== editingEmployee?.email, an admin might need to manually update Auth or trigger a verification flow.

      const employeeData: Omit<Employee, 'id' | 'createdAt' | 'firebaseUid'> & { createdAt?: any; firebaseUid?: string, updatedAt?: any } = {
        ...values,
        instituteId,
      };

      if (editingEmployee && editingEmployee.id) {
        const employeeDocRef = doc(db, 'employees', editingEmployee.id);
        // Retain existing firebaseUid if present
        if (editingEmployee.firebaseUid) {
          employeeData.firebaseUid = editingEmployee.firebaseUid;
        }
        employeeData.updatedAt = serverTimestamp();
        await updateDoc(employeeDocRef, employeeData);
        toast({ title: 'Employee Updated', description: `${values.name} has been updated.` });
      } else {
        // Firebase Auth user creation would go here if this was initial registration with auth link
        // const userCredential = await createUserWithEmailAndPassword(auth, values.email, "defaultPassword123");
        // employeeData.firebaseUid = userCredential.user.uid;
        employeeData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'employees'), employeeData);
        toast({ title: 'Employee Added', description: `${values.name} has been added successfully.` });
      }
      
      form.reset({ name: '', email: '', role: '' });
      setShowForm(false);
      setEditingEmployee(null);
      fetchEmployees(); 
    } catch (error: any) {
      console.error('Error saving employee:', error);
      let desc = 'Failed to save employee.';
      if (error.code === 'auth/email-already-in-use' && !editingEmployee) { // Only for new user creation
        desc = 'This email is already in use by another authenticated account.';
      }
      toast({ variant: 'destructive', title: 'Error', description: desc });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleBatchUpload = () => {
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
                <CardTitle className="text-2xl">{editingEmployee ? 'Edit Employee' : 'Manage Employees'}</CardTitle>
                <CardDescription>Add, view, or batch upload institute staff.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  if (showForm) {
                    handleCancelEdit();
                  } else {
                    setEditingEmployee(null);
                    form.reset({ name: '', email: '', role: '' });
                    setShowForm(true);
                  }
                }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Employee'}
                </Button>
                <Button variant="outline" onClick={handleBatchUpload}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Batch Upload Employees
                </Button>
            </div>
        </CardHeader>
        {showForm && (
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
                        <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} disabled={!!editingEmployee} /></FormControl>
                        {editingEmployee && <FormDescription>Email cannot be changed after creation for existing users.</FormDescription>}
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (editingEmployee ? 'Updating...' : 'Adding...') : (editingEmployee ? 'Update Employee' : 'Add Employee')}
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
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(employee)} title="Edit Employee">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toast({title: "Delete", description: "Delete functionality coming soon."})} title="Delete Employee">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
