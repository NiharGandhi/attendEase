
'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const FACEPLUSPLUS_API_KEY = process.env.FACEPLUSPLUS_API_KEY;
const FACEPLUSPLUS_API_SECRET = process.env.FACEPLUSPLUS_API_SECRET;
const FACEPLUSPLUS_API_BASE_URL = 'https://api-us.faceplusplus.com/facepp/v3';

interface FacePlusPlusError {
  error_message: string;
  request_id: string;
  time_used: number;
}

interface Face {
  face_token: string;
  face_rectangle: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

interface DetectResponse extends FacePlusPlusError {
  image_id: string;
  request_id: string;
  time_used: number;
  faces: Face[];
}

interface CreateFaceSetResponse extends FacePlusPlusError {
  faceset_token: string;
  outer_id: string;
  face_count: number;
  face_added: number;
}

interface AddFaceResponse extends FacePlusPlusError {
  faceset_token: string;
  outer_id: string;
  face_count: number;
  face_added: number;
  failure_detail: Array<{
    reason: string;
    face_token: string;
  }>;
}

interface SearchResult {
  confidence: number;
  user_id: string; // We don't use user_id with Face++ in this way
  face_token: string;
}
interface SearchResponse extends FacePlusPlusError {
  request_id: string;
  time_used: number;
  thresholds: {
    "1e-3": number;
    "1e-4": number;
    "1e-5": number;
  };
  results: SearchResult[];
  image_id?: string; // Only if image_url or image_file or image_base64 is used
  faces?: Face[]; // Detected faces in the searched image
}


async function makeFacePlusPlusRequest(endpoint: string, formData: FormData) {
  if (!FACEPLUSPLUS_API_KEY || !FACEPLUSPLUS_API_SECRET) {
    throw new Error('Face++ API Key or Secret is not configured.');
  }
  formData.append('api_key', FACEPLUSPLUS_API_KEY);
  formData.append('api_secret', FACEPLUSPLUS_API_SECRET);

  const response = await fetch(`${FACEPLUSPLUS_API_BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || data.error_message) {
    console.error('Face++ API Error:', data.error_message, data);
    throw new Error(data.error_message || `Face++ API request failed with status ${response.status}`);
  }
  return data;
}

export async function createFaceSetAction(instituteId: string, instituteName: string) {
  try {
    const formData = new FormData();
    formData.append('display_name', instituteName);
    formData.append('outer_id', instituteId); // Use instituteId as outer_id for easy mapping

    const data = await makeFacePlusPlusRequest('/faceset/create', formData) as CreateFaceSetResponse;
    
    if (data.faceset_token) {
      const instituteRef = doc(db, 'institutes', instituteId);
      await updateDoc(instituteRef, {
        facesetToken: data.faceset_token,
      });
      return { success: true, facesetToken: data.faceset_token };
    }
    throw new Error(data.error_message || 'Failed to create FaceSet: No faceset_token returned.');
  } catch (error: any) {
    console.error('createFaceSetAction Error:', error);
    return { success: false, error: error.message };
  }
}

export async function detectFaceAction(imageUrl: string) {
  try {
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    // formData.append('return_attributes', 'gender,age,smiling,headpose,facequality,blur,eyestatus,emotion,ethnicity,beauty,mouthstatus,eyegaze,skinstatus'); // Optional attributes

    const data = await makeFacePlusPlusRequest('/detect', formData) as DetectResponse;

    if (data.faces && data.faces.length > 0) {
      // For simplicity, return the first detected face. 
      // A real app might need to handle multiple faces or no faces.
      return { success: true, faceToken: data.faces[0].face_token, faceRectangle: data.faces[0].face_rectangle };
    } else if (data.faces && data.faces.length === 0) {
      return { success: false, error: 'No faces detected in the image.' };
    }
    throw new Error(data.error_message || 'Failed to detect face.');
  } catch (error: any) {
    console.error('detectFaceAction Error:', error);
    return { success: false, error: error.message };
  }
}

export async function addFaceToFaceSetAction(facesetToken: string, faceToken: string) {
  try {
    const formData = new FormData();
    formData.append('faceset_token', facesetToken);
    formData.append('face_tokens', faceToken);

    const data = await makeFacePlusPlusRequest('/faceset/addface', formData) as AddFaceResponse;

    if (data.face_added === 1) {
      return { success: true, faceCount: data.face_count };
    } else if (data.failure_detail && data.failure_detail.length > 0) {
      throw new Error(`Failed to add face: ${data.failure_detail[0].reason}`);
    }
    throw new Error(data.error_message || 'Failed to add face to FaceSet.');
  } catch (error: any) {
    console.error('addFaceToFaceSetAction Error:', error);
    return { success: false, error: error.message };
  }
}

export async function searchFaceAction(imageBase64: string, facesetToken: string) {
  // imageBase64 should be data URL: "data:image/jpeg;base64,..."
  // We need to strip the "data:image/jpeg;base64," part.
  const base64data = imageBase64.split(',')[1];

  try {
    const formData = new FormData();
    formData.append('image_base64', base64data);
    formData.append('faceset_token', facesetToken);
    formData.append('return_result_count', '1'); // Return top 1 match

    const data = await makeFacePlusPlusRequest('/search', formData) as SearchResponse;

    if (data.results && data.results.length > 0) {
      const bestMatch = data.results[0];
      // Face++ confidence for 1e-5 threshold is usually good for "same person"
      // Check thresholds if needed: data.thresholds["1e-5"]
      // For this example, let's set a fixed confidence, e.g., 75.0
      // The `confidence` returned by search is a score, higher is better.
      // Thresholds are error rates, lower is better.
      // The API docs state: "A confidence score of a face pair. The higher the score, the higher the confidence that the two faces belong to the same person."
      // Let's use a threshold from their example, e.g., 80.
      const confidenceThreshold = data.thresholds?.["1e-5"] || 75; // Use 1e-5 threshold or fallback
      
      if (bestMatch.confidence >= confidenceThreshold) {
         return { success: true, faceToken: bestMatch.face_token, confidence: bestMatch.confidence };
      } else {
         return { success: false, error: 'No confident match found.', results: data.results };
      }
    } else if (data.faces && data.faces.length === 0) {
        return { success: false, error: 'No faces detected in the search image.'};
    }
     return { success: false, error: 'No match found or error in search.', results: data.results };
  } catch (error: any) {
    console.error('searchFaceAction Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getInstituteFacesetToken(instituteId: string): Promise<string | null> {
    if (!instituteId) return null;
    try {
        const instituteRef = doc(db, 'institutes', instituteId);
        const instituteSnap = await getDoc(instituteRef);
        if (instituteSnap.exists()) {
            return instituteSnap.data()?.facesetToken || null;
        }
        return null;
    } catch (error) {
        console.error("Error fetching institute faceset token:", error);
        return null;
    }
}
