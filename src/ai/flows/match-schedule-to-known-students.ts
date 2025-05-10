'use server';

/**
 * @fileOverview This flow matches the classroom schedule with the known students
 * to reduce the search space for facial recognition.
 *
 * - matchScheduleToKnownStudents - A function that matches schedule to known students.
 * - MatchScheduleToKnownStudentsInput - The input type for the matchScheduleToKnownStudents function.
 * - MatchScheduleToKnownStudentsOutput - The return type for the matchScheduleToKnownStudents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchScheduleToKnownStudentsInputSchema = z.object({
  currentCourse: z.string().describe('The name of the current course being taught.'),
  knownStudents: z.array(z.string()).describe('An array of names of known students.'),
});

export type MatchScheduleToKnownStudentsInput = z.infer<typeof MatchScheduleToKnownStudentsInputSchema>;

const MatchScheduleToKnownStudentsOutputSchema = z.array(z.string()).describe(
  'A filtered array of student names who are expected to be in the current course.'
);

export type MatchScheduleToKnownStudentsOutput = z.infer<typeof MatchScheduleToKnownStudentsOutputSchema>;

export async function matchScheduleToKnownStudents(
  input: MatchScheduleToKnownStudentsInput
): Promise<MatchScheduleToKnownStudentsOutput> {
  return matchScheduleToKnownStudentsFlow(input);
}

const matchScheduleToKnownStudentsPrompt = ai.definePrompt({
  name: 'matchScheduleToKnownStudentsPrompt',
  input: {schema: MatchScheduleToKnownStudentsInputSchema},
  output: {schema: MatchScheduleToKnownStudentsOutputSchema},
  prompt: `You are an AI assistant that helps to filter the list of known students based on the current course.

Given the current course: {{{currentCourse}}}, and a list of known students: {{knownStudents}}.

Return a filtered list of student names who are expected to be in the current course. Do not include students that are not taking the course.
Only return the names of the students.
Ensure that all students listed are in the list of known students.

Output should be a JSON array of strings.`,
});

const matchScheduleToKnownStudentsFlow = ai.defineFlow(
  {
    name: 'matchScheduleToKnownStudentsFlow',
    inputSchema: MatchScheduleToKnownStudentsInputSchema,
    outputSchema: MatchScheduleToKnownStudentsOutputSchema,
  },
  async input => {
    const {output} = await matchScheduleToKnownStudentsPrompt(input);
    return output!;
  }
);
