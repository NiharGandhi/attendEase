
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod'; // Added to make the LoginFormData work

export interface Institute {
  id?: string; // Firestore document ID
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
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

export interface AttendanceRecord {
  id?: string; // Firestore document ID
  instituteId: string;
  classroomId: string;
  studentFirebaseId: string; // The Student's Firestore document ID
  timestamp: Timestamp;
  status: 'present' | 'absent';
  recognizedAt?: Timestamp; // Time of recognition
  method?: 'manual' | 'facial_recognition'; // How attendance was marked
}

// Used for form validation
export type InstituteFormData = Omit<Institute, 'id' | 'createdAt' | 'adminUid' | 'facesetToken'> & { adminPassword?: string };
export type EmployeeFormData = Omit<Employee, 'id' | 'instituteId' | 'createdAt' | 'firebaseUid'>;
export type ClassroomFormData = Omit<Classroom, 'id' | 'instituteId' | 'createdAt'>;
export type StudentFormData = Omit<Student, 'id' | 'instituteId' | 'imageUrl' | 'faceToken' | 'createdAt'>;

export type LoginFormData = z.infer<typeof import('@/components/LoginForm').loginFormSchema>;
