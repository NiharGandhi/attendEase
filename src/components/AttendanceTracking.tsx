"use client";

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Users, CheckCircle, XCircle, Loader2, AlertTriangle, CalendarClock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { Student, AttendanceRecord, ScheduledClass, Classroom, ClassScheduleItem } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, addDoc, Timestamp, doc, writeBatch, getDoc as firestoreGetDoc } from 'firebase/firestore';
import { searchFaceAction, getInstituteFacesetToken } from '@/actions/faceplusplus';

interface RecognizedStudentInfo extends Student {
  status: 'present' | 'unknown' | 'absent';
  recognizedAt?: Timestamp;
  confidence?: number;
}

interface ClassOccurrence {
  id: string; // Composite key: scheduledClassId + scheduleIndex
  scheduledClassId: string;
  scheduleItem: ClassScheduleItem;
  displayText: string;
  studentIds: string[]; // Keep studentIds for fetching
  subjectName: string;
  classroomDiplayName?: string;
}


export default function AttendanceTracking() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const [selectedClassOccurrenceId, setSelectedClassOccurrenceId] = useState<string | null>(null);
  const [allScheduledClasses, setAllScheduledClasses] = useState<ScheduledClass[]>([]);
  const [classOccurrences, setClassOccurrences] = useState<ClassOccurrence[]>([]);

  const [studentsForSession, setStudentsForSession] = useState<Student[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<Map<string, RecognizedStudentInfo>>(new Map());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [instituteFacesetToken, setInstituteFacesetToken] = useState<string | null>(null);
  
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
      fetchFacesetToken();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);
  
  useEffect(() => {
    if (selectedClassOccurrenceId && instituteId) {
        const occurrence = classOccurrences.find(co => co.id === selectedClassOccurrenceId);
        if (occurrence) {
            fetchStudentsForClassOccurrence(occurrence);
        }
    } else {
      setStudentsForSession([]);
      setSessionAttendance(new Map());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassOccurrenceId, instituteId, classOccurrences]);


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
      const classroomQuery = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const classroomSnap = await getDocs(classroomQuery);
      const fetchedClassrooms = classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));

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
      setAllScheduledClasses(fetchedScheduledClasses);

      // Generate Class Occurrences for the dropdown
      const occurrences: ClassOccurrence[] = [];
      fetchedScheduledClasses.forEach(sc => {
        (sc.schedules || []).forEach((scheduleItem, index) => { // Ensure schedules is an array
          occurrences.push({
            id: `${sc.id}_${index}`, // Composite key
            scheduledClassId: sc.id!,
            scheduleItem,
            displayText: `${sc.subjectName} (${sc.classroomDiplayName || 'N/A'}) - ${scheduleItem.dayOfWeek} ${scheduleItem.startTime}-${scheduleItem.endTime}`,
            studentIds: sc.studentIds || [], // Ensure studentIds is an array
            subjectName: sc.subjectName,
            classroomDiplayName: sc.classroomDiplayName
          });
        });
      });
      setClassOccurrences(occurrences);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch initial attendance data.' });
      console.error("AttendanceTracking - fetchInitialData error:", error);
    }
  }
  
  async function fetchStudentsForClassOccurrence(occurrence: ClassOccurrence) {
    if (!instituteId || !occurrence.studentIds || occurrence.studentIds.length === 0) {
        setStudentsForSession([]);
        setSessionAttendance(new Map());
        if(occurrence.studentIds && occurrence.studentIds.length === 0) {
            toast({ variant: 'default', title: 'No Students', description: 'No students are enrolled in this selected class occurrence.' });
        }
        return;
    }

    try {
        const studentDetailsPromises = occurrence.studentIds.map(studentId =>
            firestoreGetDoc(doc(db, "students", studentId))
        );
        const studentDocs = await Promise.all(studentDetailsPromises);
        
        const fetchedStudents = studentDocs
            .filter(docSnap => docSnap.exists() && docSnap.data()?.faceToken)
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
        console.error("Error fetching students for class occurrence:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load students for the selected class occurrence." });
    }
  }

  const captureFrameAndRecognize = async () => {
    const currentOccurrence = classOccurrences.find(co => co.id === selectedClassOccurrenceId);
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission || !currentOccurrence || studentsForSession.length === 0 || !instituteFacesetToken || !instituteId) {
      if (isTracking && (!currentOccurrence || studentsForSession.length === 0)) {
        toast({variant: 'destructive', title: "Cannot Track", description: "Please select a class occurrence with enrolled, face-registered students."});
      }
      if (isTracking && !instituteFacesetToken) {
        toast({variant: 'destructive', title: "Configuration Error", description: "Institute FaceSet token not found. Tracking disabled."});
      }
      if(isTracking) setIsTracking(false); // Stop tracking if pre-conditions fail
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

      if (searchResult.success && searchResult.faceToken && searchResult.confidence) {
        const matchedStudent = studentsForSession.find(s => s.faceToken === searchResult.faceToken);
        if (matchedStudent && matchedStudent.id) {
          const existingEntry = newSessionAttendance.get(matchedStudent.id);
          if (!existingEntry || existingEntry.status !== 'present') {
            newSessionAttendance.set(matchedStudent.id, {
              ...matchedStudent,
              status: 'present',
              recognizedAt: serverTimestamp() as Timestamp,
              confidence: searchResult.confidence,
            });
            toast({ title: 'Student Recognized', description: `${matchedStudent.name} marked present. Confidence: ${searchResult.confidence.toFixed(2)}%`});
          }
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
    const currentOccurrence = classOccurrences.find(co => co.id === selectedClassOccurrenceId);
    if (!currentOccurrence) {
        toast({ variant: "destructive", title: "No Class Selected", description: "Please select a class occurrence." });
        return;
    }
    if (studentsForSession.length === 0) {
        toast({ variant: "destructive", title: "No Registered Students", description: "No students with registered faces found for this class occurrence, or no students enrolled. Add students and upload their photos first." });
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
    toast({ title: 'Attendance Tracking Started', description: `For: ${currentOccurrence.displayText}` });
  };

  const stopTracking = async () => {
    setIsTracking(false);
    if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
    }
    
    const currentOccurrence = classOccurrences.find(co => co.id === selectedClassOccurrenceId);
    if (instituteId && currentOccurrence && sessionAttendance.size > 0) {
        const batch = writeBatch(db);
        const attendanceDate = new Date(); 
        
        sessionAttendance.forEach((studentInfo, studentId) => {
            if (studentInfo.status === 'present') {
                const recordRef = doc(collection(db, 'attendanceRecords'));
                const attendanceData: Omit<AttendanceRecord, 'id'> = {
                    instituteId,
                    scheduledClassId: currentOccurrence.scheduledClassId,
                    // specificSchedule: currentOccurrence.scheduleItem, // Optional: if you need to store the exact slot
                    studentFirebaseId: studentId,
                    timestamp: Timestamp.fromDate(attendanceDate), 
                    status: 'present',
                    recognizedAt: studentInfo.recognizedAt || serverTimestamp() as Timestamp,
                    method: 'facial_recognition'
                };
                batch.set(recordRef, attendanceData);
            }
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
  const currentSelectedOccurrenceDetails = classOccurrences.find(co => co.id === selectedClassOccurrenceId);

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
          <CardDescription>Select a specific class occurrence to begin facial recognition based attendance.</CardDescription>
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
                <Select onValueChange={setSelectedClassOccurrenceId} value={selectedClassOccurrenceId || ""} disabled={isTracking}>
                  <SelectTrigger className="w-full sm:w-auto min-w-[300px] flex-grow">
                    <SelectValue placeholder="Select Class Occurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOccurrences.length === 0 && <SelectItem value="no-occurrences" disabled>No class occurrences found</SelectItem>}
                    {classOccurrences.map(co => (
                        <SelectItem key={co.id} value={co.id!}>
                            {co.displayText}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isTracking ? (
                  <Button onClick={startTracking} disabled={!hasCameraPermission || !selectedClassOccurrenceId || isProcessing || !instituteFacesetToken} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
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
                {currentSelectedOccurrenceDetails ? (
                    <CardDescription>
                        Status for: {currentSelectedOccurrenceDetails.subjectName} ({currentSelectedOccurrenceDetails.classroomDiplayName})
                        <br/>{currentSelectedOccurrenceDetails.scheduleItem.dayOfWeek}, {currentSelectedOccurrenceDetails.scheduleItem.startTime} - {currentSelectedOccurrenceDetails.scheduleItem.endTime}
                        <br/>Only face-registered, enrolled students listed.
                    </CardDescription>
                ) : (
                    <CardDescription>Select a class occurrence to view student status.</CardDescription>
                )}
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                {!selectedClassOccurrenceId && <p className="text-muted-foreground">Please select a class occurrence.</p>}
                {selectedClassOccurrenceId && !isTracking && displayedStudents.length === 0 && <p className="text-muted-foreground">Start tracking or check student enrollment & face registration.</p>}
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
