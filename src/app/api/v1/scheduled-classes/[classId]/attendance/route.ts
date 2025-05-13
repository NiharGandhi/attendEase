
import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceRecord } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const scheduledClassId = params.classId;
    if (!scheduledClassId) {
      return NextResponse.json({ error: 'Scheduled Class ID is required' }, { status: 400 });
    }
    
    // Verify class exists
    const classRef = doc(db, 'scheduledClasses', scheduledClassId);
    const classSnap = await getDoc(classRef);
    if (!classSnap.exists()) {
        return NextResponse.json({ error: 'Scheduled class not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const lastVisibleTimestampStr = searchParams.get('lastVisibleTimestamp'); // Use timestamp for pagination on attendance
    const dateFilterStr = searchParams.get('date'); // YYYY-MM-DD


    let attendanceQuery = query(
      collection(db, 'attendanceRecords'),
      where('scheduledClassId', '==', scheduledClassId),
      orderBy('timestamp', 'desc'), // Usually newest first for attendance
      limit(pageSize)
    );

    if (dateFilterStr) {
        const date = new Date(dateFilterStr);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
        }
        const startOfDay = Timestamp.fromDate(new Date(date.setHours(0,0,0,0)));
        const endOfDay = Timestamp.fromDate(new Date(date.setHours(23,59,59,999)));
        
        attendanceQuery = query(
            collection(db, 'attendanceRecords'),
            where('scheduledClassId', '==', scheduledClassId),
            where('timestamp', '>=', startOfDay),
            where('timestamp', '<=', endOfDay),
            orderBy('timestamp', 'desc'),
            limit(pageSize)
        );
    }


    if (lastVisibleTimestampStr && !dateFilterStr) { // Pagination only if not filtering by specific date for simplicity here
      const lastVisibleTimestamp = Timestamp.fromMillis(parseInt(lastVisibleTimestampStr, 10));
      if (isNaN(lastVisibleTimestamp.toMillis())) {
        return NextResponse.json({ error: 'Invalid lastVisibleTimestamp provided for pagination.' }, { status: 400 });
      }
       attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('scheduledClassId', '==', scheduledClassId),
          orderBy('timestamp', 'desc'),
          startAfter(lastVisibleTimestamp),
          limit(pageSize)
        );
    }
    
    const querySnapshot = await getDocs(attendanceQuery);
    const attendanceRecords: Partial<AttendanceRecord>[] = [];
    let newLastVisibleTimestamp: number | null = null;

    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const recordData = docSnap.data() as Omit<AttendanceRecord, 'id' | 'timestamp'> & { timestamp: Timestamp };
      attendanceRecords.push({
        id: docSnap.id,
        studentFirebaseId: recordData.studentFirebaseId,
        timestamp: recordData.timestamp.toDate().toISOString() as any, // Convert to ISO string
        status: recordData.status,
        method: recordData.method,
        recognizedAt: recordData.recognizedAt ? recordData.recognizedAt.toDate().toISOString() as any : undefined,
      });
      newLastVisibleTimestamp = recordData.timestamp.toMillis();
    });

    return NextResponse.json({ 
        data: attendanceRecords,
        nextPageCursor: newLastVisibleTimestamp && querySnapshot.docs.length === pageSize ? newLastVisibleTimestamp.toString() : null,
        pageSize: attendanceRecords.length,
     }, { status: 200 });

  } catch (error: any) {
    console.error('API Error fetching attendance records:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance records', details: error.message }, { status: 500 });
  }
}
