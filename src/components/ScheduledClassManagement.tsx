
"use client";

import type { ScheduledClass, ScheduledClassFormData, Classroom, Employee, Student, ClassScheduleItem, DayOfWeek } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form'; // Added useFieldArray
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
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, Trash2, Edit3, UploadCloud, MinusCircle } from 'lucide-react'; // Added MinusCircle
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
import { daysOfWeekArray, checkScheduleConflict, timeToMinutes } from '@/lib/types'; // Import DayOfWeek enum

const UNASSIGN_TEACHER_VALUE = "--UNASSIGN_TEACHER--"; 

const scheduleItemSchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek, { required_error: "Day of the week is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time (HH:mm)."),
}).refine(data => {
    if(!data.startTime || !data.endTime) return true; // Let individual regex handle this
    return timeToMinutes(data.endTime) > timeToMinutes(data.startTime)
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

const scheduledClassFormSchema = z.object({
  classroomId: z.string().min(1, "Classroom is required."),
  subjectName: z.string().min(2, "Subject name must be at least 2 characters."),
  subjectCode: z.string().optional(),
  teacherId: z.string().optional(),
  studentIds: z.array(z.string()).min(1, "At least one student must be selected."),
  schedules: z.array(scheduleItemSchema).min(1, "At least one schedule slot is required."),
}).refine(data => {
  if (data.schedules.length <= 1) return true;
  for (let i = 0; i < data.schedules.length; i++) {
    for (let j = i + 1; j < data.schedules.length; j++) {
      if (checkScheduleConflict(data.schedules[i], data.schedules[j])) {
        return false; // Found an internal conflict
      }
    }
  }
  return true;
}, {
  message: "The class has overlapping time slots within its own schedule. Please check days and times.",
  path: ["schedules"],
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
  const [showAddForm, setShowAddForm] = useState(action === 'add');
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
      schedules: [{ dayOfWeek: undefined, startTime: '', endTime: '' }], // Start with one schedule slot
    },
  });

  const { fields: scheduleFields, append: appendSchedule, remove: removeSchedule } = useFieldArray({
    control: form.control,
    name: "schedules"
  });


  useEffect(() => {
    setShowAddForm(action === 'add');
    if (action === 'add') {
        form.reset({
            classroomId: '',
            subjectName: '',
            subjectCode: '',
            teacherId: undefined,
            studentIds: [],
            schedules: [{ dayOfWeek: undefined, startTime: '', endTime: '' }],
        });
    }
  }, [action, form]);

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
    // setIsLoading(true); // Potentially remove if causing UI flicker, rely on main isLoading
    try {
        const scheduledClassQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
        const scheduledClassSnap = await getDocs(scheduledClassQuery);
        
        const classroomsToUse = currentClassrooms || classrooms;
        const employeesToUse = currentEmployees || employees;

        const fetchedScheduledClasses = scheduledClassSnap.docs.map(d => {
            const data = d.data() as ScheduledClass; // Assuming data now has 'schedules' array
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
    } finally {
        // setIsLoading(false);
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

      const scheduledClassData: Omit<ScheduledClass, 'id'| 'createdAt'> & { createdAt: any } = {
        instituteId,
        classroomId: values.classroomId,
        subjectName: values.subjectName,
        subjectCode: values.subjectCode || undefined,
        teacherId: values.teacherId || undefined,
        studentIds: values.studentIds,
        schedules: values.schedules as ClassScheduleItem[], // Cast as validated
        classroomDiplayName: selectedClassroom ? `${selectedClassroom.roomNumber} - ${selectedClassroom.section}` : undefined,
        teacherName: selectedTeacher ? selectedTeacher.name : undefined,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'scheduledClasses'), scheduledClassData);
      toast({ title: 'Scheduled Class Added', description: `${values.subjectName} has been scheduled.` });
      form.reset({
        classroomId: '',
        subjectName: '',
        subjectCode: '',
        teacherId: undefined,
        studentIds: [],
        schedules: [{ dayOfWeek: undefined, startTime: '', endTime: '' }],
      }); 
      setShowAddForm(false);
      await fetchScheduledClassesWithDetails();
    } catch (error) {
      console.error('Error adding scheduled class:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add scheduled class.' });
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
    console.log("Batch file selected:", batchFile.name);
    setBatchFile(null);
    if(batchFileRef.current) batchFileRef.current.value = "";
    setShowBatchUploadDialog(false);
    await fetchScheduledClassesWithDetails();
  };


  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Manage Class Schedule</CardTitle>
            <CardDescription>Define subjects, timings, and assign students to classes. A class can have multiple time slots per week.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowAddForm(!showAddForm); if (!showAddForm) form.reset({schedules: [{ dayOfWeek: undefined, startTime: '', endTime: '' }]}); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showAddForm ? 'Cancel' : 'Add Schedule'}
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
        {showAddForm && (
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-md">
                {/* Basic Class Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="subjectName" render={({ field }) => (<FormItem><FormLabel>Subject Name</FormLabel><FormControl><Input placeholder="e.g., Mathematics 101" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="subjectCode" render={({ field }) => (<FormItem><FormLabel>Subject Code (Optional)</FormLabel><FormControl><Input placeholder="e.g., MATH101" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="classroomId" render={({ field }) => (<FormItem><FormLabel>Classroom</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a classroom" /></SelectTrigger></FormControl><SelectContent>{classrooms.map(c => <SelectItem key={c.id} value={c.id!}>{c.roomNumber} - {c.section}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="teacherId" render={({ field }) => (<FormItem><FormLabel>Teacher (Optional)</FormLabel><Select onValueChange={(value) => field.onChange(value === UNASSIGN_TEACHER_VALUE ? undefined : value)} value={field.value || UNASSIGN_TEACHER_VALUE} ><FormControl><SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger></FormControl><SelectContent><SelectItem value={UNASSIGN_TEACHER_VALUE}>None</SelectItem>{employees.filter(e => e.role === 'teacher').map(e => <SelectItem key={e.id} value={e.id!}>{e.name}</SelectItem>)} {employees.filter(e => e.role === 'teacher').length === 0 && <SelectItem value="no_teachers" disabled>No teachers found</SelectItem>}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>

                {/* Dynamic Schedule Slots */}
                <div className="space-y-4">
                  <FormLabel>Schedule Slots</FormLabel>
                  {scheduleFields.map((item, index) => (
                    <Card key={item.id} className="p-4 relative">
                      <div className="grid md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`schedules.${index}.dayOfWeek`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Day</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {daysOfWeekArray.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField control={form.control} name={`schedules.${index}.startTime`} render={({ field }) => (<FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`schedules.${index}.endTime`} render={({ field }) => (<FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      {scheduleFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive hover:bg-destructive/10" onClick={() => removeSchedule(index)}>
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                      )}
                       {form.formState.errors.schedules?.[index] && <FormMessage className="mt-2 text-destructive">Error in this slot.</FormMessage>}
                    </Card>
                  ))}
                   {typeof form.formState.errors.schedules === 'string' && <FormMessage className="text-destructive">{form.formState.errors.schedules}</FormMessage>}
                   {form.formState.errors.schedules?.message && <FormMessage className="text-destructive">{form.formState.errors.schedules.message}</FormMessage>}


                  <Button type="button" variant="outline" onClick={() => appendSchedule({ dayOfWeek: undefined, startTime: '', endTime: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Time Slot
                  </Button>
                </div>

                {/* Student Assignment */}
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
                      <FormMessage /> {/* For errors related to studentIds itself, like min length */}
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
                  <TableHead>Schedules</TableHead>
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
                        <ul className="list-disc list-inside text-xs">
                            {sc.schedules?.map((schedule, idx) => (
                                <li key={idx}>{schedule.dayOfWeek}, {schedule.startTime} - {schedule.endTime}</li>
                            ))}
                             {(!sc.schedules || sc.schedules.length === 0) && <li>No schedule slots</li>}
                        </ul>
                    </TableCell>
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
