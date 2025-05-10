export interface Student {
  id: string;
  name: string;
  courses: string[]; // List of course IDs or names the student is enrolled in
}

export interface AttendanceRecord {
  studentName: string;
  courseName: string;
  timestamp: Date;
  status: 'present' | 'absent'; // Could be extended
}

export interface Course {
  id: string;
  name: string;
  schedule?: string; // e.g., "Mon 9-11AM" - for display, not logic critical here
}
