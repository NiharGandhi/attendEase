
import { NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Institute } from '@/lib/types';

// TODO: Implement API authentication (e.g., API Key, OAuth 2.0) for all API routes.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const lastVisibleId = searchParams.get('lastVisibleId');

    let institutesQuery = query(
      collection(db, 'institutes'),
      orderBy('name'), // Order by name or createdAt
      limit(pageSize)
    );

    if (lastVisibleId) {
      const lastVisibleSnap = await getDoc(doc(db, 'institutes', lastVisibleId));
      if (lastVisibleSnap.exists()) {
        institutesQuery = query(
          collection(db, 'institutes'),
          orderBy('name'),
          startAfter(lastVisibleSnap),
          limit(pageSize)
        );
      } else {
        // Handle case where lastVisibleId is invalid, perhaps return error or first page
        return NextResponse.json({ error: 'Invalid lastVisibleId provided for pagination.' }, { status: 400 });
      }
    }
    
    const querySnapshot = await getDocs(institutesQuery);
    const institutes: Partial<Institute>[] = [];
    let newLastVisibleId: string | null = null;

    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const instituteData = docSnap.data() as Omit<Institute, 'id'>;
       // Sanitize data for API response
      institutes.push({
        id: docSnap.id,
        name: instituteData.name,
        address: instituteData.address,
        contactEmail: instituteData.contactEmail,
        logoUrl: instituteData.logoUrl,
        // Exclude sensitive fields
      });
      newLastVisibleId = docSnap.id; // Update for pagination
    });

    return NextResponse.json({ 
        data: institutes,
        nextPageCursor: newLastVisibleId && querySnapshot.docs.length === pageSize ? newLastVisibleId : null,
        pageSize: institutes.length,
     }, { status: 200 });

  } catch (error: any) {
    console.error('API Error fetching institutes:', error);
    return NextResponse.json({ error: 'Failed to fetch institutes list', details: error.message }, { status: 500 });
  }
}

