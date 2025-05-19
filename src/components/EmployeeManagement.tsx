"use client";

import type { Employee } from '@/lib/types';
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
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { FileUp, PlusCircle, Trash2, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

// Enhanced validation schema
const employeeFormSchema = z.object({
  name: z.string()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(100, { message: "Name must be less than 100 characters." }),
  email: z.string()
    .email({ message: "Invalid email address." })
    .max(100, { message: "Email must be less than 100 characters." }),
  role: z.string()
    .min(1, { message: "Role is required." }),
  phone: z.string()
    .regex(/^\+?[0-9\s-]{6,20}$/, { message: "Invalid phone number." })
    .optional()
    .or(z.literal('')),
});

// Role options with descriptions
const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher', description: 'Can manage classes and students' },
  { value: 'admin', label: 'Administrator', description: 'Full access to institute management' },
  { value: 'staff', label: 'Staff', description: 'Limited access based on permissions' },
  { value: 'support', label: 'Support', description: 'Access to help desk features' },
];

export default function EmployeeManagement() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  const action = searchParams.get('action');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(action === 'add');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      phone: '',
    },
  });

  useEffect(() => {
    setShowAddForm(action === 'add');
  }, [action]);

  useEffect(() => {
    if (instituteId) {
      fetchEmployees();
    }
  }, [instituteId]);

  async function fetchEmployees() {
    if (!instituteId) return;

    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'employees'),
        where('instituteId', '==', instituteId)
      );
      const querySnapshot = await getDocs(q);

      const fetchedEmployees: Employee[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        role: doc.data().role || '',
        phone: doc.data().phone || '',
        createdAt: doc.data().createdAt,
        instituteId: doc.data().instituteId,
      } as Employee));

      // Sort by creation date (newest first)
      fetchedEmployees.sort((a, b) => {
        const aDate = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bDate = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bDate - aDate;
      });

      setEmployees(fetchedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch employees. Please try again later.'
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof employeeFormSchema>) {
    if (!instituteId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Institute ID is missing. Please refresh the page.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if email already exists in this institute
      const emailCheckQuery = query(
        collection(db, 'employees'),
        where('instituteId', '==', instituteId),
        where('email', '==', values.email.toLowerCase())
      );
      const emailSnapshot = await getDocs(emailCheckQuery);

      if (!emailSnapshot.empty) {
        throw new Error('This email is already registered in this institute.');
      }

      const employeeData = {
        ...values,
        email: values.email.toLowerCase(), // normalize email
        instituteId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'employees'), employeeData);

      toast({
        title: 'Success',
        description: `${values.name} has been added successfully.`,
        variant: "default",
      });

      form.reset();
      setShowAddForm(false);
      await fetchEmployees(); // Refresh list
    } catch (error: any) {
      console.error('Error adding employee:', error);

      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add employee. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDeleteClick = (employeeId: string) => {
    setEmployeeToDelete(employeeId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    setDeletingId(employeeToDelete);
    try {
      await deleteDoc(doc(db, 'employees', employeeToDelete));

      toast({
        title: 'Success',
        description: 'Employee has been removed.',
        variant: 'default',
      });

      await fetchEmployees(); // Refresh list
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete employee. Please try again.',
      });
    } finally {
      setDeletingId(null);
      setEmployeeToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleBatchUpload = () => {
    toast({
      title: "Batch Upload",
      description: "Download our template file to prepare your employee data.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // In a real app, this would download a template CSV/Excel file
            toast({ description: "Template download started." });
          }}
        >
          Download Template
        </Button>
      ),
    });
  };

  if (!instituteId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">Institute Not Found</h2>
          <p className="text-muted-foreground">
            We couldn't identify which institute you're managing.
            Please ensure you're accessing this page through the correct link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Actions */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <div>
            <CardTitle className="text-2xl font-semibold">Employee Management</CardTitle>
            <CardDescription>
              Manage your institute's staff members and their permissions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
            >
              {showAddForm ? (
                <>
                  <span className="sr-only">Cancel</span>
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Employee</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchUpload}
              className="gap-2"
            >
              <FileUp className="h-4 w-4" />
              <span>Batch Upload</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add Employee Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Employee</CardTitle>
            <CardDescription>
              Fill in the details below to add a new staff member to your institute
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            autoComplete="name"
                          />
                        </FormControl>
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
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john.doe@example.com"
                            {...field}
                            autoComplete="email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="flex flex-col items-start"
                              >
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+1 234 567 8900"
                            {...field}
                            autoComplete="tel"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      form.reset();
                      setShowAddForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Add Employee</span>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>
            {employees.length} {employees.length === 1 ? 'member' : 'members'} in your institute
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <FileUp className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No employees found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Get started by adding your first employee or uploading a batch of employees.
              </p>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setShowAddForm(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
                <Button variant="outline" onClick={handleBatchUpload}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Batch Upload
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{employee.email}</span>
                          {employee.phone && (
                            <span className="text-sm text-muted-foreground">
                              {employee.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {employee.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee.createdAt instanceof Timestamp
                          ? format(employee.createdAt.toDate(), 'MMM d, yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toast({
                              title: "Edit Coming Soon",
                              description: "Edit functionality will be available in the next update.",
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(employee.id)}
                            disabled={deletingId === employee.id}
                          >
                            {deletingId === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                            <span className="sr-only">Delete</span>
                          </Button>

                          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently remove the employee from your institute.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteEmployee}
                                  disabled={deletingId !== null}
                                >
                                  {deletingId ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}