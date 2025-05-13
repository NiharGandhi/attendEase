
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod'; // Added to make the LoginFormData work

export interface Institute {
  id?: string; // Firestore document ID
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string; // URL for the institute's logo
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
}

export interface Classroom {
  id?: string; // Firestore document ID
  instituteId: string; // Firestore ID of the parent institute
  roomNumber: string;
  section: string;
  capacity?: number;
  createdAt?: Timestamp;
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
}

export interface ScheduledClass {
  id?: string; // Firestore document ID
  instituteId: string;
  classroomId: string; // ID of the physical classroom
  classroomDiplayName?: string; // Denormalized: e.g., "Room 101 - Section A" for display in lists
  subjectName: string;
  subjectCode?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  teacherId?: string; // Employee ID
  teacherName?: string; // Denormalized for display
  studentIds: string[]; // Array of Student Firestore IDs enrolled in this class
  createdAt?: Timestamp;
}

export interface AttendanceRecord {
  id?: string; // Firestore document ID
  instituteId: string;
  scheduledClassId: string; // ID of the ScheduledClass instance
  studentFirebaseId: string; // The Student's Firestore document ID
  timestamp: Timestamp; // Date of the attendance
  status: 'present' | 'absent';
  recognizedAt?: Timestamp; // Time of recognition if facial
  method?: 'manual' | 'facial_recognition';
}

// Used for form validation
export type InstituteFormData = Omit<Institute, 'id' | 'createdAt' | 'adminUid' | 'facesetToken' | 'logoUrl'> & { adminPassword?: string };
export type EmployeeFormData = Omit<Employee, 'id' | 'instituteId' | 'createdAt' | 'firebaseUid'>;
export type ClassroomFormData = Omit<Classroom, 'id' | 'instituteId' | 'createdAt'>;
export type StudentFormData = Omit<Student, 'id' | 'instituteId' | 'imageUrl' | 'faceToken' | 'createdAt'>;
export type ScheduledClassFormData = Omit<ScheduledClass, 'id' | 'createdAt' | 'classroomDiplayName' | 'teacherName'>;

export const instituteSettingsFormSchema = z.object({
  name: z.string().min(2, { message: 'Institute name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  contactEmail: z.string().email({ message: 'Invalid email address.' }),
  contactPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
});
export type InstituteSettingsFormData = z.infer<typeof instituteSettingsFormSchema>;


export type LoginFormData = z.infer<typeof import('@/components/LoginForm').loginFormSchema>;

