
"use client";

import type { Student, StudentFormData } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Assuming firebase storage is also exported or handled elsewhere for image uploads
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // For image uploads
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { FileUp, PlusCircle, UploadCloud, Trash2, UserCircle2 } from 'lucide-react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"


const studentFormSchema = z.object({
  studentIdNo: z.string().min(1, { message: "Student ID is required." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  course: z.string().min(2, { message: "Course is required." }),
  year: z.coerce.number().positive({ message: "Year must be a positive number." }).optional(),
  section: z.string().optional(),
});

export default function StudentManagement() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  const action = searchParams.get('action');

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(action === 'add');
  
  const [selectedStudentForImage, setSelectedStudentForImage] = useState<Student | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);


  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { studentIdNo: '', name: '', course: '', year: '' as unknown as number, section: '' },
  });
  
  useEffect(() => {
    setShowAddForm(action === 'add');
  }, [action]);

  useEffect(() => {
    if (instituteId) fetchStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchStudents() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'students'), where('instituteId', '==', instituteId));
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch students.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof studentFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const studentData: Omit<Student, 'id' | 'createdAt' | 'imageUrl' | 'faceData'> & { createdAt: any } = {
        studentIdNo: values.studentIdNo,
        name: values.name,
        course: values.course,
        year: values.year ? Number(values.year) : undefined,
        section: values.section || undefined,
        instituteId,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'students'), studentData);
      toast({ title: 'Student Added', description: `${values.name} added successfully.` });
      form.reset();
      setShowAddForm(false);
      fetchStudents();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add student.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleImageUpload = async () => {
    if (!imageFile || !selectedStudentForImage || !selectedStudentForImage.id) {
        toast({ variant: "destructive", title: "Upload Error", description: "No image selected or student invalid." });
        return;
    }
    setIsUploadingImage(true);
    // Placeholder: Firebase Storage upload logic would go here
    // const filePath = `institutes/${instituteId}/students/${selectedStudentForImage.id}/${imageFile.name}`;
    // const storageRef = ref(storage, filePath);
    try {
        // await uploadBytes(storageRef, imageFile);
        // const downloadURL = await getDownloadURL(storageRef);
        
        // SIMULATING UPLOAD
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        const simulatedDownloadURL = `https://picsum.photos/seed/${selectedStudentForImage.id}/200/200`; // Placeholder URL

        // Update Firestore
        const studentDocRef = doc(db, "students", selectedStudentForImage.id);
        await updateDoc(studentDocRef, { imageUrl: simulatedDownloadURL });


        toast({ title: "Image Uploaded", description: `Image for ${selectedStudentForImage.name} updated.` });
        fetchStudents(); // Refresh student list to show new image
        setImageFile(null);
        setSelectedStudentForImage(null);
        if(imageInputRef.current) imageInputRef.current.value = "";

    } catch (error) {
        console.error("Error uploading image: ", error);
        toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload image." });
    } finally {
        setIsUploadingImage(false);
    }
  };
  
  const handleBatchStudentUpload = () => {
    toast({ title: "Batch Upload", description: "Student batch upload feature is coming soon!"});
  }
  
  const handleBatchImageUpload = () => {
    toast({ title: "Batch Image Upload", description: "Batch image upload feature is coming soon!"});
  }


  if (!instituteId) return <p className="text-destructive text-center p-4">Institute ID not found.</p>;

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl">Manage Students</CardTitle>
                <CardDescription>Register students, upload photos, and manage records.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {showAddForm ? 'Cancel' : 'Add Student'}
                </Button>
                <Button variant="outline" onClick={handleBatchStudentUpload}> <FileUp className="mr-2 h-4 w-4" /> Batch Add Students </Button>
                <Button variant="outline" onClick={handleBatchImageUpload}> <UploadCloud className="mr-2 h-4 w-4" /> Batch Upload Photos </Button>
            </div>
        </CardHeader>
        {showAddForm && (
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-md">
                <FormField control={form.control} name="studentIdNo" render={({ field }) => (<FormItem><FormLabel>Student ID No.</FormLabel><FormControl><Input placeholder="e.g., S1001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="course" render={({ field }) => (<FormItem><FormLabel>Course</FormLabel><FormControl><Input placeholder="B.Sc. Computer Science" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year (Optional)</FormLabel><FormControl><Input type="number" placeholder="e.g., 1" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="section" render={({ field }) => (<FormItem><FormLabel>Section (Optional)</FormLabel><FormControl><Input placeholder="e.g., A" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Student'}</Button>
                </form>
            </Form>
            </CardContent>
        )}
      </Card>

      <Card className="shadow-xl">
        <CardHeader><CardTitle>Student List</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading students...</p> : students.length === 0 ? <p>No students found.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => (
                  <TableRow key={student.id}>
                    <TableCell>
                      {student.imageUrl ? 
                        <Image src={student.imageUrl} alt={student.name} width={40} height={40} className="rounded-full object-cover" data-ai-hint="student portrait" /> : 
                        <UserCircle2 className="h-10 w-10 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>{student.studentIdNo}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.course}</TableCell>
                    <TableCell>{student.year || 'N/A'}</TableCell>
                    <TableCell>{student.section || 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                        <Dialog onOpenChange={(open) => { if(!open) {setSelectedStudentForImage(null); setImageFile(null); if(imageInputRef.current) imageInputRef.current.value = "";} }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => setSelectedStudentForImage(student)}>
                                    <UploadCloud className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                <DialogTitle>Upload Photo for {selectedStudentForImage?.name}</DialogTitle>
                                <DialogDescription>Select an image file (PNG, JPG, GIF up to 10MB).</DialogDescription>
                                </DialogHeader>
                                <Input type="file" accept="image/*" ref={imageInputRef} onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />
                                {imageFile && <p className="text-sm text-muted-foreground">Selected: {imageFile.name}</p>}
                                <DialogFooter>
                                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                  <Button onClick={handleImageUpload} disabled={!imageFile || isUploadingImage}>
                                    {isUploadingImage ? "Uploading..." : "Upload"}
                                  </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => toast({title: "Edit", description: "Edit functionality coming soon."})}>
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

