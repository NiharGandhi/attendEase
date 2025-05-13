
"use client";

import type { ScheduledClass, ScheduledClassFormData, Classroom, Employee, Student } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, doc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { PlusCircle, Trash2, Edit3 } from 'lucide-react';

const scheduledClassFormSchema = z.object({
  classroomId: z.string().min(1, "Classroom is required."),
  subjectName: z.string().min(2, "Subject name must be at least 2 characters."),
  subjectCode: z.string().optional(),
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], {
    required_error: "Day of the week is required.",
  }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time (HH:mm)."),
  teacherId: z.string().optional(),
  studentIds: z.array(z.string()).min(1, "At least one student must be selected."),
}).refine(data => data.endTime > data.startTime, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export default function ScheduledClassManagement() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  const action = searchParams.get('action');

  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(action === 'add');

  const form = useForm<z.infer<typeof scheduledClassFormSchema>>({
    resolver: zodResolver(scheduledClassFormSchema),
    defaultValues: {
      classroomId: '',
      subjectName: '',
      subjectCode: '',
      dayOfWeek: undefined,
      startTime: '',
      endTime: '',
      teacherId: '',
      studentIds: [],
    },
  });

  useEffect(() => {
    setShowAddForm(action === 'add');
  }, [action]);

  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchInitialData() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const classroomQuery = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const employeeQuery = query(collection(db, 'employees'), where('instituteId', '==', instituteId));
      const studentQuery = query(collection(db, 'students'), where('instituteId', '==', instituteId));
      const scheduledClassQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));

      const [classroomSnap, employeeSnap, studentSnap, scheduledClassSnap] = await Promise.all([
        getDocs(classroomQuery),
        getDocs(employeeQuery),
        getDocs(studentQuery),
        getDocs(scheduledClassQuery)
      ]);

      setClassrooms(classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
      setEmployees(employeeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      
      const fetchedScheduledClasses = scheduledClassSnap.docs.map(d => {
        const data = d.data() as ScheduledClass;
        const classroom = classrooms.find(c => c.id === data.classroomId);
        const teacher = employees.find(e => e.id === data.teacherId);
        return { 
            id: d.id, 
            ...data,
            classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}`: 'N/A',
            teacherName: teacher ? teacher.name : 'N/A'
        };
      });
      setScheduledClasses(fetchedScheduledClasses);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch initial data.' });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Re-fetch scheduled classes after add/edit/delete and update their display names
  async function fetchScheduledClassesWithDetails() {
    if (!instituteId) return;
    setIsLoading(true); // Can set a specific loading for just the table if preferred
    try {
        const scheduledClassQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
        const scheduledClassSnap = await getDocs(scheduledClassQuery);
        
        // Ensure classrooms and employees lists are up-to-date if they could change elsewhere, or rely on existing state
        // For simplicity, using existing state here. Refetch them if necessary.
        const currentClassrooms = classrooms; 
        const currentEmployees = employees;

        const fetchedScheduledClasses = scheduledClassSnap.docs.map(d => {
            const data = d.data() as ScheduledClass;
            const classroom = currentClassrooms.find(c => c.id === data.classroomId);
            const teacher = currentEmployees.find(e => e.id === data.teacherId);
            return { 
                id: d.id, 
                ...data,
                classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}` : 'N/A',
                teacherName: teacher ? teacher.name : 'N/A'
            };
        });
        setScheduledClasses(fetchedScheduledClasses);
    } catch (error) {
        console.error('Error fetching scheduled classes:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh scheduled classes list.' });
    } finally {
        setIsLoading(false);
    }
  }


  async function onSubmit(values: z.infer<typeof scheduledClassFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedClassroom = classrooms.find(c => c.id === values.classroomId);
      const selectedTeacher = employees.find(e => e.id === values.teacherId);

      const scheduledClassData: ScheduledClassFormData & { createdAt: any } = {
        ...values,
        instituteId,
        classroomDiplayName: selectedClassroom ? `${selectedClassroom.roomNumber} - ${selectedClassroom.section}` : undefined,
        teacherName: selectedTeacher ? selectedTeacher.name : undefined,
        studentIds: values.studentIds,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'scheduledClasses'), scheduledClassData);
      toast({ title: 'Scheduled Class Added', description: `${values.subjectName} has been scheduled.` });
      form.reset();
      setShowAddForm(false);
      await fetchScheduledClassesWithDetails();
    } catch (error) {
      console.error('Error adding scheduled class:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add scheduled class.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Manage Class Schedule</CardTitle>
            <CardDescription>Define subjects, timings, and assign students to classes.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => { setShowAddForm(!showAddForm); form.reset(); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> {showAddForm ? 'Cancel' : 'Add Scheduled Class'}
          </Button>
        </CardHeader>
        {showAddForm && (
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-md">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="classroomId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classroom (Physical Room)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a classroom" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {classrooms.map(c => <SelectItem key={c.id} value={c.id!}>{c.roomNumber} - {c.section}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teacherId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teacher (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {employees.map(e => <SelectItem key={e.id} value={e.id!}>{e.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField control={form.control} name="subjectName" render={({ field }) => (<FormItem><FormLabel>Subject Name</FormLabel><FormControl><Input placeholder="e.g., Mathematics 101" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="subjectCode" render={({ field }) => (<FormItem><FormLabel>Subject Code (Optional)</FormLabel><FormControl><Input placeholder="e.g., MATH101" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />

                <div className="grid md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <FormField
                  control={form.control}
                  name="studentIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>Assign Students</FormLabel>
                      <FormDescription>Select students to enroll in this class.</FormDescription>
                      <ScrollArea className="h-72 w-full rounded-md border p-4">
                        {students.length === 0 && <p className="text-muted-foreground">No students available. Add students first.</p>}
                        {students.map((student) => (
                          <FormField
                            key={student.id}
                            control={form.control}
                            name="studentIds"
                            render={({ field }) => {
                              return (
                                <FormItem key={student.id} className="flex flex-row items-start space-x-3 space-y-0 py-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(student.id!)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), student.id!])
                                          : field.onChange(
                                              (field.value || []).filter(
                                                (value) => value !== student.id!
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {student.name} ({student.studentIdNo})
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Scheduling...' : 'Add Scheduled Class'}
                </Button>
              </form>
            </Form>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Scheduled Classes List</CardTitle>
          {isLoading && <CardDescription>Loading schedule...</CardDescription>}
        </CardHeader>
        <CardContent>
          {scheduledClasses.length === 0 && !isLoading ? (
            <p>No classes scheduled for this institute yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Day & Time</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledClasses.map((sc) => (
                  <TableRow key={sc.id}>
                    <TableCell>{sc.subjectName} {sc.subjectCode && `(${sc.subjectCode})`}</TableCell>
                    <TableCell>{sc.classroomDiplayName || 'N/A'}</TableCell>
                    <TableCell>{sc.dayOfWeek}, {sc.startTime} - {sc.endTime}</TableCell>
                    <TableCell>{sc.teacherName || 'N/A'}</TableCell>
                    <TableCell>{sc.studentIds.length}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => toast({title: "Edit Class", description:"Edit functionality coming soon."})}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                       <Button variant="ghost" size="icon" onClick={() => toast({title: "Delete Class", description:"Delete functionality coming soon."})}>
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
