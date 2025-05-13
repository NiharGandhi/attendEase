
"use client";

import type { Classroom, ClassroomFormData } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { PlusCircle, Trash2, Edit3 } from 'lucide-react'; // Added Edit3

const classroomFormSchema = z.object({
  roomNumber: z.string().min(1, { message: "Room number is required." }),
  section: z.string().min(1, { message: "Section is required." }),
  capacity: z.coerce.number().positive({ message: "Capacity must be a positive number." }).optional(),
});

export default function ClassroomManagement() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  const action = searchParams.get('action');


  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(action === 'add');
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);

  const form = useForm<z.infer<typeof classroomFormSchema>>({
    resolver: zodResolver(classroomFormSchema),
    defaultValues: {
      roomNumber: '',
      section: '',
      capacity: undefined, 
    },
  });

  useEffect(() => {
     if (action === 'add' && !editingClassroom) {
      setShowForm(true);
      form.reset({ roomNumber: '', section: '', capacity: undefined });
    }
  }, [action, form, editingClassroom]);

  useEffect(() => {
    if (instituteId) {
      fetchClassrooms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchClassrooms() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const querySnapshot = await getDocs(q);
      const fetchedClassrooms: Classroom[] = [];
      querySnapshot.forEach((doc) => {
        fetchedClassrooms.push({ id: doc.id, ...doc.data() } as Classroom);
      });
      setClassrooms(fetchedClassrooms);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch classrooms.' });
    } finally {
      setIsLoading(false);
    }
  }

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    form.reset({
      roomNumber: classroom.roomNumber,
      section: classroom.section,
      capacity: classroom.capacity ?? undefined,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingClassroom(null);
    setShowForm(false);
    form.reset({ roomNumber: '', section: '', capacity: undefined });
  };

  async function onSubmit(values: z.infer<typeof classroomFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const classroomData: Omit<Classroom, 'id' | 'createdAt'> & { createdAt?: any, updatedAt?: any } = {
        roomNumber: values.roomNumber,
        section: values.section,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        instituteId,
      };

      if (editingClassroom && editingClassroom.id) {
        const classroomDocRef = doc(db, 'classrooms', editingClassroom.id);
        classroomData.updatedAt = serverTimestamp();
        await updateDoc(classroomDocRef, classroomData);
        toast({ title: 'Classroom Updated', description: `Classroom ${values.roomNumber} - ${values.section} has been updated.` });
      } else {
        classroomData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'classrooms'), classroomData);
        toast({ title: 'Classroom Added', description: `Classroom ${values.roomNumber} - ${values.section} has been added.` });
      }
      
      form.reset({ roomNumber: '', section: '', capacity: undefined });
      setShowForm(false);
      setEditingClassroom(null);
      fetchClassrooms(); 
    } catch (error) {
      console.error('Error saving classroom:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save classroom.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found. Please ensure you are accessing this page correctly.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl">{editingClassroom ? 'Edit Classroom' : 'Manage Classrooms'}</CardTitle>
                <CardDescription>Define classrooms, sections, and capacities.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => {
              if (showForm) {
                handleCancelEdit();
              } else {
                setEditingClassroom(null);
                form.reset({ roomNumber: '', section: '', capacity: undefined });
                setShowForm(true);
              }
            }}>
                <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Classroom'}
            </Button>
        </CardHeader>
        {showForm && (
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-md">
                    <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Room Number / Name</FormLabel>
                            <FormControl><Input placeholder="e.g., 101, Lab A" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="section"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Section</FormLabel>
                            <FormControl><Input placeholder="e.g., A, Morning Batch" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="capacity"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Capacity (Optional)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="e.g., 50" 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        field.onChange(val === '' ? undefined : Number(val));
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (editingClassroom ? 'Updating...' : 'Adding...') : (editingClassroom ? 'Update Classroom' : 'Add Classroom')}
                    </Button>
                    </form>
                </Form>
            </CardContent>
        )}
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Classroom List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading classrooms...</p>
          ) : classrooms.length === 0 ? (
            <p>No classrooms found for this institute.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Number</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell>{classroom.roomNumber}</TableCell>
                    <TableCell>{classroom.section}</TableCell>
                    <TableCell>{classroom.capacity || 'N/A'}</TableCell>
                    <TableCell>
                        {classroom.createdAt instanceof Timestamp 
                            ? classroom.createdAt.toDate().toLocaleDateString() 
                            : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(classroom)} title="Edit Classroom">
                            <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toast({title: "Delete", description: "Delete functionality coming soon."})} title="Delete Classroom">
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
