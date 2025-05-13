
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { ScheduledClass, Student, Employee } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CalendarDays, User, BookUser, Filter } from 'lucide-react';

type ViewMode = 'student' | 'teacher';
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export default function TimetableView() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Employee[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [filteredTimetable, setFilteredTimetable] = useState<ScheduledClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  useEffect(() => {
    filterTimetable();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, viewMode, scheduledClasses]);

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

      const fetchedClasses = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledClass));
      setScheduledClasses(fetchedClasses);
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setTeachers(teacherSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch timetable data.' });
    } finally {
      setIsLoading(false);
    }
  }

  function filterTimetable() {
    if (!selectedEntityId) {
      setFilteredTimetable([]);
      return;
    }
    let filtered: ScheduledClass[] = [];
    if (viewMode === 'student') {
      filtered = scheduledClasses.filter(sc => sc.studentIds.includes(selectedEntityId));
    } else if (viewMode === 'teacher') {
      filtered = scheduledClasses.filter(sc => sc.teacherId === selectedEntityId);
    }
    // Sort by day and then by start time
    filtered.sort((a, b) => {
        const dayComparison = daysOfWeek.indexOf(a.dayOfWeek) - daysOfWeek.indexOf(b.dayOfWeek);
        if (dayComparison !== 0) return dayComparison;
        return a.startTime.localeCompare(b.startTime);
    });
    setFilteredTimetable(filtered);
  }
  
  const handleViewModeChange = (value: string) => {
    setViewMode(value as ViewMode);
    setSelectedEntityId(null); // Reset selection when mode changes
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
                  </SelectContent>
                </Select>
              </div>
            )}
             <Button onClick={filterTimetable} disabled={!selectedEntityId || isLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Filter className="mr-2 h-4 w-4"/> Show Timetable
            </Button>
          </div>

          {isLoading && <p>Loading data...</p>}
          
          {!isLoading && selectedEntityId && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly Schedule for {getEntityName()}</CardTitle>
                {filteredTimetable.length === 0 && <CardDescription>No classes scheduled for the selected {viewMode}.</CardDescription>}
              </CardHeader>
              <CardContent>
                {daysOfWeek.map(day => {
                  const classesForDay = filteredTimetable.filter(c => c.dayOfWeek === day);
                  if (classesForDay.length === 0) return null;

                  return (
                    <div key={day} className="mb-4">
                      <h3 className="text-lg font-semibold text-primary mb-2 border-b pb-1">{day}</h3>
                      <ul className="space-y-2">
                        {classesForDay.map(sc => (
                          <li key={sc.id} className="p-3 border rounded-md shadow-sm bg-card">
                            <p className="font-medium">{sc.subjectName} {sc.subjectCode && `(${sc.subjectCode})`}</p>
                            <p className="text-sm text-muted-foreground">
                              Time: {sc.startTime} - {sc.endTime}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Classroom: {sc.classroomDiplayName || 'N/A'}
                            </p>
                            {viewMode === 'student' && sc.teacherName && (
                                <p className="text-sm text-muted-foreground">Teacher: {sc.teacherName}</p>
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
