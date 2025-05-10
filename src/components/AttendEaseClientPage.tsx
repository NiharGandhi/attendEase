"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Student, AttendanceRecord, Course } from '@/types';
import VideoFeed from '@/components/VideoFeed';
import AttendanceList from '@/components/AttendanceList';
import { matchScheduleToKnownStudents } from '@/ai/flows/match-schedule-to-known-students';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Clock, AlertTriangle } from "lucide-react";

// Simulated data (replace with actual data source if available)
const ALL_COURSES: Course[] = [
  { id: 'cs101', name: 'Computer Science 101', schedule: 'Mon/Wed 9-10AM' },
  { id: 'phy202', name: 'Physics 202', schedule: 'Tue/Thu 1-2:30PM' },
  { id: 'math303', name: 'Mathematics 303', schedule: 'Fri 11AM-1PM' },
];

const ALL_STUDENTS: Student[] = [
  { id: 's1', name: 'Alice Wonderland', courses: ['cs101', 'math303'] },
  { id: 's2', name: 'Bob The Builder', courses: ['cs101', 'phy202'] },
  { id: 's3', name: 'Charlie Brown', courses: ['phy202', 'math303'] },
  { id: 's4', name: 'Diana Prince', courses: ['cs101'] },
  { id: 's5', name: 'Edward Scissorhands', courses: ['math303'] },
  { id: 's6', name: 'Fiona Apple', courses: ['phy202'] },
];

const ATTENDANCE_INTERVAL_MS = 15 * 1000; // 15 seconds for demo, original request was 5 minutes
const RECOGNITION_FEEDBACK_DURATION_MS = 3000; // How long to show "recognized" students

const AttendEaseClientPage: React.FC = () => {
  const [currentCourseId, setCurrentCourseId] = useState<string>(ALL_COURSES[0].id);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedStudentsForInterval, setRecognizedStudentsForInterval] = useState<string[]>([]);
  const { toast } = useToast();

  const currentCourse = useMemo(() => ALL_COURSES.find(c => c.id === currentCourseId) || ALL_COURSES[0], [currentCourseId]);

  const handleCameraStateChange = useCallback((isActive: boolean) => {
    setIsCameraActive(isActive);
    if (!isActive) {
      // Clear processing state if camera turns off
      setIsProcessing(false);
      setRecognizedStudentsForInterval([]);
    }
  }, []);

  const simulateRecognitionAndRecordAttendance = useCallback(async () => {
    if (!isCameraActive || isProcessing) return;

    setIsProcessing(true);
    setRecognizedStudentsForInterval([]); // Clear previous interval's recognized students

    try {
      // 1. Get students expected in the current course using the AI flow
      const knownStudentNames = ALL_STUDENTS.map(s => s.name);
      const expectedStudentNames = await matchScheduleToKnownStudents({
        currentCourse: currentCourse.name,
        knownStudents: knownStudentNames,
      });

      // 2. Simulate face detection: Randomly "detect" a few students from the entire student body
      // This simulates the raw output from a face recognition system before filtering
      const numberOfSimulatedDetections = Math.floor(Math.random() * 3) + 1; // Detect 1 to 3 students
      const simulatedDetectedStudents: Student[] = [];
      const availableStudents = [...ALL_STUDENTS];
      for (let i = 0; i < numberOfSimulatedDetections; i++) {
        if (availableStudents.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableStudents.length);
        simulatedDetectedStudents.push(availableStudents.splice(randomIndex, 1)[0]);
      }
      
      // 3. Filter simulated detections: Only mark attendance for students who are
      //    a) "Detected" by the simulation AND
      //    b) Expected in the current course (output of matchScheduleToKnownStudents)
      const newRecognizedNames: string[] = [];
      const newAttendanceRecords: AttendanceRecord[] = [];

      for (const detectedStudent of simulatedDetectedStudents) {
        if (expectedStudentNames.includes(detectedStudent.name)) {
          // Check if this student for this course was already marked in the last 5 minutes (simulated)
          // For a real 5-min interval, you'd compare against actual 5-min marks.
          // Here, we simplify: if already present in this session for this course, don't re-add unless it's a new "interval".
          // This simplified logic adds a new record each interval for demo purposes.
          
          newRecognizedNames.push(detectedStudent.name);
          newAttendanceRecords.push({
            studentName: detectedStudent.name,
            courseName: currentCourse.name,
            timestamp: new Date(),
            status: 'present',
          });
        }
      }

      if (newRecognizedNames.length > 0) {
        setRecognizedStudentsForInterval(newRecognizedNames);
        setAttendanceRecords(prevRecords => [...prevRecords, ...newAttendanceRecords]);
        toast({
          title: "Attendance Recorded",
          description: `${newRecognizedNames.join(', ')} marked present for ${currentCourse.name}.`,
          variant: "default",
        });
        
        // Clear the "recognized" students feedback after a delay
        setTimeout(() => {
          setRecognizedStudentsForInterval([]);
        }, RECOGNITION_FEEDBACK_DURATION_MS);
      } else {
         // toast({
         //   title: "No New Recognitions",
         //   description: `No new students recognized for ${currentCourse.name} in this scan.`,
         //   variant: "default", // Use 'default' or 'destructive' based on preference for this message
         // });
      }

    } catch (error) {
      console.error("Error during attendance processing:", error);
      toast({
        title: "Processing Error",
        description: "An error occurred while trying to record attendance.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [currentCourse, isCameraActive, isProcessing, toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isCameraActive) {
      // Initial call
      simulateRecognitionAndRecordAttendance();
      // Set up interval
      intervalId = setInterval(simulateRecognitionAndRecordAttendance, ATTENDANCE_INTERVAL_MS);
    } else if (intervalId) {
      clearInterval(intervalId);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive, simulateRecognitionAndRecordAttendance]);

  return (
    <div className="min-h-screen bg-secondary p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mb-8 text-center md:text-left">
        <h1 className="text-4xl font-bold text-primary">AttendEase</h1>
        <p className="text-muted-foreground">Real-time University Attendance System</p>
      </header>

      <main className="w-full max-w-5xl space-y-6">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center">
                <BookOpen className="mr-3 h-6 w-6 text-accent" /> Course Information
            </CardTitle>
            <CardDescription>Select the course for which attendance is being taken.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
              <Select value={currentCourseId} onValueChange={setCurrentCourseId}>
                <SelectTrigger className="w-full sm:w-[300px] bg-background">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_COURSES.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentCourse.schedule && (
                <div className="flex items-center text-sm text-muted-foreground p-2 border rounded-md bg-background">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <span>{currentCourse.schedule}</span>
                </div>
              )}
            </div>
            {!isCameraActive && (
                 <div className="flex items-start p-3 rounded-md bg-yellow-50 border border-yellow-300 text-yellow-700">
                    <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                    <p className="text-sm">
                    Camera is currently off. Please start the camera on the video feed below to begin attendance tracking.
                    </p>
                </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VideoFeed onCameraStateChange={handleCameraStateChange} isCameraActiveProp={isCameraActive} />
          <AttendanceList records={attendanceRecords} recognizedStudentsForInterval={recognizedStudentsForInterval} />
        </div>
      </main>
      <footer className="w-full max-w-5xl mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} AttendEase. All rights reserved.</p>
        <p>Facial recognition simulation for demonstration purposes.</p>
      </footer>
    </div>
  );
};

export default AttendEaseClientPage;
