
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import collegeDataJson from '@/data/college_data_2025.json';
import type { CollegeDetailData, BranchDetail, CategoryWiseData, CollegeData2025 } from '@/types';
import { ArrowLeft, Building, BookOpenText, BarChart3, IndianRupee, Percent, Ruler, Star, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function CollegeDetailPage({ params }: { params: { collegeId: string } }) {
  const collegeId = decodeURIComponent(params.collegeId);
  const allCollegeData = collegeDataJson as CollegeData2025;
  const details: CollegeDetailData | undefined = allCollegeData[collegeId];

  if (!details) {
    notFound(); // Or return a custom "Not Found" component
  }

  const renderCategoryTable = (data: CategoryWiseData | undefined, title: string, unit: string = "") => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-sm text-muted-foreground italic mt-1">No specific {title.toLowerCase()} data available.</p>;
    }

    const primaryCategories: Array<keyof CategoryWiseData> = ['open', 'obc', 'sc', 'st', 'vjnt', 'ews', 'tfws'];
    const categoryLabels: Record<keyof CategoryWiseData | string, string> = {
      open: 'Open',
      obc: 'OBC',
      sc: 'SC',
      st: 'ST',
      vjnt: 'VJ/NT',
      ews: 'EWS',
      tfws: 'TFWS',
      other: 'Other/General'
    };

    const hasData = primaryCategories.some(catKey => data[catKey] !== undefined && data[catKey] !== null && data[catKey] !== '' && data[catKey] !== 'Data N/A' && data[catKey] !== 'N/A');
    const hasOtherData = data.other !== undefined && data.other !== null && data.other !== '' && data.other !== 'Data N/A' && data.other !== 'N/A';

    if (!hasData && !hasOtherData) {
        return <p className="text-sm text-muted-foreground italic mt-1">No specific {title.toLowerCase()} category data available.</p>;
    }

    return (
      <div>
        <h4 className="text-md font-semibold mt-3 mb-2 text-accent">{title}</h4>
        <div className="rounded-md border">
          <Table className="min-w-full text-xs sm:text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px] sm:w-[120px] font-medium">Category</TableHead>
                <TableHead className="text-right font-medium">Cutoff / Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {primaryCategories.map((catKey, index) => (
                (data[catKey] && data[catKey] !== "Data N/A" && data[catKey] !== "N/A") ? (
                  <TableRow key={catKey} className={cn("border-b-0", index < primaryCategories.filter(pc => data[pc] && data[pc] !== "Data N/A" && data[pc] !== "N/A").length -1 || (hasOtherData && data.other && !primaryCategories.filter(pc => data[pc] && data[pc] !== "Data N/A" && data[pc] !== "N/A").includes('other')) ? "border-b border-border/30 border-dashed" : "")}>
                    <TableCell className="font-medium py-1.5 sm:py-2">{categoryLabels[catKey]}</TableCell>
                    <TableCell className="text-right py-1.5 sm:py-2">{data[catKey]}{unit}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={catKey} className={cn("border-b-0", index < primaryCategories.filter(pc => data[pc] && data[pc] !== "Data N/A" && data[pc] !== "N/A").length -1 || (hasOtherData && data.other && !primaryCategories.filter(pc => data[pc] && data[pc] !== "Data N/A" && data[pc] !== "N/A").includes('other')) ? "border-b border-border/30 border-dashed" : "")}>
                    <TableCell className="font-medium py-1.5 sm:py-2">{categoryLabels[catKey]}</TableCell>
                    <TableCell className="text-right py-1.5 sm:py-2 text-muted-foreground/70">N/A</TableCell>
                  </TableRow>
                )
              ))}
              {data.other && data.other !== "Data N/A" && data.other !== "N/A" && (
                   <TableRow key="other_fallback" className="border-b-0">
                      <TableCell className="font-medium py-1.5 sm:py-2">{categoryLabels.other}</TableCell>
                      <TableCell className="text-right py-1.5 sm:py-2">{data.other}{unit}</TableCell>
                   </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

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
                  {details.overallRating && <div className="flex items-center p-3 bg-muted/40 rounded-md"><Star className="h-5 w-5 mr-2 text-yellow-500 fill-current"/> Rating: <span className="font-semibold ml-1">{details.overallRating}/5</span></div>}
              </div>
              {details.website && details.website !== '#' && (
                <Button variant="outline" size="sm" asChild className="mb-4">
                  <a href={details.website} target="_blank" rel="noopener noreferrer">
                    Visit College Website <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
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
                <ScrollArea className="-mx-1 pr-2">
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
                          {branch.jeeMainCutoffs && (
                            renderCategoryTable(branch.jeeMainCutoffs, "JEE Main Cutoffs", " Rank")
                          )}
                           {branch.neetCutoffs && (
                            renderCategoryTable(branch.neetCutoffs, "NEET Cutoffs", " Score")
                          )}
                          {branch.fees && (
                             renderCategoryTable(branch.fees, "Category-wise Fees", " INR")
                          )}
                           {(!branch.mhtCetCutoffs || Object.keys(branch.mhtCetCutoffs).filter(k => data[k] && data[k] !== "Data N/A" && data[k] !== "N/A").length === 0) &&
                            (!branch.jeeMainCutoffs || Object.keys(branch.jeeMainCutoffs).filter(k => data[k] && data[k] !== "Data N/A" && data[k] !== "N/A").length === 0) &&
                            (!branch.neetCutoffs || Object.keys(branch.neetCutoffs).filter(k => data[k] && data[k] !== "Data N/A" && data[k] !== "N/A").length === 0) &&
                            (!branch.fees || Object.keys(branch.fees).filter(k => data[k] && data[k] !== "Data N/A" && data[k] !== "N/A").length === 0) && (
                             <p className="text-sm text-muted-foreground italic md:col-span-2">No specific cutoff or fee data available for this branch.</p>
                           )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground italic">No specific branch information found for this college in the provided data.</p>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
