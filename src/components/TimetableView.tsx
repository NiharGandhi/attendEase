
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { ScheduledClass, Student, Employee, DayOfWeek } from '@/lib/types'; // Removed ClassScheduleItem
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CalendarDays, User, BookUser, Filter } from 'lucide-react';
import { daysOfWeekArray } from '@/lib/types';

type ViewMode = 'student' | 'teacher';

interface TimetableDisplayEntry {
  id: string; // Original ScheduledClass ID + day for uniqueness
  subjectName: string;
  subjectCode?: string;
  classroomDiplayName?: string;
  teacherName?: string; // For student view
  studentCount?: number; // For teacher view
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export default function TimetableView() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const [allScheduledClasses, setAllScheduledClasses] = useState<ScheduledClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Employee[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [filteredTimetable, setFilteredTimetable] = useState<TimetableDisplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  useEffect(() => {
    generateTimetable();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, viewMode, allScheduledClasses]);

  async function fetchInitialData() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const classQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
      const studentQuery = query(collection(db, 'students'), where('instituteId', '==', instituteId));
      const teacherQuery = query(collection(db, 'employees'), where('instituteId', '==', instituteId), where('role', '==', 'teacher'));
      
      const [classSnap, studentSnap, teacherSnap] = await Promise.all([
        getDocs(classQuery),
        getDocs(studentQuery),
        getDocs(teacherQuery),
      ]);

      // Fetch classrooms to map classroomDiplayName
      const classroomQuery = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));
      const classroomSnap = await getDocs(classroomQuery);
      const fetchedClassrooms = classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Classroom, 'id'> }));


      const fetchedTeachers = teacherSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      
      const fetchedClasses = classSnap.docs.map(doc => {
        const data = doc.data() as ScheduledClass;
        const classroom = fetchedClassrooms.find(c => c.id === data.classroomId);
        const teacher = fetchedTeachers.find(t => t.id === data.teacherId);
        return { 
            id: doc.id, 
            ...data,
            classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}` : data.classroomDiplayName || 'N/A',
            teacherName: teacher ? teacher.name : data.teacherName || 'N/A',
        } as ScheduledClass;
      });
      
      setAllScheduledClasses(fetchedClasses);
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setTeachers(fetchedTeachers);
      
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch timetable data.' });
    } finally {
      setIsLoading(false);
    }
  }

  function generateTimetable() {
    if (!selectedEntityId || !allScheduledClasses) {
      setFilteredTimetable([]);
      return;
    }
    
    let relevantEntries: TimetableDisplayEntry[] = [];

    allScheduledClasses.forEach(sc => {
      const isRelevant = 
        (viewMode === 'student' && sc.studentIds && Array.isArray(sc.studentIds) && sc.studentIds.includes(selectedEntityId)) ||
        (viewMode === 'teacher' && sc.teacherId === selectedEntityId);

      if (isRelevant && sc.daysOfWeek && Array.isArray(sc.daysOfWeek)) {
        sc.daysOfWeek.forEach(day => {
          relevantEntries.push({
            id: `${sc.id}-${day}`,
            subjectName: sc.subjectName,
            subjectCode: sc.subjectCode,
            classroomDiplayName: sc.classroomDiplayName,
            teacherName: sc.teacherName,
            studentCount: sc.studentIds?.length || 0,
            dayOfWeek: day,
            startTime: sc.startTime,
            endTime: sc.endTime,
          });
        });
      }
    });

    relevantEntries.sort((a, b) => {
        const dayComparison = daysOfWeekArray.indexOf(a.dayOfWeek) - daysOfWeekArray.indexOf(b.dayOfWeek);
        if (dayComparison !== 0) return dayComparison;
        return a.startTime.localeCompare(b.startTime);
    });
    setFilteredTimetable(relevantEntries);
  }
  
  const handleViewModeChange = (value: string) => {
    setViewMode(value as ViewMode);
    setSelectedEntityId(null); 
    setFilteredTimetable([]);
  }

  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  const getEntityName = () => {
    if (!selectedEntityId) return "Selected Person";
    if (viewMode === 'student') {
        return students.find(s => s.id === selectedEntityId)?.name || "Selected Student";
    }
    return teachers.find(t => t.id === selectedEntityId)?.name || "Selected Teacher";
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary"/>Timetable Viewer</CardTitle>
          <CardDescription>View weekly schedules for students or teachers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end p-4 border rounded-md bg-muted/50">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="viewModeSelect" className="block text-sm font-medium mb-1">View Timetable For:</label>
              <Select onValueChange={handleViewModeChange} value={viewMode}>
                <SelectTrigger id="viewModeSelect">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student"><User className="inline-block mr-2 h-4 w-4"/>Student</SelectItem>
                  <SelectItem value="teacher"><BookUser className="inline-block mr-2 h-4 w-4"/>Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {viewMode === 'student' && (
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="studentSelect" className="block text-sm font-medium mb-1">Select Student:</label>
                <Select onValueChange={setSelectedEntityId} value={selectedEntityId || ""}>
                  <SelectTrigger id="studentSelect">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id!}>{s.name} ({s.studentIdNo})</SelectItem>)}
                     {students.length === 0 && <SelectItem value="no-students" disabled>No students found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'teacher' && (
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="teacherSelect" className="block text-sm font-medium mb-1">Select Teacher:</label>
                <Select onValueChange={setSelectedEntityId} value={selectedEntityId || ""}>
                  <SelectTrigger id="teacherSelect">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}
                    {teachers.length === 0 && <SelectItem value="no-teachers" disabled>No teachers found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
             <Button onClick={generateTimetable} disabled={!selectedEntityId || isLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Filter className="mr-2 h-4 w-4"/> Show Timetable
            </Button>
          </div>

          {isLoading && <p className="text-center py-4">Loading data...</p>}
          
          {!isLoading && selectedEntityId && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly Schedule for {getEntityName()}</CardTitle>
                {filteredTimetable.length === 0 && <CardDescription>No classes scheduled for the selected {viewMode}.</CardDescription>}
              </CardHeader>
              <CardContent>
                {daysOfWeekArray.map(day => {
                  const classesForDay = filteredTimetable.filter(entry => entry.dayOfWeek === day);
                  if (classesForDay.length === 0) return null;

                  return (
                    <div key={day} className="mb-6">
                      <h3 className="text-xl font-semibold text-primary mb-3 border-b pb-2">{day}</h3>
                      <ul className="space-y-3">
                        {classesForDay.map(entry => (
                          <li key={entry.id} className="p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow">
                            <p className="font-semibold text-lg">{entry.subjectName} {entry.subjectCode && `(${entry.subjectCode})`}</p>
                            <p className="text-sm text-muted-foreground">
                              Time: {entry.startTime} - {entry.endTime}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Classroom: {entry.classroomDiplayName || 'N/A'}
                            </p>
                            {viewMode === 'student' && entry.teacherName && (
                                <p className="text-sm text-muted-foreground">Teacher: {entry.teacherName}</p>
                            )}
                            {viewMode === 'teacher' && (
                                <p className="text-sm text-muted-foreground">Students: {entry.studentCount}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
           {!isLoading && !selectedEntityId && (
            <p className="text-muted-foreground text-center p-4">Please select a {viewMode} to view their timetable.</p>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
