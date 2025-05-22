"use client";

import type { Classroom, ClassroomFormClientData, ClassroomFormData, ScheduledClass, Employee } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, Trash2, Edit3, UploadCloud, ExternalLink, CalendarSearch, Video } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { classroomFormClientSchema, daysOfWeekArray } from '@/lib/types';

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

  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedClassroomForSchedule, setSelectedClassroomForSchedule] = useState<Classroom | null>(null);
  const [classroomSchedule, setClassroomSchedule] = useState<ScheduledClass[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Employee[]>([]);

  const form = useForm<ClassroomFormClientData>({
    resolver: zodResolver(classroomFormClientSchema),
    defaultValues: {
      building: '',
      roomNumber: '',
      section: '',
      capacity: undefined,
      cameraSetupType: 'default',
      ipCameraUrlsInput: '',
    },
  });

  useEffect(() => {
    if (action === 'add' && !editingClassroom) {
      setShowForm(true);
      form.reset({ building: '', roomNumber: '', section: '', capacity: undefined, cameraSetupType: 'default', ipCameraUrlsInput: '' });
    }
  }, [action, form, editingClassroom]);

  useEffect(() => {
    if (instituteId) {
      fetchClassrooms();
      fetchTeachers();
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

  async function fetchTeachers() {
    if (!instituteId) return;
    try {
      const q = query(collection(db, 'employees'), where('instituteId', '==', instituteId), where('role', '==', 'teacher'));
      const snapshot = await getDocs(q);
      setAllTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    } catch (error) {
      console.error("Error fetching teachers for schedule dialog:", error);
    }
  }

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    form.reset({
      building: classroom.building || '',
      roomNumber: classroom.roomNumber,
      section: classroom.section,
      capacity: classroom.capacity ?? undefined,
      cameraSetupType: classroom.cameraSetup?.type || 'default',
      ipCameraUrlsInput: classroom.cameraSetup?.ipCameraUrls?.join('\n') || '',
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingClassroom(null);
    setShowForm(false);
    form.reset({ building: '', roomNumber: '', section: '', capacity: undefined, cameraSetupType: 'default', ipCameraUrlsInput: '' });
  };

  async function onSubmit(values: ClassroomFormClientData) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const classroomData: ClassroomFormData & { instituteId: string, createdAt?: any, updatedAt?: any } = {
        building: values.building || undefined,
        roomNumber: values.roomNumber,
        section: values.section,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        cameraSetup: {
          type: values.cameraSetupType || 'default',
          ipCameraUrls: values.cameraSetupType === 'ip' && values.ipCameraUrlsInput
            ? values.ipCameraUrlsInput.split('\n').map(url => url.trim()).filter(url => url.length > 0)
            : [],
        },
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

      form.reset({ building: '', roomNumber: '', section: '', capacity: undefined, cameraSetupType: 'default', ipCameraUrlsInput: '' });
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

  const handleBatchClassroomUpload = async () => {
    if (!batchFile) {
      toast({ variant: 'destructive', title: 'No File', description: 'Please select a CSV file to upload.' });
      return;
    }
    toast({ title: 'Batch Upload Started', description: `Processing ${batchFile.name}. This feature is in development.` });
    console.log("Batch classroom file selected:", batchFile.name);

    setBatchFile(null);
    if (batchFileRef.current) batchFileRef.current.value = "";
    setShowBatchUploadDialog(false);
  };

  const handleViewSchedule = async (classroom: Classroom) => {
    if (!instituteId || !classroom.id) return;
    setSelectedClassroomForSchedule(classroom);
    setShowScheduleDialog(true);
    setIsLoadingSchedule(true);
    try {
      const q = query(
        collection(db, 'scheduledClasses'),
        where('instituteId', '==', instituteId),
        where('classroomId', '==', classroom.id)
      );
      const scheduleSnapshot = await getDocs(q);
      const schedules = scheduleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledClass));

      schedules.sort((a, b) => {
        const dayIndexA = daysOfWeekArray.indexOf(a.daysOfWeek[0]);
        const dayIndexB = daysOfWeekArray.indexOf(b.daysOfWeek[0]);
        if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
        return a.startTime.localeCompare(b.startTime);
      });

      setClassroomSchedule(schedules);
    } catch (error) {
      console.error("Error fetching classroom schedule:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch schedule for this classroom." });
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found. Please ensure you are accessing this page correctly.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{editingClassroom ? 'Edit Classroom' : 'Manage Classrooms'}</CardTitle>
            <CardDescription>Define buildings, classrooms, camera setups, sections, and capacities. You can also batch upload or sync from external systems.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => {
              if (showForm) {
                handleCancelEdit();
              } else {
                setEditingClassroom(null);
                form.reset({ building: '', roomNumber: '', section: '', capacity: undefined, cameraSetupType: 'default', ipCameraUrlsInput: '' });
                setShowForm(true);
              }
            }}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Classroom'}
            </Button>
            <Dialog open={showBatchUploadDialog} onOpenChange={setShowBatchUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UploadCloud className="mr-2 h-4 w-4" /> Batch Upload (CSV)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Batch Upload Classrooms</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to add multiple classrooms. Ensure your CSV has columns: `building`, `roomNumber`, `section`, `capacity` (optional).
                    <br />This feature is currently in development.
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
                  <Button onClick={handleBatchClassroomUpload} disabled={!batchFile}>Process File</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => toast({ title: "External Sync", description: "Syncing with external building management APIs is planned for a future update." })} >
              <ExternalLink className="mr-2 h-4 w-4" /> Sync External API
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-md">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField 
                    control={form.control} 
                    name="building" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building / Wing (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Main Building, Block D" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="roomNumber" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room Number / Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 101, Lab A, D114" {...field} value={field.value ?? ''} />
                        </FormControl>
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
                        <FormControl>
                          <Input placeholder="e.g., A, Morning Batch" {...field} value={field.value ?? ''} />
                        </FormControl>
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
                </div>

                <Card className="p-4">
                  <CardTitle className="text-lg mb-2">Camera Setup</CardTitle>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cameraSetupType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Camera Source Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'default'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select camera type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="default">Default Connected Camera</SelectItem>
                              <SelectItem value="ip">IP Camera</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch('cameraSetupType') === 'ip' && (
                      <FormField
                        control={form.control}
                        name="ipCameraUrlsInput"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IP Camera URLs</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter IP camera URLs, one per line."
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter each IP camera URL on a new line. Ensure these are accessible by the attendance system.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </Card>

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
                  <TableHead>Building</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Camera Setup</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell>{classroom.building || 'N/A'}</TableCell>
                    <TableCell>{classroom.roomNumber}</TableCell>
                    <TableCell>{classroom.section}</TableCell>
                    <TableCell>{classroom.capacity || 'N/A'}</TableCell>
                    <TableCell>
                      {classroom.cameraSetup?.type === 'ip'
                        ? `IP (${classroom.cameraSetup.ipCameraUrls?.length || 0} URL/s)`
                        : 'Default'
                      }
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleViewSchedule(classroom)} title="View Classroom Schedule">
                        <CalendarSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(classroom)} title="Edit Classroom">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toast({ title: "Delete", description: "Delete functionality coming soon." })} title="Delete Classroom">
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

      {/* Classroom Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule for {selectedClassroomForSchedule?.building ? `${selectedClassroomForSchedule.building} - ` : ''}{selectedClassroomForSchedule?.roomNumber} - {selectedClassroomForSchedule?.section}</DialogTitle>
            <DialogDescription>Showing all classes scheduled in this classroom.</DialogDescription>
          </DialogHeader>
          {isLoadingSchedule ? (
            <div className="flex justify-center items-center h-40"><p>Loading schedule...</p></div>
          ) : classroomSchedule.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No classes scheduled for this classroom.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classroomSchedule.map(sc => (
                    <TableRow key={sc.id}>
                      <TableCell>{sc.subjectName} {sc.subjectCode && `(${sc.subjectCode})`}</TableCell>
                      <TableCell>{allTeachers.find(t => t.id === sc.teacherId)?.name || sc.teacherName || 'N/A'}</TableCell>
                      <TableCell>{sc.daysOfWeek.join(', ')}</TableCell>
                      <TableCell>{sc.startTime} - {sc.endTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowScheduleDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}