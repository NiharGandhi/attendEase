
import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Institute } from '@/lib/types';

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

    const instituteData = instituteSnap.data() as Omit<Institute, 'id'>;
    // Sanitize data if needed before sending, e.g., remove sensitive fields not meant for public API
    const responseData: Partial<Institute> = {
        id: instituteSnap.id,
        name: instituteData.name,
        address: instituteData.address,
        contactEmail: instituteData.contactEmail,
        contactPhone: instituteData.contactPhone,
        logoUrl: instituteData.logoUrl,
        // Exclude fields like adminUid, facesetToken from public API response for security
    };


    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error('API Error fetching institute:', error);
    return NextResponse.json({ error: 'Failed to fetch institute data', details: error.message }, { status: 500 });
  }
}

