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
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { FileUp, PlusCircle, Trash2, Pencil, Loader2, UserPlus, Download, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { read, utils } from 'xlsx';
import * as Papa from 'papaparse';

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
  createAccount: z.boolean().optional(),
});

// Role options with descriptions and colors
const ROLE_OPTIONS = [
  {
    value: 'teacher',
    label: 'Teacher',
    description: 'Can manage classes and students',
    color: 'bg-purple-100 text-purple-800'
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full access to institute management',
    color: 'bg-red-100 text-red-800'
  },
  {
    value: 'staff',
    label: 'Staff',
    description: 'Limited access based on permissions',
    color: 'bg-blue-100 text-blue-800'
  },
  {
    value: 'support',
    label: 'Support',
    description: 'Access to help desk features',
    color: 'bg-green-100 text-green-800'
  },
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
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      phone: '',
      createAccount: false,
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
        hasAccount: doc.data().hasAccount || false,
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

      // Create auth account if requested
      let hasAccount = false;
      if (values.createAccount) {
        try {
          await createUserWithEmailAndPassword(auth, values.email, generateTemporaryPassword());
          hasAccount = true;
          toast({
            title: 'Account Created',
            description: `A temporary password has been generated for ${values.email}. They should reset it on first login.`,
            variant: 'default',
          });
        } catch (authError) {
          console.error('Error creating auth account:', authError);
          throw new Error('Failed to create user account. The email may already be in use.');
        }
      }

      const employeeData = {
        ...values,
        email: values.email.toLowerCase(), // normalize email
        instituteId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hasAccount,
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

  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

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

  const handleBatchUploadClick = () => {
    setBatchUploadOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBatchFile(e.target.files[0]);
    }
  };

  const processBatchFile = async () => {
    if (!batchFile || !instituteId) return;

    setIsBatchProcessing(true);
    try {
      const fileType = batchFile.name.split('.').pop()?.toLowerCase();
      let employeesToAdd: any[] = [];

      if (fileType === 'csv') {
        // Process CSV
        const text = await batchFile.text();
        const result = Papa.parse(text, { header: true });
        employeesToAdd = result.data
          .filter((row: any) => row.name && row.email && row.role)
          .map((row: any) => ({
            name: row.name.trim(),
            email: row.email.trim().toLowerCase(),
            role: row.role.trim().toLowerCase(),
            phone: row.phone?.trim() || '',
            instituteId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAccount: false,
          }));
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        // Process Excel
        const arrayBuffer = await batchFile.arrayBuffer();
        const workbook = read(arrayBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(worksheet);
        employeesToAdd = jsonData
          .filter((row: any) => row.name && row.email && row.role)
          .map((row: any) => ({
            name: row.name.trim(),
            email: row.email.trim().toLowerCase(),
            role: row.role.trim().toLowerCase(),
            phone: row.phone?.trim() || '',
            instituteId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAccount: false,
          }));
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
      }

      // Check for duplicates
      const existingEmails = new Set(employees.map(e => e.email));
      const duplicates = employeesToAdd.filter(e => existingEmails.has(e.email));

      if (duplicates.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Duplicate Emails Found',
          description: `${duplicates.length} employees were skipped because their emails already exist.`,
        });
        employeesToAdd = employeesToAdd.filter(e => !existingEmails.has(e.email));
      }

      // Add to Firestore
      const batchPromises = employeesToAdd.map(employee =>
        addDoc(collection(db, 'employees'), employee)
      );

      await Promise.all(batchPromises);

      toast({
        title: 'Batch Upload Complete',
        description: `Successfully added ${employeesToAdd.length} employees.`,
        variant: 'default',
      });

      setBatchFile(null);
      setBatchUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error processing batch file:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to process batch file. Please check the format and try again.',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const downloadTemplate = () => {
    // Create template data
    const templateData = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'teacher',
        phone: '+1234567890'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'admin',
        phone: '+1987654321'
      }
    ];

    // Convert to CSV
    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createAccountForEmployee = async (employeeId: string, email: string) => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Email is required to create an account.',
      });
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, generateTemporaryPassword());

      // Update employee record
      await updateDoc(doc(db, 'employees', employeeId), {
        hasAccount: true,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Account Created',
        description: `A temporary password has been generated for ${email}. They should reset it on first login.`,
        variant: 'default',
      });

      await fetchEmployees();
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create user account. The email may already be in use.',
      });
    }
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
      {/* Delete Confirmation Dialog */}
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

      {/* Batch Upload Dialog */}
      <AlertDialog open={batchUploadOpen} onOpenChange={setBatchUploadOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batch Upload Employees</AlertDialogTitle>
            <AlertDialogDescription>
              Upload a CSV or Excel file to add multiple employees at once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 space-y-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {batchFile ? batchFile.name : 'Drag and drop your file here, or click to select'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Your file should include these columns:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><span className="font-medium">name</span> (required)</li>
                <li><span className="font-medium">email</span> (required)</li>
                <li><span className="font-medium">role</span> (required)</li>
                <li><span className="font-medium">phone</span> (optional)</li>
              </ul>
            </div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={processBatchFile}
              disabled={!batchFile || isBatchProcessing}
            >
              {isBatchProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Card with Actions */}
      <Card className="shadow-sm border-0 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <div>
            <CardTitle className="text-2xl font-semibold text-gray-800">Employee Management</CardTitle>
            <CardDescription className="text-gray-600">
              Manage your institute's staff members and their permissions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
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
              onClick={handleBatchUploadClick}
              className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <FileUp className="h-4 w-4" />
              <span>Batch Upload</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add Employee Form */}
      {showAddForm && (
        <Card className="border-0 shadow-sm">
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

                <FormField
                  control={form.control}
                  name="createAccount"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Also create login account for this employee
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          A temporary password will be generated and emailed to them.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

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
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
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
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>
                {employees.length} {employees.length === 1 ? 'member' : 'members'} in your institute
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Template
              </Button>
            </div>
          </div>
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
                <Button variant="outline" onClick={handleBatchUploadClick}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Batch Upload
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 text-blue-600 font-semibold">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {employee.role}
                            </p>
                          </div>
                        </div>
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
                        <Badge
                          variant="outline"
                          className={`capitalize ${ROLE_OPTIONS.find(r => r.value === employee.role)?.color || 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {employee.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee.hasAccount ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Account Active
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => createAccountForEmployee(employee.id, employee.email)}
                          >
                            <UserPlus className="h-4 w-4" />
                            Create Account
                          </Button>
                        )}
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
                            <Pencil className="h-4 w-4 text-blue-600" />
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
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                            <span className="sr-only">Delete</span>
                          </Button>
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