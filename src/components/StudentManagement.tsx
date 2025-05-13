
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
import { db, storage } from '@/lib/firebase'; 
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore'; // Removed getDoc as it's not used directly here
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { FileUp, PlusCircle, UploadCloud, Trash2, UserCircle2, AlertTriangle, UsersRound, Edit3 as EditIcon } from 'lucide-react'; // Renamed Edit3 to EditIcon
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
import { detectFaceAction, addFaceToFaceSetAction, getInstituteFacesetToken } from '@/actions/faceplusplus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


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
  const [showForm, setShowForm] = useState(action === 'add');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  const [selectedStudentForImage, setSelectedStudentForImage] = useState<Student | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [instituteFacesetToken, setInstituteFacesetToken] = useState<string | null>(null);


  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { studentIdNo: '', name: '', course: '', year: undefined, section: '' },
  });
  
  useEffect(() => {
    if (action === 'add' && !editingStudent) {
        setShowForm(true);
        form.reset({ studentIdNo: '', name: '', course: '', year: undefined, section: '' });
    }
  }, [action, form, editingStudent]);

  useEffect(() => {
    if (instituteId) {
      fetchStudents();
      fetchFacesetToken();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchFacesetToken() {
    if (!instituteId) return;
    const token = await getInstituteFacesetToken(instituteId);
    setInstituteFacesetToken(token);
  }

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

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.reset({
      studentIdNo: student.studentIdNo,
      name: student.name,
      course: student.course,
      year: student.year ?? undefined,
      section: student.section ?? '',
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setShowForm(false);
    form.reset({ studentIdNo: '', name: '', course: '', year: undefined, section: '' });
  };


  async function onSubmit(values: z.infer<typeof studentFormSchema>) {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const studentData: Omit<Student, 'id' | 'createdAt' | 'imageUrl' | 'faceToken'> & { createdAt?: any, updatedAt?: any, imageUrl?: string, faceToken?: string } = {
        studentIdNo: values.studentIdNo,
        name: values.name,
        course: values.course,
        year: values.year ? Number(values.year) : undefined,
        section: values.section || undefined,
        instituteId,
      };

      if (editingStudent && editingStudent.id) {
        const studentDocRef = doc(db, "students", editingStudent.id);
        // Preserve existing imageUrl and faceToken if not being changed by this form
        studentData.imageUrl = editingStudent.imageUrl; 
        studentData.faceToken = editingStudent.faceToken;
        studentData.updatedAt = serverTimestamp();
        await updateDoc(studentDocRef, studentData);
        toast({ title: 'Student Updated', description: `${values.name} updated successfully.` });
      } else {
        studentData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'students'), studentData);
        toast({ title: 'Student Added', description: `${values.name} added successfully.` });
      }
      
      form.reset({ studentIdNo: '', name: '', course: '', year: undefined, section: '' });
      setShowForm(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save student.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleImageUpload = async () => {
    if (!imageFile || !selectedStudentForImage || !selectedStudentForImage.id || !instituteId) {
        toast({ variant: "destructive", title: "Upload Error", description: "No image, student, or institute ID." });
        return;
    }
    if (!instituteFacesetToken) {
        toast({ variant: "destructive", title: "Configuration Error", description: "Institute FaceSet token not found. Cannot process image for facial recognition." });
        setIsUploadingImage(false);
        return;
    }

    setIsUploadingImage(true);
    
    let downloadURL = '';
    try {
        const filePath = `institutes/${instituteId}/students/${selectedStudentForImage.id}/${imageFile.name}`;
        const imageStorageRef = storageRef(storage, filePath);
        await uploadBytes(imageStorageRef, imageFile);
        downloadURL = await getDownloadURL(imageStorageRef);

        const detectResult = await detectFaceAction(downloadURL); 
        if (!detectResult.success || !detectResult.faceToken) {
            toast({ variant: "destructive", title: "Face Detection Failed", description: detectResult.error || "Could not detect a face in the uploaded image." });
            setIsUploadingImage(false);
            return;
        }
        const { faceToken: newFaceToken } = detectResult;

        const addFaceResult = await addFaceToFaceSetAction(instituteFacesetToken, newFaceToken);
        if (!addFaceResult.success) {
            toast({ variant: "destructive", title: "Face Registration Failed", description: addFaceResult.error || "Could not add face to the institute's recognition set." });
            setIsUploadingImage(false);
            return;
        }

        const studentDocRef = doc(db, "students", selectedStudentForImage.id);
        await updateDoc(studentDocRef, { 
            imageUrl: downloadURL,
            faceToken: newFaceToken 
        });

        toast({ title: "Image Processed", description: `Image for ${selectedStudentForImage.name} uploaded and face registered.` });
        fetchStudents(); 
        setImageFile(null);
        setSelectedStudentForImage(null);
        if(imageInputRef.current) imageInputRef.current.value = "";

    } catch (error: any) {
        console.error("Error uploading image and processing face: ", error);
        toast({ variant: "destructive", title: "Upload Failed", description: error.message || "Could not upload image or process face." });
    } finally {
        setIsUploadingImage(false);
    }
  };
  
  const handleBatchStudentUpload = () => {
    toast({ title: "Batch Add Students", description: "Student batch upload feature (CSV/Excel) is coming soon!"});
  }
  
  const handleBatchImageUpload = () => {
    toast({ title: "Batch Upload Photos", description: "Batch image upload for multiple students (e.g., ZIP file) is coming soon!"});
  }

  const handleManageEnrollments = (student: Student) => {
    toast({ title: "Manage Enrollments", description: `Functionality to manage class enrollments for ${student.name} is coming soon.`});
  }


  if (!instituteId) return <p className="text-destructive text-center p-4">Institute ID not found.</p>;

  return (
    <div className="space-y-6">
      {!instituteFacesetToken && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Facial Recognition Not Configured</AlertTitle>
          <AlertDescription>
            This institute does not have a FaceSet configured for facial recognition. 
            Image uploads will not be processed for attendance. Please contact support or re-register the institute if this is an error.
          </AlertDescription>
        </Alert>
      )}
      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl">{editingStudent ? 'Edit Student' : 'Manage Students'}</CardTitle>
                <CardDescription>Register students, upload photos, and manage records.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => {
                  if (showForm) {
                    handleCancelEdit();
                  } else {
                    setEditingStudent(null);
                    form.reset({ studentIdNo: '', name: '', course: '', year: undefined, section: '' });
                    setShowForm(true);
                  }
                }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Student'}
                </Button>
                <Button variant="outline" onClick={handleBatchStudentUpload}> <FileUp className="mr-2 h-4 w-4" /> Batch Add Students </Button>
                <Button variant="outline" onClick={handleBatchImageUpload} disabled={!instituteFacesetToken}> <UploadCloud className="mr-2 h-4 w-4" /> Batch Upload Photos </Button>
            </div>
        </CardHeader>
        {showForm && (
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-md">
                <FormField control={form.control} name="studentIdNo" render={({ field }) => (<FormItem><FormLabel>Student ID No.</FormLabel><FormControl><Input placeholder="e.g., S1001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="course" render={({ field }) => (<FormItem><FormLabel>Course</FormLabel><FormControl><Input placeholder="B.Sc. Computer Science" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField 
                  control={form.control} 
                  name="year" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 1" 
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
                <FormField control={form.control} name="section" render={({ field }) => (<FormItem><FormLabel>Section (Optional)</FormLabel><FormControl><Input placeholder="e.g., A" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? (editingStudent ? 'Updating...' : 'Adding...') : (editingStudent ? 'Update Student' : 'Add Student')}</Button>
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
                  <TableHead>Face Token Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => (
                  <TableRow key={student.id}>
                    <TableCell>
                      {student.imageUrl ? 
                        <Image src={student.imageUrl} alt={student.name} width={40} height={40} className="rounded-full object-cover" data-ai-hint="student portrait" unoptimized/> : 
                        <UserCircle2 className="h-10 w-10 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>{student.studentIdNo}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.course}</TableCell>
                    <TableCell>{student.year || 'N/A'}</TableCell>
                    <TableCell>{student.section || 'N/A'}</TableCell>
                    <TableCell>
                      {student.faceToken ? 
                        <span className="text-green-600">Registered</span> : 
                        <span className="text-orange-500">Not Registered</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        <Dialog onOpenChange={(open) => { if(!open) {setSelectedStudentForImage(null); setImageFile(null); if(imageInputRef.current) imageInputRef.current.value = "";} }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => setSelectedStudentForImage(student)} disabled={!instituteFacesetToken} title="Upload Student Photo">
                                    <UploadCloud className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                <DialogTitle>Upload Photo for {selectedStudentForImage?.name}</DialogTitle>
                                <DialogDescription>
                                    Select an image file (PNG, JPG). The first detected face will be used for recognition.
                                    {!instituteFacesetToken && <span className="text-destructive block mt-2">Warning: Institute FaceSet token not found. Facial recognition features will be disabled.</span>}
                                </DialogDescription>
                                </DialogHeader>
                                <Input type="file" accept="image/png, image/jpeg" ref={imageInputRef} onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />
                                {imageFile && <p className="text-sm text-muted-foreground">Selected: {imageFile.name}</p>}
                                <DialogFooter>
                                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                  <Button onClick={handleImageUpload} disabled={!imageFile || isUploadingImage || !instituteFacesetToken}>
                                    {isUploadingImage ? "Processing..." : "Upload & Register Face"}
                                  </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="icon" onClick={() => handleManageEnrollments(student)} title="Manage Enrollments">
                            <UsersRound className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleEdit(student)} title="Edit Student">
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toast({title: "Delete Student", description: "Delete functionality coming soon."})} title="Delete Student">
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
