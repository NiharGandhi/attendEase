
import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { instituteId: string } }
) {
  try {
    const instituteId = params.instituteId;
    if (!instituteId) {
      return NextResponse.json({ error: 'Institute ID is required' }, { status: 400 });
    }

    // Check if institute exists (optional, but good practice)
    const instituteRef = doc(db, 'institutes', instituteId);
    const instituteSnap = await getDoc(instituteRef);
    if (!instituteSnap.exists()) {
        return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const lastVisibleId = searchParams.get('lastVisibleId');

    let studentsQuery = query(
      collection(db, 'students'),
      where('instituteId', '==', instituteId),
      orderBy('name'),
      limit(pageSize)
    );

    if (lastVisibleId) {
      const lastVisibleSnap = await getDoc(doc(db, 'students', lastVisibleId));
      // Ensure the lastVisible student also belongs to the same institute for valid pagination
      if (lastVisibleSnap.exists() && lastVisibleSnap.data()?.instituteId === instituteId) {
        studentsQuery = query(
          collection(db, 'students'),
          where('instituteId', '==', instituteId),
          orderBy('name'),
          startAfter(lastVisibleSnap),
          limit(pageSize)
        );
      } else {
         return NextResponse.json({ error: 'Invalid lastVisibleId provided for pagination.' }, { status: 400 });
      }
    }
    
    const querySnapshot = await getDocs(studentsQuery);
    const students: Partial<Student>[] = [];
    let newLastVisibleId: string | null = null;

    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const studentData = docSnap.data() as Omit<Student, 'id'>;
      students.push({
        id: docSnap.id,
        studentIdNo: studentData.studentIdNo,
        name: studentData.name,
        course: studentData.course,
        year: studentData.year,
        section: studentData.section,
        imageUrl: studentData.imageUrl,
        // Exclude faceToken and internal timestamps
      });
      newLastVisibleId = docSnap.id;
    });

    return NextResponse.json({
        data: students,
        nextPageCursor: newLastVisibleId && querySnapshot.docs.length === pageSize ? newLastVisibleId : null,
        pageSize: students.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error fetching students for institute:', error);
    return NextResponse.json({ error: 'Failed to fetch students list', details: error.message }, { status: 500 });
  }
}
