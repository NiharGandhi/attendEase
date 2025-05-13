
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { AttendanceRecord, ScheduledClass, Student, Classroom, DayOfWeek, Institute } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { ClipboardList, Download, Filter, Send } from 'lucide-react'; 
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendAttendanceDataToWebhook } from '@/actions/webhookActions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const ALL_STUDENTS_VALUE = "__ALL_STUDENTS__";
const ALL_CLASSES_VALUE = "__ALL_CLASSES__";

export default function AttendanceReports() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allScheduledClasses, setAllScheduledClasses] = useState<ScheduledClass[]>([]); 
  const [instituteWebhookUrl, setInstituteWebhookUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(ALL_STUDENTS_VALUE);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(ALL_CLASSES_VALUE);

  useEffect(() => {
    if (instituteId) {
      fetchInitialData();
      fetchInstituteWebhookUrl();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceRecords, dateRange, selectedStudentId, selectedClassId]);
  
  async function fetchInstituteWebhookUrl() {
    if (!instituteId) return;
    try {
      const instituteRef = doc(db, 'institutes', instituteId);
      const instituteSnap = await getDoc(instituteRef);
      if (instituteSnap.exists()) {
        const instituteData = instituteSnap.data() as Institute;
        setInstituteWebhookUrl(instituteData.webhookUrl || null);
      }
    } catch (error) {
      console.error("Error fetching institute webhook URL:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch webhook configuration.' });
    }
  }


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
          classroomDiplayName: classroom ? `${classroom.roomNumber} - ${classroom.section}`: data.classroomDiplayName || 'N/A',
          daysOfWeek: data.daysOfWeek || [], 
        };
      });

      setAttendanceRecords(recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setAllScheduledClasses(fetchedScheduledClasses);

    } catch (error) {
      console.error("Error fetching initial data for reports:", error);
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
    if (selectedStudentId && selectedStudentId !== ALL_STUDENTS_VALUE) {
        tempRecords = tempRecords.filter(r => r.studentFirebaseId === selectedStudentId);
    }
    if (selectedClassId && selectedClassId !== ALL_CLASSES_VALUE) { 
        tempRecords = tempRecords.filter(r => r.scheduledClassId === selectedClassId);
    }
    setFilteredRecords(tempRecords.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
  }

  const handleExportData = () => {
    if(filteredRecords.length === 0){
        toast({variant: 'destructive', title: 'No Data', description: 'No data to export based on current filters.'});
        return;
    }
    // Convert filteredRecords to CSV string
    const headers = ["Date", "Time", "Student Name", "Student ID No.", "Class Subject", "Class Code", "Status", "Method", "Recognized At"];
    const csvRows = [headers.join(",")];

    filteredRecords.forEach(record => {
        const student = students.find(s => s.id === record.studentFirebaseId);
        const scheduledClass = allScheduledClasses.find(sc => sc.id === record.scheduledClassId);
        const row = [
            format(record.timestamp.toDate(), "yyyy-MM-dd"),
            format(record.timestamp.toDate(), "HH:mm:ss"),
            student?.name || record.studentFirebaseId,
            student?.studentIdNo || "N/A",
            scheduledClass?.subjectName || record.scheduledClassId,
            scheduledClass?.subjectCode || "N/A",
            record.status,
            record.method || "N/A",
            record.recognizedAt ? format(record.recognizedAt.toDate(), "yyyy-MM-dd HH:mm:ss") : "N/A"
        ];
        csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_report_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Successful", description: "Attendance data exported to CSV." });
    } else {
        toast({ variant: 'destructive', title: "Export Failed", description: "Your browser does not support direct CSV download." });
    }
  };

  const handleExportToWebhook = async () => {
    if (!instituteId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      return;
    }
    if (!instituteWebhookUrl) {
      toast({ variant: 'destructive', title: 'Webhook Not Configured', description: 'Please configure a webhook URL in institute settings.' });
      return;
    }
    if (filteredRecords.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No data to send based on current filters.' });
      return;
    }
    setIsSendingWebhook(true);
    try {
      const result = await sendAttendanceDataToWebhook(instituteWebhookUrl, filteredRecords, instituteId);
      if (result.success) {
        toast({ title: 'Webhook Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Webhook Error', description: result.message });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Webhook Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsSendingWebhook(false);
    }
  };
  
  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || studentId;
  
  const getScheduledClassDisplay = (scheduledClassId: string, recordTimestamp: Timestamp) => {
    const sc = allScheduledClasses.find(s => s.id === scheduledClassId);
    if (!sc) return scheduledClassId;

    const recordDate = recordTimestamp.toDate();
    const recordDay = format(recordDate, 'EEEE') as DayOfWeek; 

    let timeDisplay = `${sc.startTime}-${sc.endTime}`;
    if (!sc.daysOfWeek || !sc.daysOfWeek.includes(recordDay)) {
      timeDisplay = `Scheduled on other days (${sc.startTime}-${sc.endTime})`;
    } else if (!sc.startTime || !sc.endTime) {
      timeDisplay = "Time not defined";
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
          <CardDescription>View and export attendance records. Configure webhooks in settings for automated data transfer.</CardDescription>
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
                    {students.length === 0 && <SelectItem value="no-students-placeholder" disabled>No students found</SelectItem>}
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
                    {allScheduledClasses.length === 0 && <SelectItem value="no-classes-placeholder" disabled>No classes found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
             <Button onClick={applyFilters} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                <Filter className="mr-2 h-4 w-4"/> Apply Filters
            </Button>
          </Card>

          {!instituteWebhookUrl && (
            <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-700">
              <Send className="h-4 w-4 !text-yellow-700" /> {/* Ensure icon color matches text */}
              <AlertTitle>Webhook Not Configured</AlertTitle>
              <AlertDescription>
                To automatically export data via webhook, please configure the Webhook URL in{" "}
                <a href={`/institute/settings?instituteId=${instituteId}`} className="font-semibold underline hover:text-yellow-800">
                  Institute Settings
                </a>. Manual CSV export is still available.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button 
                onClick={handleExportToWebhook} 
                variant="outline" 
                disabled={isLoading || isSendingWebhook || filteredRecords.length === 0 || !instituteWebhookUrl}
                title={!instituteWebhookUrl ? "Configure webhook URL in settings first" : "Send filtered data to configured webhook"}
            >
              <Send className="mr-2 h-4 w-4"/> {isSendingWebhook ? 'Sending...' : 'Export to Webhook'}
            </Button>
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

