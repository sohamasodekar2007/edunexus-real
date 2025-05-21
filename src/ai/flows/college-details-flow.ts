
'use server';
/**
 * @fileOverview AI flow to get detailed college information.
 *
 * - getCollegeDetails - A function that calls the Genkit flow.
 * - CollegeDetailsInput - The input type for the flow.
 * - CollegeDetailsOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // Genkit often re-exports or provides its own Zod-compatible schema builder

// Input Schema
const CollegeDetailsInputSchema = z.object({
  collegeName: z.string().describe('The full name of the college.'),
  collegeDistrict: z.string().optional().describe('The district where the college is located, to help disambiguate.'),
});
export type CollegeDetailsInput = z.infer<typeof CollegeDetailsInputSchema>;

// Output Schema
const BranchDetailsSchema = z.object({
  branchName: z.string().describe('The name of the engineering/medical/pharmacy branch.'),
  mhtCetCutoff: z.string().optional().describe('Typical MHT-CET cutoff (e.g., percentile or rank range).'),
  jeeMainCutoff: z.string().optional().describe('Typical JEE Main cutoff (e.g., rank range).'),
  neetCutoff: z.string().optional().describe('Typical NEET cutoff (e.g., score range).'),
  intake: z.string().optional().describe('Approximate number of seats or intake capacity for the branch.'),
});

const CollegeDetailsOutputSchema = z.object({
  collegeSummary: z.string().describe('A brief summary or key highlights of the college relevant for MHT-CET, JEE, or NEET aspirants. Include its reputation and key strengths.'),
  branches: z.array(BranchDetailsSchema).describe('An array of popular branches offered by the college with their typical cutoffs and intake capacity.'),
});
export type CollegeDetailsOutput = z.infer<typeof CollegeDetailsOutputSchema>;

// Genkit Prompt
const collegeDetailsPrompt = ai.definePrompt({
  name: 'collegeDetailsPrompt',
  input: { schema: CollegeDetailsInputSchema },
  output: { schema: CollegeDetailsOutputSchema },
  prompt: `You are an expert college admission counselor for Maharashtra, India, specializing in MHT-CET, JEE Main, and NEET exams.
Given the college name: "{{collegeName}}"{{#if collegeDistrict}} in district: "{{collegeDistrict}}"{{/if}}, provide a concise summary highlighting its key strengths and reputation for aspirants of these exams.
Also, list popular engineering, medical, or pharmacy branches offered by this college. For each branch, provide:
- Its name.
- Typical MHT-CET cutoff (percentile or rank range).
- Typical JEE Main cutoff (rank range, if applicable).
- Typical NEET cutoff (score range, if applicable).
- Approximate intake capacity if commonly known.

Focus on providing realistic and typical cutoff information. If a specific cutoff type (MHT-CET, JEE, NEET) is not applicable for a branch or college, omit it.
Present the information clearly.

College Name: {{collegeName}}
{{#if collegeDistrict}}District: {{collegeDistrict}}{{/if}}

Return the information in the specified JSON format. Ensure all string fields in the output are populated, even if with "N/A" or "Not applicable" if specific data isn't available. For numeric-like fields (cutoffs, intake), if data is not available, the field should be omitted from the branch object rather than sending an empty string.
`,
});

// Genkit Flow
const collegeDetailsFlow = ai.defineFlow(
  {
    name: 'collegeDetailsFlow',
    inputSchema: CollegeDetailsInputSchema,
    outputSchema: CollegeDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await collegeDetailsPrompt(input);
    if (!output) {
      // Attempt to provide a structured empty response if AI returns nothing
      // This helps prevent downstream errors if the client expects a certain shape.
      console.warn(`AI did not return an output for college: ${input.collegeName}. Returning a default structure.`);
      return {
        collegeSummary: `No detailed summary could be generated for ${input.collegeName}. Please verify the college name and try again, or consult official sources.`,
        branches: [],
      };
    }
    // Ensure branches is always an array, even if AI fails to provide it correctly
    if (!output.branches) {
        output.branches = [];
    }
    return output;
  }
);

// Exported wrapper function
export async function getCollegeDetails(input: CollegeDetailsInput): Promise<CollegeDetailsOutput> {
  try {
    return await collegeDetailsFlow(input);
  } catch (error) {
    console.error(`Error in getCollegeDetails Genkit flow for ${input.collegeName}:`, error);
    // Return a structured error response or a default structure
    return {
      collegeSummary: `An error occurred while fetching details for ${input.collegeName}. Please try again later.`,
      branches: [],
    };
  }
}
