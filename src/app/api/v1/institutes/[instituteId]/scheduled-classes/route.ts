
import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScheduledClass } from '@/lib/types';

// TODO: Implement API authentication (e.g., API Key, OAuth 2.0) for all API routes.

export async function GET(
  request: Request,
  { params }: { params: { instituteId: string } }
) {
  try {
    const instituteId = params.instituteId;
    if (!instituteId) {
      return NextResponse.json({ error: 'Institute ID is required' }, { status: 400 });
    }

    const instituteRef = doc(db, 'institutes', instituteId);
    const instituteSnap = await getDoc(instituteRef);
    if (!instituteSnap.exists()) {
        return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }
    
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const lastVisibleId = searchParams.get('lastVisibleId');

    let classesQuery = query(
      collection(db, 'scheduledClasses'),
      where('instituteId', '==', instituteId),
      orderBy('subjectName'), 
      limit(pageSize)
    );

    if (lastVisibleId) {
      const lastVisibleSnap = await getDoc(doc(db, 'scheduledClasses', lastVisibleId));
      if (lastVisibleSnap.exists() && lastVisibleSnap.data()?.instituteId === instituteId) {
        classesQuery = query(
          collection(db, 'scheduledClasses'),
          where('instituteId', '==', instituteId),
          orderBy('subjectName'),
          startAfter(lastVisibleSnap),
          limit(pageSize)
        );
      } else {
        return NextResponse.json({ error: 'Invalid lastVisibleId provided for pagination.' }, { status: 400 });
      }
    }
    
    const querySnapshot = await getDocs(classesQuery);
    const scheduledClasses: Partial<ScheduledClass>[] = [];
    let newLastVisibleId: string | null = null;

    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const classData = docSnap.data() as Omit<ScheduledClass, 'id'>;
      scheduledClasses.push({
        id: docSnap.id,
        subjectName: classData.subjectName,
        subjectCode: classData.subjectCode,
        classroomId: classData.classroomId,
        classroomDiplayName: classData.classroomDiplayName,
        teacherId: classData.teacherId,
        teacherName: classData.teacherName,
        daysOfWeek: classData.daysOfWeek,
        startTime: classData.startTime,
        endTime: classData.endTime,
        studentIds: classData.studentIds, // Consider if this should be a separate paginated endpoint if lists are huge
      });
      newLastVisibleId = docSnap.id;
    });

    return NextResponse.json({ 
        data: scheduledClasses,
        nextPageCursor: newLastVisibleId && querySnapshot.docs.length === pageSize ? newLastVisibleId : null,
        pageSize: scheduledClasses.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error fetching scheduled classes:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled classes list', details: error.message }, { status: 500 });
  }
}

