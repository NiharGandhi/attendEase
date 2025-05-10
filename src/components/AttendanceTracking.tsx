
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { Classroom, Student, AttendanceRecord } from '@/lib/types'; // Assuming types are defined
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';

// Placeholder for recognized student structure
interface RecognizedStudentInfo extends Student {
  status: 'present' | 'unknown';
  courseInfo?: string; // e.g. "CS101 - Intro to Programming"
}

export default function AttendanceTracking() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentsInClassroom, setStudentsInClassroom] = useState<Student[]>([]); // Students expected in selected class
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudentInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (instituteId) {
      fetchClassrooms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);
  
  useEffect(() => {
    // Fetch students when classroom changes
    if (selectedClassroom) {
      fetchStudentsForClassroom(selectedClassroom);
    } else {
      setStudentsInClassroom([]);
      setRecognizedStudents([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassroom]);


  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };
    getCameraPermission();

    return () => { // Cleanup
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
        if(attendanceIntervalRef.current) {
            clearInterval(attendanceIntervalRef.current);
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchClassrooms() {
    if (!instituteId) return;
    try {
      const q = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const querySnapshot = await getDocs(q);
      const fetchedClassrooms: Classroom[] = [];
      querySnapshot.forEach((doc) => fetchedClassrooms.push({ id: doc.id, ...doc.data() } as Classroom));
      setClassrooms(fetchedClassrooms);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch classrooms.' });
    }
  }
  
  async function fetchStudentsForClassroom(classroomId: string) {
    // This is a simplified fetch. In reality, you'd link students to classrooms more directly.
    // For now, we assume all students of the institute might be in any class for demo.
    if (!instituteId) return;
    try {
        const q = query(collection(db, "students"), where("instituteId", "==", instituteId));
        const studentSnapshot = await getDocs(q);
        const allStudents = studentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudentsInClassroom(allStudents); // Or filter by classroomId if data model supports it
    } catch (error) {
        console.error("Error fetching students for classroom:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load students for the selected classroom." });
    }
  }

  const captureFrameAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission || !selectedClassroom || studentsInClassroom.length === 0) {
      // If no classroom or students, don't attempt recognition
      if (isTracking && (!selectedClassroom || studentsInClassroom.length === 0)) {
        toast({variant: 'destructive', title: "Cannot Track", description: "Please select a classroom with registered students."});
        stopTracking(); // Stop tracking if conditions not met
      }
      return;
    }
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg');

    // Placeholder for MEGVII Face++ API call
    // const apiKey = process.env.FACEPLUSPLUS_API_KEY;
    // const apiSecret = process.env.FACEPLUSPLUS_API_SECRET;
    // if (!apiKey || !apiSecret) {
    //   toast({ variant: 'destructive', title: 'API Error', description: 'Face++ API credentials not configured.' });
    //   setIsProcessing(false);
    //   return;
    // }
    
    // Simulate API call and recognition
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    const currentRecognized: RecognizedStudentInfo[] = studentsInClassroom.map(student => {
        // Simulate some students being recognized
        const isRecognized = Math.random() > 0.7; // 30% chance of being recognized
        return {
            ...student,
            status: isRecognized ? 'present' : 'unknown',
            courseInfo: student.course // Simplified
        };
    });
    setRecognizedStudents(currentRecognized);

    // Record attendance for recognized students
    for (const recStudent of currentRecognized) {
        if (recStudent.status === 'present' && recStudent.id && instituteId && selectedClassroom) {
            const attendanceData: Omit<AttendanceRecord, 'id'> = {
                instituteId,
                classroomId: selectedClassroom,
                studentFirebaseId: recStudent.id,
                timestamp: serverTimestamp() as Timestamp,
                status: 'present',
                recognizedAt: serverTimestamp() as Timestamp
            };
            try {
                await addDoc(collection(db, 'attendanceRecords'), attendanceData);
            } catch (error) {
                console.error("Error recording attendance:", error);
                // Don't toast for every error to avoid spam, but log it.
            }
        }
    }
    setIsProcessing(false);
    toast({ title: 'Attendance Updated', description: 'Recognition cycle complete.' });
  };

  const startTracking = () => {
    if (!selectedClassroom) {
        toast({ variant: "destructive", title: "No Classroom Selected", description: "Please select a classroom to start attendance tracking." });
        return;
    }
    if (studentsInClassroom.length === 0) {
        toast({ variant: "destructive", title: "No Students", description: "No students registered for this classroom. Add students first." });
        return;
    }
    setIsTracking(true);
    captureFrameAndRecognize(); // Initial capture
    attendanceIntervalRef.current = setInterval(captureFrameAndRecognize, 5 * 60 * 1000); // Every 5 minutes
    toast({ title: 'Attendance Tracking Started', description: `For classroom: ${classrooms.find(c=>c.id === selectedClassroom)?.roomNumber}` });
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
    }
    setRecognizedStudents([]); // Clear recognized students on stop
    toast({ title: 'Attendance Tracking Stopped' });
  };

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Live Attendance Tracking</CardTitle>
          <CardDescription>Use facial recognition to mark student attendance in real-time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <Card className="overflow-hidden shadow-md">
                <video ref={videoRef} className="w-full aspect-video rounded-t-md bg-black" autoPlay muted playsInline />
                <CardContent className="p-2 bg-muted rounded-b-md">
                    {hasCameraPermission === false && (
                    <Alert variant="destructive">
                        <Camera className="h-4 w-4" />
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>Please allow camera access in your browser settings.</AlertDescription>
                    </Alert>
                    )}
                    {hasCameraPermission === null && <p className="text-sm text-muted-foreground text-center py-2">Initializing camera...</p>}
                </CardContent>
              </Card>
              <canvas ref={canvasRef} style={{ display: 'none' }} /> {/* Hidden canvas for frame capture */}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Select onValueChange={setSelectedClassroom} value={selectedClassroom || ""} disabled={isTracking}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select Classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map(c => <SelectItem key={c.id} value={c.id!}>{c.roomNumber} - {c.section}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!isTracking ? (
                  <Button onClick={startTracking} disabled={!hasCameraPermission || !selectedClassroom || isProcessing} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Camera className="mr-2 h-4 w-4" /> Start Tracking
                  </Button>
                ) : (
                  <Button onClick={stopTracking} variant="destructive" className="w-full sm:w-auto">
                    <XCircle className="mr-2 h-4 w-4" /> Stop Tracking
                  </Button>
                )}
              </div>
               {isProcessing && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing frame...</div>}
            </div>

            <Card className="h-full shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Recognized Students</CardTitle>
                <CardDescription>Students detected in the current session for {selectedClassroom ? `${classrooms.find(c=>c.id === selectedClassroom)?.roomNumber} - ${classrooms.find(c=>c.id === selectedClassroom)?.section}` : "the selected classroom"}.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                {isTracking && recognizedStudents.length === 0 && !isProcessing && <p className="text-muted-foreground">No students recognized yet. Ensure faces are visible.</p>}
                {!isTracking && <p className="text-muted-foreground">Start tracking to see recognized students.</p>}
                <ul className="space-y-2">
                  {recognizedStudents.filter(s => s.status === 'present').map(student => (
                    <li key={student.id} className="flex items-center justify-between p-2 border rounded-md bg-green-50 border-green-200">
                      <div>
                        <p className="font-semibold">{student.name} <span className="text-xs text-muted-foreground">({student.studentIdNo})</span></p>
                        <p className="text-xs text-green-700">{student.courseInfo}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </li>
                  ))}
                   {isTracking && studentsInClassroom.filter(s => !recognizedStudents.find(rs => rs.id === s.id && rs.status === 'present')).length > 0 && (
                    <div className="mt-4">
                        <p className="text-sm font-medium text-destructive mb-1">Not Detected / Absent:</p>
                        {studentsInClassroom.filter(s => !recognizedStudents.find(rs => rs.id === s.id && rs.status === 'present')).map(student => (
                             <li key={`absent-${student.id}`} className="flex items-center justify-between p-2 border rounded-md bg-red-50 border-red-200 mb-1">
                                <div>
                                    <p className="font-semibold">{student.name} <span className="text-xs text-muted-foreground">({student.studentIdNo})</span></p>
                                    <p className="text-xs text-red-700">{student.course}</p>
                                </div>
                                <XCircle className="h-5 w-5 text-red-600" />
                            </li>
                        ))}
                    </div>
                   )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
