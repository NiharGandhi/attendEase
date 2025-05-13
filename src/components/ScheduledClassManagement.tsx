
"use client";

import type { ScheduledClass, ScheduledClassFormData, Classroom, Employee, Student, DayOfWeek } from '@/lib/types';
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
import { addDoc, collection, query, where, getDocs, serverTimestamp, doc, updateDoc, DocumentReference } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, Trash2, Edit3, UploadCloud } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { daysOfWeekArray, timeToMinutes } from '@/lib/types';

const UNASSIGN_TEACHER_VALUE = "--UNASSIGN_TEACHER--";

const scheduledClassFormSchema = z.object({
  classroomId: z.string().min(1, "Classroom is required."),
  subjectName: z.string().min(2, "Subject name must be at least 2 characters."),
  subjectCode: z.string().optional(),
  teacherId: z.string().optional(),
  studentIds: z.array(z.string()).min(1, "At least one student must be selected."),
  daysOfWeek: z.array(z.nativeEnum(DayOfWeek)).min(1, "At least one day must be selected."),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time (HH:mm)."),
}).refine(data => {
  if (!data.startTime || !data.endTime) return true;
  return timeToMinutes(data.endTime) > timeToMinutes(data.startTime);
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});


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
  const [showForm, setShowForm] = useState(action === 'add');
  const [editingScheduledClass, setEditingScheduledClass] = useState<ScheduledClass | null>(null);

  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof scheduledClassFormSchema>>({
    resolver: zodResolver(scheduledClassFormSchema),
    defaultValues: {
      classroomId: '',
      subjectName: '',
      subjectCode: '',
      teacherId: undefined,
      studentIds: [],
      daysOfWeek: [],
      startTime: '',
      endTime: '',
    },
  });

  useEffect(() => {
    if (action === 'add' && !editingScheduledClass) {
        setShowForm(true);
        form.reset({
            classroomId: '', subjectName: '', subjectCode: '', teacherId: undefined,
            studentIds: [], daysOfWeek: [], startTime: '', endTime: '',
        });
    }
  }, [action, form, editingScheduledClass]);

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
      
      const [classroomSnap, employeeSnap, studentSnap] = await Promise.all([
        getDocs(classroomQuery),
        getDocs(employeeQuery),
        getDocs(studentQuery),
      ]);

      const fetchedClassrooms = classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));
      const fetchedEmployees = employeeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      
      setClassrooms(fetchedClassrooms);
      setEmployees(fetchedEmployees);
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      
      await fetchScheduledClassesWithDetails(fetchedClassrooms, fetchedEmployees);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch initial data.' });
    } finally {
      setIsLoading(false);
    }
  }
  
  async function fetchScheduledClassesWithDetails(
    currentClassrooms?: Classroom[], 
    currentEmployees?: Employee[]
  ) {
    if (!instituteId) return;
    try {
        const scheduledClassQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
        const scheduledClassSnap = await getDocs(scheduledClassQuery);
        
        const classroomsToUse = currentClassrooms || classrooms;
        const employeesToUse = currentEmployees || employees;

        const fetchedScheduledClasses = scheduledClassSnap.docs.map(d => {
            const data = d.data() as ScheduledClass;
            const classroom = classroomsToUse.find(c => c.id === data.classroomId);
            const teacher = employeesToUse.find(e => e.id === data.teacherId);
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
    }
  }

  const handleEdit = (sc: ScheduledClass) => {
    setEditingScheduledClass(sc);
    form.reset({
      classroomId: sc.classroomId,
      subjectName: sc.subjectName,
      subjectCode: sc.subjectCode || '',
      teacherId: sc.teacherId || undefined,
      studentIds: sc.studentIds || [],
      daysOfWeek: sc.daysOfWeek || [],
      startTime: sc.startTime || '',
      endTime: sc.endTime || '',
    });
    setShowForm(true);
  };

  async function onSubmit(values: z.infer<typeof scheduledClassFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedClassroom = classrooms.find(c => c.id === values.classroomId);
      const selectedTeacher = employees.find(e => e.id === values.teacherId);

      const scheduledClassData: ScheduledClassFormData = {
        instituteId,
        classroomId: values.classroomId,
        subjectName: values.subjectName,
        subjectCode: values.subjectCode || undefined,
        teacherId: values.teacherId || undefined,
        studentIds: values.studentIds,
        daysOfWeek: values.daysOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        // Denormalized fields will be set based on selected IDs
        classroomDiplayName: selectedClassroom ? `${selectedClassroom.roomNumber} - ${selectedClassroom.section}` : undefined,
        teacherName: selectedTeacher ? selectedTeacher.name : undefined,
      };

      if (editingScheduledClass && editingScheduledClass.id) {
        const classDocRef = doc(db, 'scheduledClasses', editingScheduledClass.id);
        await updateDoc(classDocRef, { ...scheduledClassData, updatedAt: serverTimestamp() });
        toast({ title: 'Scheduled Class Updated', description: `${values.subjectName} has been updated.` });
      } else {
        await addDoc(collection(db, 'scheduledClasses'), { ...scheduledClassData, createdAt: serverTimestamp() });
        toast({ title: 'Scheduled Class Added', description: `${values.subjectName} has been scheduled.` });
      }
      
      form.reset({
        classroomId: '', subjectName: '', subjectCode: '', teacherId: undefined,
        studentIds: [], daysOfWeek: [], startTime: '', endTime: '',
      });
      setShowForm(false);
      setEditingScheduledClass(null);
      await fetchScheduledClassesWithDetails();
    } catch (error) {
      console.error('Error saving scheduled class:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save scheduled class.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleBatchScheduleUpload = async () => {
    if (!batchFile) {
      toast({ variant: 'destructive', title: 'No File', description: 'Please select a CSV file to upload.' });
      return;
    }
    toast({ title: 'Batch Upload Started', description: `Processing ${batchFile.name}. This feature is in development.` });
    // Actual batch upload logic (parsing CSV, validation, Firestore writes) would go here.
    // For now, it's a placeholder.
    console.log("Batch file selected:", batchFile.name);
    
    setBatchFile(null);
    if(batchFileRef.current) batchFileRef.current.value = "";
    setShowBatchUploadDialog(false);
    await fetchScheduledClassesWithDetails();
  };

  const handleCancelEdit = () => {
    setShowForm(false);
    setEditingScheduledClass(null);
    form.reset({
        classroomId: '', subjectName: '', subjectCode: '', teacherId: undefined,
        studentIds: [], daysOfWeek: [], startTime: '', endTime: '',
    });
  }


  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{editingScheduledClass ? 'Edit Class Schedule' : 'Manage Class Schedule'}</CardTitle>
            <CardDescription>Define subjects, timings, and assign students to classes. A class has one time slot applicable to selected days.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { 
              if (showForm && editingScheduledClass) {
                handleCancelEdit();
              } else if (showForm && !editingScheduledClass) {
                 setShowForm(false);
              }
              else {
                setEditingScheduledClass(null);
                form.reset({
                    classroomId: '', subjectName: '', subjectCode: '', teacherId: undefined,
                    studentIds: [], daysOfWeek: [], startTime: '', endTime: '',
                });
                setShowForm(true);
              }
            }}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Schedule'}
            </Button>
            <Dialog open={showBatchUploadDialog} onOpenChange={setShowBatchUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UploadCloud className="mr-2 h-4 w-4" /> Batch Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Batch Schedule Classes</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to schedule multiple classes. (Feature in development)
                    <br />Expected CSV columns: subjectName, subjectCode, classroomId, teacherId, studentIds (comma-separated), daysOfWeek (comma-separated e.g., Monday,Wednesday), startTime (HH:mm), endTime (HH:mm).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batchFile" className="text-right">CSV File</Label>
                    <Input id="batchFile" type="file" accept=".csv" className="col-span-3" ref={batchFileRef} onChange={(e) => setBatchFile(e.target.files ? e.target.files[0] : null)} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button onClick={handleBatchScheduleUpload} disabled={!batchFile}>Process File</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-md">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="subjectName" render={({ field }) => (<FormItem><FormLabel>Subject Name</FormLabel><FormControl><Input placeholder="e.g., Mathematics 101" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="subjectCode" render={({ field }) => (<FormItem><FormLabel>Subject Code (Optional)</FormLabel><FormControl><Input placeholder="e.g., MATH101" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="classroomId" render={({ field }) => (<FormItem><FormLabel>Classroom</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a classroom" /></SelectTrigger></FormControl><SelectContent>{classrooms.map(c => <SelectItem key={c.id} value={c.id!}>{c.roomNumber} - {c.section}</SelectItem>)}{classrooms.length === 0 && <SelectItem value="no-classrooms" disabled>No classrooms</SelectItem>}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="teacherId" render={({ field }) => (<FormItem><FormLabel>Teacher (Optional)</FormLabel><Select onValueChange={(value) => field.onChange(value === UNASSIGN_TEACHER_VALUE ? undefined : value)} value={field.value || UNASSIGN_TEACHER_VALUE} ><FormControl><SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger></FormControl><SelectContent><SelectItem value={UNASSIGN_TEACHER_VALUE}>None</SelectItem>{employees.filter(e => e.role === 'teacher').map(e => <SelectItem key={e.id} value={e.id!}>{e.name}</SelectItem>)} {employees.filter(e => e.role === 'teacher').length === 0 && <SelectItem value="no_teachers" disabled>No teachers found</SelectItem>}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                   <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                   <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <FormField
                  control={form.control}
                  name="daysOfWeek"
                  render={() => (
                    <FormItem>
                      <FormLabel>Days of the Week</FormLabel>
                      <FormDescription>Select all days this class time applies to.</FormDescription>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2 border rounded-md">
                        {daysOfWeekArray.map((day) => (
                          <FormField
                            key={day}
                            control={form.control}
                            name="daysOfWeek"
                            render={({ field }) => {
                              return (
                                <FormItem key={day} className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(day)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), day])
                                          : field.onChange(
                                              (field.value || []).filter(
                                                (value) => value !== day
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">{day}</FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  {isSubmitting ? (editingScheduledClass ? 'Updating...' : 'Scheduling...') : (editingScheduledClass ? 'Update Scheduled Class' : 'Add Scheduled Class')}
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
                  <TableHead>Schedule</TableHead>
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
                    <TableCell>
                        <div className="text-xs">
                            <p>Time: {sc.startTime} - {sc.endTime}</p>
                            <p>Days: {sc.daysOfWeek?.join(', ') || 'N/A'}</p>
                        </div>
                    </TableCell>
                    <TableCell>{sc.teacherName || 'N/A'}</TableCell>
                    <TableCell>{sc.studentIds?.length || 0}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(sc)} title="Edit Class">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                       <Button variant="ghost" size="icon" onClick={() => toast({title: "Delete Class", description:"Delete functionality coming soon."})} title="Delete Class">
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
