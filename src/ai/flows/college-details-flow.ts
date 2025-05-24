
'use server';
/**
 * @fileOverview AI flow to get detailed college information, including category-wise cutoffs.
 *
 * - getCollegeDetails - A function that calls the Genkit flow.
 * - CollegeDetailsInput - The input type for the flow.
 * - CollegeDetailsOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const CollegeDetailsInputSchema = z.object({
  collegeName: z.string().describe('The full name of the college.'),
  collegeDistrict: z.string().optional().describe('The district where the college is located, to help disambiguate.'),
});
export type CollegeDetailsInput = z.infer<typeof CollegeDetailsInputSchema>;

// Category-wise Cutoff Schema
const CategoryCutoffSchema = z.object({
  open: z.string().optional().describe("Cutoff for Open category (e.g., percentile or rank range)."),
  obc: z.string().optional().describe("Cutoff for OBC category."),
  sc: z.string().optional().describe("Cutoff for SC category."),
  st: z.string().optional().describe("Cutoff for ST category."),
  vjnt: z.string().optional().describe("Cutoff for VJ/NT category."),
  ews: z.string().optional().describe("Cutoff for EWS category."),
  tfws: z.string().optional().describe("Cutoff for TFWS category."),
  other: z.string().optional().describe("Cutoff for any other relevant category or a general cutoff if categories are not distinct."),
}).optional();

// Output Schema
const BranchDetailsSchema = z.object({
  branchName: z.string().describe('The name of the engineering/medical/pharmacy branch.'),
  mhtCetCutoff: CategoryCutoffSchema.describe('Typical MHT-CET cutoffs by category.'),
  jeeMainCutoff: CategoryCutoffSchema.describe('Typical JEE Main cutoffs by category (if applicable).'),
  neetCutoff: CategoryCutoffSchema.describe('Typical NEET cutoffs by category (if applicable).'),
  intake: z.string().optional().describe('Approximate number of seats or intake capacity for the branch.'),
});

const CollegeDetailsOutputSchema = z.object({
  collegeSummary: z.string().describe('A brief summary or key highlights of the college relevant for MHT-CET, JEE, or NEET aspirants. Include its reputation and key strengths.'),
  branches: z.array(BranchDetailsSchema).describe('An array of popular branches offered by the college with their typical cutoffs (category-wise if available) and intake capacity.'),
});
export type CollegeDetailsOutput = z.infer<typeof CollegeDetailsOutputSchema>;

// Genkit Prompt
const collegeDetailsPrompt = ai.definePrompt({
  name: 'collegeDetailsPrompt',
  input: { schema: CollegeDetailsInputSchema },
  output: { schema: CollegeDetailsOutputSchema },
  prompt: `You are an expert college admission counselor for Maharashtra, India, specializing in MHT-CET, JEE Main, and NEET exams.
Given the college name: "{{collegeName}}"{{#if collegeDistrict}} in district: "{{collegeDistrict}}"{{/if}}, provide:
1.  A concise summary highlighting its key strengths, reputation, and typical student intake for aspirants of these exams.
2.  A list of popular engineering, medical, or pharmacy branches offered by this college. For each branch, provide:
    - Its name.
    - Typical MHT-CET cutoffs (percentile or rank range). If available, break this down by common categories: Open, OBC, SC, ST, VJ/NT, EWS, TFWS. If category-wise data is not available, provide a general cutoff.
    - Typical JEE Main cutoffs (rank range). If available, break this down by categories as above. (If not applicable, omit JEE Main cutoffs).
    - Typical NEET cutoffs (score range). If available, break this down by categories as above. (If not applicable, omit NEET cutoffs).
    - Approximate intake capacity if commonly known.

Focus on providing realistic and typical cutoff information. If a specific cutoff type (MHT-CET, JEE, NEET) or category-wise data is not applicable/available for a branch or college, the respective field or category sub-field should be omitted from the output rather than sending an empty string or "N/A" as a value for the cutoff string. For example, if only 'open' and 'obc' cutoffs are known for MHT-CET for a branch, only include those in the mhtCetCutoff object. If no category-wise cutoffs are known for an exam type, its entire category object can be omitted or just include an 'other' field with a general cutoff.

Return the information in the specified JSON format. Ensure the branchName is always present. For numeric-like fields (intake), if data is not available, the field should be omitted.
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
      console.warn(`AI did not return an output for college: ${input.collegeName}. Returning a default structure.`);
      return {
        collegeSummary: `No detailed summary could be generated for ${input.collegeName}. Please verify the college name and try again, or consult official sources.`,
        branches: [],
      };
    }
    // Ensure branches is always an array
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
    return {
      collegeSummary: `An error occurred while fetching details for ${input.collegeName}. Please try again later.`,
      branches: [],
    };
  }
}
