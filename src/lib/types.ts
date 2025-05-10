
import type { Timestamp } from 'firebase/firestore';

export interface Institute {
  id?: string; // Firestore document ID
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  createdAt?: Timestamp;
}

export interface Employee {
  id?: string; // Firestore document ID
  instituteId: string; // Firestore ID of the parent institute
  name: string;
  email: string;
  role: string; // e.g., 'admin', 'teacher'
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
  faceData?: any; // Placeholder for Face++ data
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
}

// Used for form validation
export type InstituteFormData = Omit<Institute, 'id' | 'createdAt'>;
export type EmployeeFormData = Omit<Employee, 'id' | 'instituteId' | 'createdAt'>;
export type ClassroomFormData = Omit<Classroom, 'id' | 'instituteId' | 'createdAt'>;
export type StudentFormData = Omit<Student, 'id' | 'instituteId' | 'imageUrl' | 'faceData' | 'createdAt'>;
