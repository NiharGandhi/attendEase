
import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const studentId = params.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentData = studentSnap.data() as Omit<Student, 'id'>;
    // Sanitize data for API response
    const responseData: Partial<Student> = {
        id: studentSnap.id,
        instituteId: studentData.instituteId,
        studentIdNo: studentData.studentIdNo,
        name: studentData.name,
        course: studentData.course,
        year: studentData.year,
        section: studentData.section,
        imageUrl: studentData.imageUrl,
        // Exclude faceToken and internal timestamps from public API if not needed
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error('API Error fetching student:', error);
    return NextResponse.json({ error: 'Failed to fetch student data', details: error.message }, { status: 500 });
  }
}
