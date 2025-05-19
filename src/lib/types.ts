
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export interface Institute {
  id?: string; // Firestore document ID
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string; // URL for the institute's logo
  webhookUrl?: string | null; // URL for webhook data export, can be null
  createdAt?: Timestamp;
  adminUid?: string;
  facesetToken?: string; // Face++ FaceSet Token
}

export interface Employee {
  id?: string; // Firestore document ID
  instituteId: string; // Firestore ID of the parent institute
  name: string;
  email: string;
  role: string; // e.g., 'admin', 'teacher'
  firebaseUid?: string; // Link to Firebase Auth user
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CameraSetup {
  type: 'default' | 'ip'; // 'default' for browser/connected, 'ip' for IP cameras
  ipCameraUrls?: string[]; // Array of URLs if type is 'ip'
}

export interface Classroom {
  id?: string; // Firestore document ID
  instituteId: string; // Firestore ID of the parent institute
  building?: string; // e.g., "Engineering Block", "Main Campus - D Wing"
  roomNumber: string; // e.g., "101", "Lab A"
  section: string; // e.g., "A", "Morning Batch"
  capacity?: number;
  cameraSetup?: CameraSetup; // Configuration for cameras in this classroom
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id?: string; // Firestore document ID
  instituteId: string; // Firestore ID of the parent institute
  studentIdNo: string; // Unique student identifier within the institute
  name: string;
  course: string;
  year?: number;
  section?: string;
  imageUrl?: string; // Link to image in Firebase Storage
  faceToken?: string; // Face++ Face Token for this student's primary image
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export enum DayOfWeek {
    Monday = "Monday",
    Tuesday = "Tuesday",
    Wednesday = "Wednesday",
    Thursday = "Thursday",
    Friday = "Friday",
    Saturday = "Saturday",
    Sunday = "Sunday"
}
export const daysOfWeekArray = Object.values(DayOfWeek);


// This interface defines a single scheduled time slot for a class.
// A class occurs at ONE specific startTime and endTime, on MULTIPLE selected daysOfWeek.
// export interface ClassScheduleItem {
//   dayOfWeek: DayOfWeek;
//   startTime: string; // HH:mm format
//   endTime: string;   // HH:mm format
// }


export interface ScheduledClass {
  id?: string; // Firestore document ID
  instituteId: string;
  classroomId: string; // ID of the physical classroom
  classroomDiplayName?: string; // Denormalized: e.g., "Room 101 - Section A"
  subjectName: string;
  subjectCode?: string;
  teacherId?: string; // Employee ID
  teacherName?: string; // Denormalized for display
  studentIds: string[]; // Array of Student Firestore IDs enrolled in this class
  daysOfWeek: DayOfWeek[]; 
  startTime: string; // HH:mm format, single start time for all selected daysOfWeek
  endTime: string;   // HH:mm format, single end time for all selected daysOfWeek
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id?: string; // Firestore document ID
  instituteId: string;
  scheduledClassId: string; // ID of the ScheduledClass instance
  studentFirebaseId: string; // The Student's Firestore document ID
  timestamp: Timestamp; // Date and time of the attendance mark
  status: 'present' | 'absent';
  recognizedAt?: Timestamp; // Time of recognition if facial
  method?: 'manual' | 'facial_recognition';
}

// Used for form validation
export type InstituteFormData = Omit<Institute, 'id' | 'createdAt' | 'adminUid' | 'facesetToken' | 'logoUrl' | 'webhookUrl'> & { adminPassword?: string };
export type EmployeeFormData = Omit<Employee, 'id' | 'instituteId' | 'createdAt' | 'firebaseUid' | 'updatedAt'>;
export type ClassroomFormData = Omit<Classroom, 'id' | 'instituteId' | 'createdAt' | 'updatedAt' | 'cameraSetup'>; // Exclude cameraSetup from direct form for now
export type StudentFormData = Omit<Student, 'id' | 'instituteId' | 'imageUrl' | 'faceToken' | 'createdAt' | 'updatedAt'>;


export type ScheduledClassFormData = Omit<ScheduledClass, 'id' | 'createdAt' | 'updatedAt' | 'classroomDiplayName' | 'teacherName'>;


export const instituteSettingsFormSchema = z.object({
  name: z.string().min(2, { message: 'Institute name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  contactEmail: z.string().email({ message: 'Invalid email address.' }),
  contactPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  webhookUrl: z.string().url({ message: "Invalid URL format." }).optional().or(z.literal('')).nullable(),
});
export type InstituteSettingsFormData = z.infer<typeof instituteSettingsFormSchema>;


export type LoginFormData = z.infer<typeof import('@/components/LoginForm').loginFormSchema>;


// Utility for time conflict checking
export function timeToMinutes(time: string): number {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return 0; // Handle invalid format
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

// Simplified conflict check for two schedules with single start/end times on potentially overlapping days
export function checkScheduleConflict(
    days1: DayOfWeek[], startTime1Str: string, endTime1Str: string,
    days2: DayOfWeek[], startTime2Str: string, endTime2Str: string
): boolean {
    const commonDays = days1.filter(day => days2.includes(day));
    if (commonDays.length === 0) {
        return false; // No common days, no conflict
    }

    const startTime1 = timeToMinutes(startTime1Str);
    const endTime1 = timeToMinutes(endTime1Str);
    const startTime2 = timeToMinutes(startTime2Str);
    const endTime2 = timeToMinutes(endTime2Str);

    // Check for overlap:
    // They overlap if one starts before the other ends, AND the other starts before the first one ends.
    const timeOverlap = startTime1 < endTime2 && startTime2 < endTime1;
    
    return timeOverlap; // Conflict if there's a common day AND time overlap
}
