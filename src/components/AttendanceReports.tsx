
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Kept for potential future use
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { AttendanceRecord, ScheduledClass, Student, Classroom } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ClipboardList, Download, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_STUDENTS_VALUE = "__ALL_STUDENTS__";
const ALL_CLASSES_VALUE = "__ALL_CLASSES__";

export default function AttendanceReports() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allScheduledClasses, setAllScheduledClasses] = useState<ScheduledClass[]>([]); // Stores full SC objects
  
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined); // This will be ScheduledClass.id

  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceRecords, dateRange, selectedStudentId, selectedClassId]);

  async function fetchInitialData() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const recordsQuery = query(collection(db, 'attendanceRecords'), where('instituteId', '==', instituteId));
      const studentsQuery = query(collection(db, 'students'), where('instituteId', '==', instituteId));
      const classesQuery = query(collection(db, 'scheduledClasses'), where('instituteId', '==', instituteId));
      const classroomQuery = query(collection(db, 'classrooms'), where('instituteId', '==', instituteId));


      const [recordsSnap, studentsSnap, classesSnap, classroomSnap] = await Promise.all([
        getDocs(recordsQuery),
        getDocs(studentsQuery),
        getDocs(classesQuery),
        getDocs(classroomQuery),
      ]);
      
      const fetchedClassrooms = classroomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));

      const fetchedScheduledClasses = classesSnap.docs.map(d => {
        const data = d.data() as ScheduledClass;
        const classroom = fetchedClassrooms.find(c => c.id === data.classroomId);
        return { 
          ...data, 
          id: d.id, 
          classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}`: 'N/A' 
        };
      });

      setAttendanceRecords(recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setAllScheduledClasses(fetchedScheduledClasses);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch attendance data.' });
    } finally {
      setIsLoading(false);
    }
  }
  
  function applyFilters() {
    let tempRecords = [...attendanceRecords];

    if (dateRange.from) {
        const fromStartOfDay = new Date(dateRange.from);
        fromStartOfDay.setHours(0,0,0,0);
        const fromTimestamp = Timestamp.fromDate(fromStartOfDay);
        tempRecords = tempRecords.filter(r => r.timestamp >= fromTimestamp);
    }
    if (dateRange.to) {
        const toDateEnd = new Date(dateRange.to);
        toDateEnd.setHours(23, 59, 59, 999);
        const toTimestamp = Timestamp.fromDate(toDateEnd);
        tempRecords = tempRecords.filter(r => r.timestamp <= toTimestamp);
    }
    if (selectedStudentId) {
        tempRecords = tempRecords.filter(r => r.studentFirebaseId === selectedStudentId);
    }
    if (selectedClassId) { // selectedClassId is the ScheduledClass.id
        tempRecords = tempRecords.filter(r => r.scheduledClassId === selectedClassId);
    }
    setFilteredRecords(tempRecords.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
  }

  const handleExportData = () => {
    if(filteredRecords.length === 0){
        toast({variant: 'destructive', title: 'No Data', description: 'No data to export based on current filters.'});
        return;
    }
    toast({ title: "Export Data", description: "CSV export functionality is coming soon!" });
  };
  
  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || studentId;
  
  const getScheduledClassDisplay = (scheduledClassId: string, recordTimestamp: Timestamp) => {
    const sc = allScheduledClasses.find(s => s.id === scheduledClassId);
    if (!sc) return scheduledClassId;

    const recordDate = recordTimestamp.toDate();
    const recordDay = format(recordDate, 'EEEE') as any; // E.g., "Monday"
    const recordTimeMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();

    // Find the specific schedule slot that matches the record's day and approximate time
    // This is an approximation; a more robust match might be needed if classes are back-to-back
    const matchedSchedule = sc.schedules.find(slot => {
        if (slot.dayOfWeek !== recordDay) return false;
        
        // Check if recordTime is within a reasonable buffer of slot.startTime
        // For simplicity, we'll just use the day. In a real app, you might need to store
        // the specific scheduleItem in the attendance record or have more precise matching.
        // For now, the subject and classroom will be from the parent ScheduledClass.
        return true; 
    });

    let timeDisplay = "General";
    if (matchedSchedule) {
      timeDisplay = `${matchedSchedule.startTime}-${matchedSchedule.endTime}`;
    } else if (sc.schedules.length > 0) {
      // Fallback if no exact match by day/time (timestamp is key)
      // This part might need refinement based on how specific the "Class" display needs to be
      timeDisplay = "Multiple Slots";
    }

    return `${sc.subjectName} (${sc.classroomDiplayName || 'N/A'}) - ${timeDisplay}`;
  };


  if (!instituteId) {
    return <p className="text-destructive text-center p-4">Institute ID not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><ClipboardList className="mr-2 h-6 w-6 text-primary"/>Attendance Reports</CardTitle>
          <CardDescription>View and export attendance records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="p-4 bg-muted/50">
            <CardTitle className="text-lg mb-2">Filters</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="dateFrom"
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange(prev => ({...prev, from: date || undefined}))} initialFocus />
                    </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="dateTo">Date To</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="dateTo"
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange(prev => ({...prev, to: date || undefined}))} initialFocus />
                    </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="studentSelect">Student</Label>
                <Select 
                  onValueChange={(value) => setSelectedStudentId(value === ALL_STUDENTS_VALUE ? undefined : value)} 
                  value={selectedStudentId || ALL_STUDENTS_VALUE}
                >
                  <SelectTrigger id="studentSelect"><SelectValue placeholder="All Students" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STUDENTS_VALUE}>All Students</SelectItem>
                    {students.map(s => <SelectItem key={s.id} value={s.id!}>{s.name} ({s.studentIdNo})</SelectItem>)}
                    {students.length === 0 && <SelectItem value="no-students" disabled>No students found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="classSelect">Class Subject</Label>
                <Select 
                  onValueChange={(value) => setSelectedClassId(value === ALL_CLASSES_VALUE ? undefined : value)} 
                  value={selectedClassId || ALL_CLASSES_VALUE}
                >
                  <SelectTrigger id="classSelect"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CLASSES_VALUE}>All Subjects</SelectItem>
                    {allScheduledClasses.map(sc => <SelectItem key={sc.id} value={sc.id!}>{sc.subjectName} ({sc.subjectCode || 'N/A'})</SelectItem>)}
                    {allScheduledClasses.length === 0 && <SelectItem value="no-classes" disabled>No classes found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
             <Button onClick={applyFilters} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                <Filter className="mr-2 h-4 w-4"/> Apply Filters
            </Button>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleExportData} variant="outline" disabled={isLoading || filteredRecords.length === 0}>
              <Download className="mr-2 h-4 w-4"/> Export Data (CSV)
            </Button>
          </div>

          {isLoading ? <p className="text-center py-4">Loading records...</p> : (
            filteredRecords.length === 0 ? <p className="text-center text-muted-foreground py-4">No attendance records found for the selected filters.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{format(record.timestamp.toDate(), "PPP")}</TableCell>
                      <TableCell>{format(record.timestamp.toDate(), "p")}</TableCell>
                      <TableCell>{getStudentName(record.studentFirebaseId)}</TableCell>
                      <TableCell>{getScheduledClassDisplay(record.scheduledClassId, record.timestamp)}</TableCell>
                      <TableCell className={record.status === 'present' ? 'text-green-600' : 'text-red-600'}>{record.status}</TableCell>
                      <TableCell>{record.method || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
