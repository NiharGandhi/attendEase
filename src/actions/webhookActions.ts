
'use server';

import type { AttendanceRecord } from '@/lib/types';

interface WebhookPayloadItem extends Omit<AttendanceRecord, 'timestamp' | 'recognizedAt' | 'id'> {
  id?: string;
  timestamp: string; // ISO string
  recognizedAt?: string; // ISO string
}

export async function sendAttendanceDataToWebhook(
  webhookUrl: string,
  records: AttendanceRecord[],
  instituteId: string
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl) {
    return { success: false, message: 'Webhook URL is not configured.' };
  }
  if (!records || records.length === 0) {
    return { success: false, message: 'No attendance data to send.' };
  }

  const dataToSend: WebhookPayloadItem[] = records.map(record => ({
    ...record,
    timestamp: record.timestamp.toDate().toISOString(),
    recognizedAt: record.recognizedAt ? record.recognizedAt.toDate().toISOString() : undefined,
  }));

  const payload = {
    instituteId: instituteId,
    exportedAt: new Date().toISOString(),
    recordCount: dataToSend.length,
    attendanceData: dataToSend,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Webhook failed with status ${response.status}: ${errorBody}`);
      return {
        success: false,
        message: `Webhook request failed: ${response.status} - ${response.statusText}. Server response: ${errorBody.substring(0, 200)}`,
      };
    }

    return { success: true, message: 'Attendance data successfully sent to webhook.' };
  } catch (error: any) {
    console.error('Error sending data to webhook:', error);
    return { success: false, message: `Failed to send data to webhook: ${error.message}` };
  }
}
