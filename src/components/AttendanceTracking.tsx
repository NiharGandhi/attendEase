
"use client";

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image'; // Renamed to avoid conflict
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Users, CheckCircle, XCircle, Loader2, AlertTriangle, CalendarClock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { Student, AttendanceRecord, ScheduledClass, Classroom } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, addDoc, Timestamp, doc, writeBatch, getDoc as firestoreGetDoc } from 'firebase/firestore';
import { searchFaceAction, getInstituteFacesetToken } from '@/actions/faceplusplus';

interface RecognizedStudentInfo extends Student {
  status: 'present' | 'unknown' | 'absent';
  recognizedAt?: Timestamp;
  confidence?: number;
}

export default function AttendanceTracking() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const [selectedScheduledClassId, setSelectedScheduledClassId] = useState<string | null>(null);
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [studentsForSession, setStudentsForSession] = useState<Student[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<Map<string, RecognizedStudentInfo>>(new Map());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [instituteFacesetToken, setInstituteFacesetToken] = useState<string | null>(null);
  
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // For fetching classrooms to display names in scheduled class dropdown
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);


  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
      fetchFacesetToken();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);
  
  useEffect(() => {
    if (selectedScheduledClassId && instituteId) {
      fetchStudentsForScheduledClass(selectedScheduledClassId);
    } else {
      setStudentsForSession([]);
      setSessionAttendance(new Map());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScheduledClassId, instituteId]);


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

    return () => {
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

  async function fetchFacesetToken() {
    if (!instituteId) return;
    const token = await getInstituteFacesetToken(instituteId);
    setInstituteFacesetToken(token);
  }

  async function fetchInitialData() {
    if (!instituteId) return;
    try {
      // Fetch classrooms for display purposes
      const classroomQuery = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const classroomSnap = await getDocs(classroomQuery);
      const fetchedClassrooms = classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));
      setClassrooms(fetchedClassrooms);

      // Fetch scheduled classes
      const scheduledClassQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
      const scheduledClassSnap = await getDocs(scheduledClassQuery);
      const fetchedScheduledClasses = scheduledClassSnap.docs.map(d => {
        const data = d.data() as ScheduledClass;
        const classroom = fetchedClassrooms.find(c => c.id === data.classroomId);
        return { 
          ...data, 
          id: d.id, 
          classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}`: 'N/A' 
        };
      });
      setScheduledClasses(fetchedScheduledClasses);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch initial attendance data.' });
    }
  }
  
  async function fetchStudentsForScheduledClass(scheduledClassId: string) {
    if (!instituteId) return;
    const currentScheduledClass = scheduledClasses.find(sc => sc.id === scheduledClassId);
    if (!currentScheduledClass || !currentScheduledClass.studentIds || currentScheduledClass.studentIds.length === 0) {
        setStudentsForSession([]);
        setSessionAttendance(new Map());
        toast({ variant: 'default', title: 'No Students', description: 'No students are enrolled in this selected class or student list is empty.' });
        return;
    }

    try {
        const studentDetailsPromises = currentScheduledClass.studentIds.map(studentId =>
            firestoreGetDoc(doc(db, "students", studentId))
        );
        const studentDocs = await Promise.all(studentDetailsPromises);
        
        const fetchedStudents = studentDocs
            .filter(docSnap => docSnap.exists() && docSnap.data()?.faceToken) // Only students with registered faces
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
        
        setStudentsForSession(fetchedStudents); 

        const initialAttendance = new Map<string, RecognizedStudentInfo>();
        fetchedStudents.forEach(student => {
          if(student.id) {
            initialAttendance.set(student.id, { ...student, status: 'unknown' });
          }
        });
        setSessionAttendance(initialAttendance);

    } catch (error) {
        console.error("Error fetching students for scheduled class:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load students for the selected class." });
    }
  }

  const captureFrameAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission || !selectedScheduledClassId || studentsForSession.length === 0 || !instituteFacesetToken || !instituteId) {
      if (isTracking && (!selectedScheduledClassId || studentsForSession.length === 0)) {
        toast({variant: 'destructive', title: "Cannot Track", description: "Please select a scheduled class with enrolled, face-registered students."});
      }
      if (isTracking && !instituteFacesetToken) {
        toast({variant: 'destructive', title: "Configuration Error", description: "Institute FaceSet token not found. Tracking disabled."});
      }
      if(isTracking) setIsTracking(false);
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    try {
      const searchResult = await searchFaceAction(imageDataUrl, instituteFacesetToken);
      const newSessionAttendance = new Map(sessionAttendance);
      let studentRecognizedThisCycle = false;

      if (searchResult.success && searchResult.faceToken && searchResult.confidence) {
        const matchedStudent = studentsForSession.find(s => s.faceToken === searchResult.faceToken);
        if (matchedStudent && matchedStudent.id) {
          const existingEntry = newSessionAttendance.get(matchedStudent.id);
          if (!existingEntry || existingEntry.status !== 'present') {
            newSessionAttendance.set(matchedStudent.id, {
              ...matchedStudent,
              status: 'present',
              recognizedAt: serverTimestamp() as Timestamp, // This will be client's serverTimestamp, fine for this app
              confidence: searchResult.confidence,
            });
            studentRecognizedThisCycle = true;
            toast({ title: 'Student Recognized', description: `${matchedStudent.name} marked present. Confidence: ${searchResult.confidence.toFixed(2)}%`});
          }
        } else {
          // Face recognized but not in current class list
        }
      } else if (searchResult.error && searchResult.error !== 'No confident match found.' && searchResult.error !== 'No faces detected in the search image.') { 
        toast({ variant: 'destructive', title: 'Recognition Error', description: searchResult.error || 'Face search failed.' });
      }
      
      setSessionAttendance(newSessionAttendance);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Recognition System Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const startTracking = () => {
    if (!selectedScheduledClassId) {
        toast({ variant: "destructive", title: "No Class Selected", description: "Please select a scheduled class." });
        return;
    }
    if (studentsForSession.length === 0) {
        toast({ variant: "destructive", title: "No Registered Students", description: "No students with registered faces found for this class, or no students enrolled. Add students and upload their photos first." });
        return;
    }
    if (!instituteFacesetToken) {
        toast({ variant: "destructive", title: "Configuration Error", description: "Institute FaceSet token not found." });
        return;
    }
    setIsTracking(true);
    const initialAttendance = new Map<string, RecognizedStudentInfo>();
    studentsForSession.forEach(student => {
      if(student.id) {
        initialAttendance.set(student.id, { ...student, status: 'unknown' });
      }
    });
    setSessionAttendance(initialAttendance);

    captureFrameAndRecognize(); 
    attendanceIntervalRef.current = setInterval(captureFrameAndRecognize, 30 * 1000); 
    const currentClass = scheduledClasses.find(sc => sc.id === selectedScheduledClassId);
    toast({ title: 'Attendance Tracking Started', description: `For: ${currentClass?.subjectName} (${currentClass?.dayOfWeek} ${currentClass?.startTime})` });
  };

  const stopTracking = async () => {
    setIsTracking(false);
    if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
    }
    
    if (instituteId && selectedScheduledClassId && sessionAttendance.size > 0) {
        const batch = writeBatch(db);
        const attendanceDate = new Date(); // Use current date for the attendance session
        
        sessionAttendance.forEach((studentInfo, studentId) => {
            if (studentInfo.status === 'present') {
                const recordRef = doc(collection(db, 'attendanceRecords'));
                const attendanceData: Omit<AttendanceRecord, 'id'> = {
                    instituteId,
                    scheduledClassId: selectedScheduledClassId!,
                    studentFirebaseId: studentId,
                    timestamp: Timestamp.fromDate(attendanceDate), // Consistent date for all in this session
                    status: 'present',
                    recognizedAt: studentInfo.recognizedAt || serverTimestamp() as Timestamp,
                    method: 'facial_recognition'
                };
                batch.set(recordRef, attendanceData);
            }
            // Optionally, mark others as absent if needed
        });
        try {
            await batch.commit();
            toast({ title: 'Attendance Session Saved', description: 'Final attendance recorded.' });
        } catch (error) {
            console.error("Error saving attendance batch:", error);
            toast({ variant: 'destructive', title: 'Save Error', description: 'Could not save attendance records.' });
        }
    }
    toast({ title: 'Attendance Tracking Stopped' });
  };

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }
  
  const displayedStudents = Array.from(sessionAttendance.values());
  const currentScheduledClassDetails = scheduledClasses.find(sc => sc.id === selectedScheduledClassId);

  return (
    <div className="space-y-6">
      {!instituteFacesetToken && (
         <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Facial Recognition Not Configured</AlertTitle>
          <AlertDescription>
            This institute does not have a FaceSet configured. Facial recognition is disabled.
          </AlertDescription>
        </Alert>
      )}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><Camera className="mr-2 h-6 w-6 text-primary"/>Live Attendance Tracking</CardTitle>
          <CardDescription>Select a scheduled class to begin facial recognition based attendance.</CardDescription>
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
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Select onValueChange={setSelectedScheduledClassId} value={selectedScheduledClassId || ""} disabled={isTracking}>
                  <SelectTrigger className="w-full sm:w-[300px]"> {/* Increased width for better display */}
                    <SelectValue placeholder="Select Scheduled Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduledClasses.map(sc => (
                        <SelectItem key={sc.id} value={sc.id!}>
                            {sc.subjectName} ({sc.classroomDiplayName || 'N/A'}) - {sc.dayOfWeek} {sc.startTime}-{sc.endTime}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isTracking ? (
                  <Button onClick={startTracking} disabled={!hasCameraPermission || !selectedScheduledClassId || isProcessing || !instituteFacesetToken} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                    <CalendarClock className="mr-2 h-4 w-4" /> Start Tracking
                  </Button>
                ) : (
                  <Button onClick={stopTracking} variant="destructive" className="w-full sm:w-auto">
                    <XCircle className="mr-2 h-4 w-4" /> Stop Tracking & Save
                  </Button>
                )}
              </div>
               {isProcessing && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing frame...</div>}
            </div>

            <Card className="h-full shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Session Attendance</CardTitle>
                {currentScheduledClassDetails ? (
                    <CardDescription>
                        Status for: {currentScheduledClassDetails.subjectName} ({currentScheduledClassDetails.classroomDiplayName})
                        <br/>{currentScheduledClassDetails.dayOfWeek}, {currentScheduledClassDetails.startTime} - {currentScheduledClassDetails.endTime}
                        <br/>Only face-registered, enrolled students listed.
                    </CardDescription>
                ) : (
                    <CardDescription>Select a class to view student status.</CardDescription>
                )}
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                {!selectedScheduledClassId && <p className="text-muted-foreground">Please select a scheduled class.</p>}
                {selectedScheduledClassId && !isTracking && displayedStudents.length === 0 && <p className="text-muted-foreground">Start tracking or check student enrollment & face registration.</p>}
                {isTracking && displayedStudents.length === 0 && !isProcessing && <p className="text-muted-foreground">No face-registered students loaded for this class or initial scan pending.</p>}
                
                <ul className="space-y-2">
                  {displayedStudents.map(student => (
                    <li 
                        key={student.id} 
                        className={`flex items-center justify-between p-2 border rounded-md 
                        ${student.status === 'present' ? 'bg-green-50 border-green-200' : 
                          student.status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        {student.imageUrl && <NextImage src={student.imageUrl} alt={student.name} width={32} height={32} className="rounded-full object-cover" data-ai-hint="student face" unoptimized/>}
                        <div>
                            <p className="font-semibold">{student.name} <span className="text-xs text-muted-foreground">({student.studentIdNo})</span></p>
                            <p className="text-xs">
                                {student.status === 'present' ? `Present (Conf: ${student.confidence?.toFixed(1)}%)` : student.status === 'absent' ? 'Absent' : 'Status Unknown'}
                            </p>
                        </div>
                      </div>
                      {student.status === 'present' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {student.status === 'absent' && <XCircle className="h-5 w-5 text-red-600" />}
                      {student.status === 'unknown' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

