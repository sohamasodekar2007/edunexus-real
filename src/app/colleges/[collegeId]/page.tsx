
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import collegeDataJson from '@/data/college_data_2025.json'; // Direct import
import type { CollegeDetailData, BranchDetail, CategoryWiseData, CollegeData2025 } from '@/types';
import { ArrowLeft, Building, BookOpenText, BarChart3, IndianRupee, Percent } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper function to render category data in a structured way
const renderCategoryTable = (data: CategoryWiseData | undefined, title: string, unit: string = "") => {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-muted-foreground italic">No specific {title.toLowerCase()} data available.</p>;
  }

  const categories: Array<keyof CategoryWiseData> = ['open', 'obc', 'sc', 'st', 'vjnt', 'ews', 'tfws', 'other'];
  const categoryLabels: Record<keyof CategoryWiseData, string> = {
    open: 'Open',
    obc: 'OBC',
    sc: 'SC',
    st: 'ST',
    vjnt: 'VJ/NT',
    ews: 'EWS',
    tfws: 'TFWS',
    other: 'Other/General'
  };

  return (
    <div>
      <h4 className="text-md font-semibold mt-3 mb-1.5 text-primary">{title}</h4>
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px] sm:w-[120px] text-xs sm:text-sm">Category</TableHead>
              <TableHead className="text-right text-xs sm:text-sm">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(catKey => (
              data[catKey] ? (
                <TableRow key={catKey}>
                  <TableCell className="font-medium text-xs sm:text-sm">{categoryLabels[catKey]}</TableCell>
                  <TableCell className="text-right text-xs sm:text-sm">{data[catKey]}{unit}</TableCell>
                </TableRow>
              ) : null
            ))}
            {!categories.some(catKey => data[catKey]) && data.other && (
                 <TableRow key="other_fallback">
                    <TableCell className="font-medium text-xs sm:text-sm">{categoryLabels.other}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm">{data.other}{unit}</TableCell>
                 </TableRow>
            )}
             {!categories.some(catKey => data[catKey]) && !data.other && (
                 <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs text-muted-foreground italic py-3">No specific data found for primary categories.</TableCell>
                 </TableRow>
             )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};


export default function CollegeDetailPage({ params }: { params: { collegeId: string } }) {
  const collegeId = decodeURIComponent(params.collegeId);
  const allCollegeData = collegeDataJson as CollegeData2025; // Assert type for direct import
  const details: CollegeDetailData | undefined = allCollegeData[collegeId];

  if (!details) {
    notFound(); // Or return a custom "Not Found" component
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/colleges">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to College List
            </Link>
          </Button>
        </div>

        <Card className="shadow-xl border-primary/30 overflow-hidden">
          <CardHeader className="bg-primary/10 p-6 border-b border-primary/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="p-3 bg-primary/20 rounded-lg text-primary">
                <Building className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-primary mb-1">{details.name}</CardTitle>
                <CardDescription className="text-sm sm:text-md text-muted-foreground">
                  {details.district} | Stream: {details.stream}
                  {details.collegeType && <Badge variant="secondary" className="ml-2 capitalize">{details.collegeType}</Badge>}
                  {details.establishedYear && <Badge variant="outline" className="ml-2">Estd: {details.establishedYear}</Badge>}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center text-accent">
                <BookOpenText className="mr-2 h-6 w-6" /> College Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                  {details.overallAnnualFees && <div className="flex items-center p-3 bg-muted/40 rounded-md"><IndianRupee className="h-5 w-5 mr-2 text-green-600"/> Approx. Annual Fees: <span className="font-semibold ml-1">{details.overallAnnualFees}</span></div>}
                  {details.campusSizeAcres && <div className="flex items-center p-3 bg-muted/40 rounded-md"><Ruler className="h-5 w-5 mr-2 text-orange-600"/> Campus Size: <span className="font-semibold ml-1">{details.campusSizeAcres} Acres</span></div>}
                  {details.overallRating && <div className="flex items-center p-3 bg-muted/40 rounded-md"><Star className="h-5 w-5 mr-2 text-yellow-500 fill-yellow-400"/> Rating: <span className="font-semibold ml-1">{details.overallRating}/5</span></div>}
              </div>
              {details.website && details.website !== '#' && (
                <Button variant="outline" size="sm" asChild className="mb-4">
                  <a href={details.website} target="_blank" rel="noopener noreferrer">
                    Visit College Website <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              {/* Placeholder for a more detailed summary if you add it to JSON */}
              <p className="text-muted-foreground leading-relaxed">
                Detailed information about branches, MHT-CET cutoffs, and category-wise fees is provided below.
                This data is for AY 2025 and should be verified with official sources.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center text-accent">
                <BarChart3 className="mr-2 h-6 w-6" /> Branches, Cutoffs & Fees (AY 2025)
              </h2>
              {details.branches && details.branches.length > 0 ? (
                <ScrollArea className="max-h-[500px] lg:max-h-none -mx-1 pr-2"> {/* Negative margin to offset ScrollArea padding */}
                  <div className="space-y-6">
                    {details.branches.map((branch, index) => (
                      <Card key={index} className="shadow-md border border-border/50 hover:shadow-lg transition-shadow bg-card/80 backdrop-blur-sm">
                        <CardHeader className="bg-muted/20 p-4 rounded-t-lg border-b">
                          <CardTitle className="text-lg font-semibold text-primary">{branch.branchName}</CardTitle>
                          {branch.intake && (
                            <CardDescription className="text-xs">Approx. Intake: {branch.intake} seats</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                          {branch.mhtCetCutoffs && (
                            renderCategoryTable(branch.mhtCetCutoffs, "MHT-CET Cutoffs", " %ile")
                          )}
                          {branch.fees && (
                             renderCategoryTable(branch.fees, "Category-wise Fees", " INR")
                          )}
                           {(!branch.mhtCetCutoffs && !branch.fees) && (
                             <p className="text-sm text-muted-foreground italic md:col-span-2">No specific cutoff or fee data available for this branch.</p>
                           )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground italic">No specific branch information found for this college in the provided data