
'use client';

import { useEffect, useState, useMemo, use } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Brain, Dna, Filter, Search as SearchIcon, Building, ListFilter, MapPin, School, Home,
  Calendar, Landmark, IndianRupee, Ruler, Star, ExternalLink, Sparkles, ChevronRight, Loader2, AlertCircle, BookOpenText, ArrowRight
} from 'lucide-react';
import type { College } from '@/types'; // Assuming College type includes id, name, district, stream, etc.
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getCollegeDetailsAction } from '@/app/auth/actions'; 
import type { CollegeDetailsOutput, CollegeDetailsInput } from '@/ai/flows/college-details-flow'; 
import { useToast } from "@/hooks/use-toast";


const MAHARASHTRA_DISTRICTS: string[] = [
  'All Districts', 'AhilyaNagar', 'Akola', 'Amravati', 'Chh. Sambhaji Nagar', 'Beed', 'Bhandara', 'Buldhana',
  'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna',
  'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded',
  'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad',
  'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha',
  'Washim', 'Yavatmal',
];

const getInitials = (name: string = '') => {
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase() || 'C';
  return parts.map(n => n[0]).slice(0,2).join('').toUpperCase() || 'C';
};

const mockColleges: College[] = [
  // AhilyaNagar (Ahmednagar)
  { id: '5178', name: 'Dr. Vithalrao Vikhe Patil College of Engineering, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Dr. Vithalrao Vikhe Patil College of Engineering'), website: '#' },
  { id: '5409', name: 'Rajiv Gandhi College of Engineering, At Post Karjule Hariya Tal.Parner, Dist.Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('Rajiv Gandhi College of Engineering Parner'), website: '#' },
  { id: '5139', name: 'Pravara Rural College of Engineering, Loni, Pravaranagar, Ahmednagar.', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹110000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('Pravara Rural College of Engineering Loni'), website: '#' },
  { id: '5382', name: 'Ahmednagar Jilha Maratha Vidya Prasarak Samajache, Shri. Chhatrapati Shivaji Maharaj College of Engineering, Nepti', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Chhatrapati Shivaji Maharaj Nepti'), website: '#' },
  { id: '5380', name: 'Adsuls Technical Campus, Chas Dist. Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹75000', campusSizeAcres: 12, rating: 3.6, logoPlaceholder: getInitials('Adsuls Technical Campus Chas'), website: '#' },
  { id: 'sgb_ahmednagar', name: 'Shri Sant Gadge Baba College of Engineering and Technology, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('Shri Sant Gadge Baba College of Engineering and Technology'), website: '#' },
  { id: '5408', name: 'Vidya Niketan College of Engineering, Bota Sangamner', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('Vidya Niketan Bota Sangamner'), website: '#' },
  { id: '5303', name: "Hon. Shri. Babanrao Pachpute Vichardhara Trust, Group of Institutions (Integrated Campus)-Parikrama, Kashti Shrigondha,", district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 22, rating: 4.0, logoPlaceholder: getInitials("Babanrao Pachpute Vichardhara Trust Kashti"), website: '#' },
  { id: 'scs_ahmednagar', name: 'Shri Chhatrapati Shivaji College of Engineering, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 17, rating: 3.8, logoPlaceholder: getInitials('Shri Chhatrapati Shivaji College of Engineering'), website: '#' },
  { id: 'ssbi_ahmednagar', name: 'Shri Sai Baba Institute of Engineering Research and Allied Sciences, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 14, rating: 3.7, logoPlaceholder: getInitials('Shri Sai Baba Institute of Engineering Research and Allied Sciences'), website: '#' },
  { id: '5179', name: "Vishwabharati Academy's College of Engineering, Ahmednagar", district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 19, rating: 3.9, logoPlaceholder: getInitials("Vishwabharati Academy's College of Engineering"), website: '#' },
  { id: 'ghr_ahmednagar', name: 'G H Raisoni College of Engineering and Management, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 20, rating: 4.2, logoPlaceholder: getInitials('G H Raisoni College of Engineering and Management'), website: '#' },
  { id: 'gp_ahmednagar', name: 'Government Polytechnic, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹15,000', campusSizeAcres: 30, rating: 4.3, logoPlaceholder: getInitials('Government Polytechnic'), website: '#' },
  { id: '5160', name: 'Sanjivani Rural Education Societys Sanjivani College of Engineering, Kopargaon', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,25,000', campusSizeAcres: 28, rating: 4.4, logoPlaceholder: getInitials('Sanjivani College of Engineering'), website: '#' },
  { id: '5161', name: 'Dr. Vithalrao Vikhe Patil College of Engineering, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Dr. Vithalrao Vikhe Patil College of Engineering Var'), website: '#' }, // Duplicate ID, but keeping as per list
  { id: '5162', name: 'Amrutvahini Sheti & Shikshan Vikas Sansthas Amrutvahini College of Engineering, Sangamner', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 26, rating: 4.3, logoPlaceholder: getInitials('Amrutvahini College of Engineering'), website: '#' },
  // ... all other 300+ colleges from previous step
  { id: '6991', name: 'Dr. D.Y. Patil Technical Campus, Varale, Talegaon, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('DYPTC Varale'), website: '#' },
];


// Helper to render category cutoffs
const renderCategoryCutoffs = (cutoffs: any, examName: string) => {
  if (!cutoffs || Object.keys(cutoffs).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No specific {examName} cutoff data available from AI.</p>;
  }
  const categories = ['open', 'obc', 'sc', 'st', 'vjnt', 'ews', 'tfws', 'other'];
  return (
    <div className="mt-2 space-y-1">
      {categories.map(catKey => {
        if (cutoffs[catKey]) {
          return (
            <div key={catKey} className="flex text-xs">
              <span className="w-20 shrink-0 font-medium text-muted-foreground capitalize">{catKey}:</span>
              <span className="text-foreground">{cutoffs[catKey]}</span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};


export default function CollegesPage({
  params: paramsAsProp,
  searchParams: searchParamsAsProp,
}: {
  params?: any;
  searchParams?: any;
}) {
  const _params = paramsAsProp ? use(paramsAsProp) : undefined;
  const _searchParams = searchParamsAsProp ? use(searchParamsAsProp) : undefined;

  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedStream, setSelectedStream] = useState<'PCB' | 'PCM' | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>('All Districts');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { toast } = useToast();
  const [selectedCollegeForDetails, setSelectedCollegeForDetails] = useState<College | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [aiCollegeDetails, setAiCollegeDetails] = useState<CollegeDetailsOutput | null>(null);
  const [isFetchingAiDetails, setIsFetchingAiDetails] = useState(false);
  const [aiDetailsError, setAiDetailsError] = useState<string | null>(null);

  const availableDistricts = MAHARASHTRA_DISTRICTS;
  const allColleges = mockColleges;

  useEffect(() => {
    if (!selectedStream && !isDetailsModalOpen) { // Keep modal closed if details dialog is open
      setIsModalOpen(true);
    }
  }, [selectedStream, isDetailsModalOpen]);

  const handleStreamSelect = (stream: 'PCB' | 'PCM') => {
    setSelectedStream(stream);
    setSelectedDistrict('All Districts'); // Reset district on stream change
    setSearchTerm('');
    setIsModalOpen(false);
  };

  const filteredColleges = useMemo(() => {
    if (!selectedStream) {
      return [];
    }
    return allColleges.filter(college =>
      (college.stream === selectedStream || college.stream === 'Both') &&
      (selectedDistrict === 'All Districts' || !selectedDistrict || college.district === selectedDistrict) &&
      college.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [selectedStream, selectedDistrict, searchTerm, allColleges]);

  const handleViewDetails = async (college: College) => {
    setSelectedCollegeForDetails(college);
    setIsDetailsModalOpen(true);
    setIsFetchingAiDetails(true);
    setAiCollegeDetails(null);
    setAiDetailsError(null);

    try {
      const result = await getCollegeDetailsAction({
        collegeName: college.name,
        collegeDistrict: college.district
      });
      if (result.success && result.details) {
        setAiCollegeDetails(result.details);
      } else {
        setAiDetailsError(result.error || "Failed to fetch AI-powered details for this college.");
        toast({
          title: "Error Fetching AI Details",
          description: result.error || "Could not retrieve AI-powered details for this college.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred while fetching details.";
      setAiDetailsError(message);
      toast({
        title: "Error",
        description: `Failed to fetch AI-powered college details: ${message}`,
        variant: "destructive",
      });
    } finally {
      setIsFetchingAiDetails(false);
    }
  };
  
  const handleDetailsModalOpenChange = (open: boolean) => {
    setIsDetailsModalOpen(open);
    if (!open) {
      // Reset AI details when modal is closed
      setAiCollegeDetails(null);
      setAiDetailsError(null);
      setIsFetchingAiDetails(false);
      setSelectedCollegeForDetails(null); // Also clear selected college
    }
  };

  const renderStars = (rating: number | undefined) => {
    if (rating === undefined || rating === null || rating === 0) return <span className="text-xs text-muted-foreground">N/A</span>;
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.4 && rating % 1 < 0.9; // For a more traditional half star
    const almostFullStar = rating % 1 >= 0.9; // If it's .9 or more, render as full
    let renderedFullStars = fullStars;
    if (almostFullStar) renderedFullStars++;
    
    const emptyStars = 5 - renderedFullStars - (halfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(renderedFullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
        ))}
        {halfStar && (
           <Star key="half" className="h-4 w-4 text-yellow-400" style={{clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)'}} />
        )}
        {[...Array(emptyStars < 0 ? 0 : emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-yellow-300" /> // A slightly different color for empty
        ))}
        <span className="ml-1.5 text-xs font-medium text-foreground">({rating.toFixed(1)})</span>
      </div>
    );
  };


  return (
    <div className="container mx-auto py-6 px-4 md:px-6 min-h-screen">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-primary">Select Your Stream</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Choose between PCM (Engineering) or PCB (Medical/Pharmacy) to find relevant MHT-CET colleges.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
            <Button
              variant="outline"
              className="h-auto py-6 text-lg border-2 border-primary/50 hover:border-primary hover:bg-primary/10 group"
              onClick={() => handleStreamSelect('PCM')}
            >
              <Brain className="mr-3 h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-semibold">PCM Group</p>
                <p className="text-xs text-muted-foreground">Engineering, Tech</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 text-lg border-2 border-primary/50 hover:border-primary hover:bg-primary/10 group"
              onClick={() => handleStreamSelect('PCB')}
            >
              <Dna className="mr-3 h-8 w-8 text-green-500 group-hover:scale-110 transition-transform" />
               <div>
                <p className="font-semibold">PCB Group</p>
                <p className="text-xs text-muted-foreground">Medical, Pharmacy</p>
              </div>
            </Button>
          </div>
           <DialogFooter className="sm:justify-center">
             <DialogClose asChild>
                <p className="text-xs text-muted-foreground text-center cursor-pointer hover:underline">You can change your stream selection later.</p>
             </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCollegeForDetails && (
        <Dialog open={isDetailsModalOpen} onOpenChange={handleDetailsModalOpenChange}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-3xl bg-background/95 backdrop-blur-sm">
            <DialogHeader className="pb-4 border-b mb-4">
              <DialogTitle className="text-xl md:text-2xl font-bold text-primary">{selectedCollegeForDetails.name}</DialogTitle>
              <DialogDescription className="text-sm md:text-base">
                {selectedCollegeForDetails.district} | Stream: {selectedCollegeForDetails.stream === 'Both' ? 'PCM & PCB' : selectedCollegeForDetails.stream}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] p-1 pr-3 -mr-2">
              <div className="space-y-6">
                {isFetchingAiDetails && (
                  <div className="flex flex-col items-center justify-center h-40">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                    <p className="text-muted-foreground">Fetching AI-powered details...</p>
                  </div>
                )}
                {aiDetailsError && !isFetchingAiDetails && (
                  <Alert variant="destructive" className="my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Fetching AI Details</AlertTitle>
                    <AlertDescription>
                      {aiDetailsError}
                    </AlertDescription>
                  </Alert>
                )}

                {aiCollegeDetails && !isFetchingAiDetails && !aiDetailsError && (
                  <>
                    <section className="mb-6">
                      <h3 className="text-lg font-semibold mb-2 flex items-center text-accent">
                        <BookOpenText className="mr-2 h-5 w-5" />
                        College Overview
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {aiCollegeDetails.collegeSummary || "No summary available from AI."}
                      </p>
                    </section>

                     {aiCollegeDetails.branches && aiCollegeDetails.branches.length > 0 && (
                        <section>
                          <h3 className="text-lg font-semibold mb-3 flex items-center text-accent">
                            <Sparkles className="mr-2 h-5 w-5" />
                            AI-Generated Branch Insights & Cutoffs
                          </h3>
                           <div className="space-y-4">
                            {aiCollegeDetails.branches.map((branch, index) => (
                              <Card key={index} className="shadow-md border border-border/60 hover:shadow-lg transition-shadow">
                                <CardHeader className="bg-muted/30 p-4 rounded-t-lg">
                                  <CardTitle className="text-md font-semibold text-primary">{branch.branchName}</CardTitle>
                                  {branch.intake && (
                                    <CardDescription className="text-xs">Approx. Intake: {branch.intake}</CardDescription>
                                  )}
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                  { (branch.mhtCetCutoff && Object.keys(branch.mhtCetCutoff).length > 0) && (
                                    <div>
                                      <h5 className="text-sm font-semibold mb-1.5 text-foreground">MHT-CET Cutoffs:</h5>
                                      {renderCategoryCutoffs(branch.mhtCetCutoff, "MHT-CET")}
                                    </div>
                                  )}
                                  { (branch.jeeMainCutoff && Object.keys(branch.jeeMainCutoff).length > 0) && (
                                    <div>
                                      <h5 className="text-sm font-semibold mb-1.5 text-foreground">JEE Main Cutoffs:</h5>
                                      {renderCategoryCutoffs(branch.jeeMainCutoff, "JEE Main")}
                                    </div>
                                  )}
                                  { (branch.neetCutoff && Object.keys(branch.neetCutoff).length > 0) && (
                                    <div>
                                      <h5 className="text-sm font-semibold mb-1.5 text-foreground">NEET Cutoffs:</h5>
                                      {renderCategoryCutoffs(branch.neetCutoff, "NEET")}
                                    </div>
                                  )}
                                  {
                                    !(branch.mhtCetCutoff && Object.keys(branch.mhtCetCutoff).length > 0) &&
                                    !(branch.jeeMainCutoff && Object.keys(branch.jeeMainCutoff).length > 0) &&
                                    !(branch.neetCutoff && Object.keys(branch.neetCutoff).length > 0) &&
                                    <p className="text-xs text-muted-foreground italic">No specific cutoff data available from AI for this branch.</p>
                                  }
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </section>
                      )}
                    {(!aiCollegeDetails.branches || aiCollegeDetails.branches.length === 0) && !isFetchingAiDetails && (
                        <p className="text-sm text-muted-foreground italic mt-4">No specific branch information available from AI for this college.</p>
                    )}
                  </>
                )}
                 {!aiCollegeDetails && !isFetchingAiDetails && !aiDetailsError && selectedCollegeForDetails && ( // Show only if a college is selected
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-700">
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                        Preparing AI Insights...
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Detailed branch information and typical cutoffs for {selectedCollegeForDetails.name} are being generated.
                        </p>
                    </div>
                 )}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => handleDetailsModalOpenChange(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedStream && (
        <div className="space-y-6 pt-4">
          <Card className="shadow-lg sticky top-4 md:top-6 z-10 bg-background/80 backdrop-blur-sm border-b">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className='flex items-center gap-2'>
                  <Button variant="ghost" size="icon" onClick={() => {setSelectedStream(null); setIsModalOpen(true);}} className="sm:hidden">
                     <ListFilter className="h-5 w-5 text-primary" />
                  </Button>
                  <h1 className="text-xl md:text-2xl font-bold text-primary flex items-center">
                     {selectedStream === 'PCM' ? <Brain className="mr-2 h-7 w-7 text-blue-500" /> : <Dna className="mr-2 h-7 w-7 text-green-500" />}
                    {selectedStream} Colleges in Maharashtra
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => {setSelectedStream(null); setIsModalOpen(true);}} className="hidden sm:inline-flex">
                    <Filter className="mr-2 h-4 w-4" /> Change Stream
                  </Button>
                   <Link href="/landing" passHref legacyBehavior>
                     <Button variant="outline" className="hidden sm:inline-flex">
                       <a><Home className="mr-2 h-4 w-4" /> Home</a>
                     </Button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="districtSelect" className="text-sm font-medium">Select District</Label>
                  <Select
                    value={selectedDistrict || 'All Districts'}
                    onValueChange={(value) => setSelectedDistrict(value === 'All Districts' || value === '' ? 'All Districts' : value)}
                  >
                    <SelectTrigger id="districtSelect" className="w-full mt-1">
                      <SelectValue placeholder="-- Select District --" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {availableDistricts.sort((a,b) => a === 'All Districts' ? -1 : b === 'All Districts' ? 1 : a.localeCompare(b)).map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="collegeSearch" className="text-sm font-medium">Search College Name</Label>
                  <div className="relative mt-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="collegeSearch"
                      type="text"
                      placeholder="Enter college name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDistrict ? (
            filteredColleges.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredColleges.map((college) => (
                 <Card key={college.id} className="shadow-md hover:shadow-xl transition-all duration-300 flex flex-col bg-card rounded-xl overflow-hidden border hover:border-primary/70 group">
                    <CardHeader className="p-4 border-b bg-muted/10 group-hover:bg-primary/5 transition-colors">
                      <CardTitle className="text-md font-semibold leading-tight group-hover:text-primary transition-colors">
                        {college.website && college.website !== '#' ? (
                          <a href={college.website} target="_blank" rel="noopener noreferrer" className="hover:underline focus:outline-none focus:ring-1 focus:ring-primary/50 rounded-sm inline-flex items-center gap-1">
                            {college.name} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary/80" />
                          </a>
                        ) : college.name }
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1 flex items-center">
                        <MapPin className="h-3 w-3 mr-1.5 flex-shrink-0" /> {college.district}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 flex-grow space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex items-center text-muted-foreground"><Calendar className="h-3.5 w-3.5 mr-1.5 text-sky-600 dark:text-sky-400 flex-shrink-0" /> Estd: <span className="font-medium text-foreground ml-1">{college.establishedYear || 'N/A'}</span></div>
                        <div className="flex items-center text-muted-foreground"><Landmark className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400 flex-shrink-0" /> Type: <span className="font-medium text-foreground ml-1">{college.collegeType || 'N/A'}</span></div>
                        <div className="flex items-center text-muted-foreground"><IndianRupee className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400 flex-shrink-0" /> Fees: <span className="font-medium text-foreground ml-1">{college.annualFees || 'N/A'}</span></div>
                        <div className="flex items-center text-muted-foreground"><Ruler className="h-3.5 w-3.5 mr-1.5 text-orange-600 dark:text-orange-400 flex-shrink-0" /> Campus: <span className="font-medium text-foreground ml-1">{college.campusSizeAcres ? `${college.campusSizeAcres} Acres` : 'N/A'}</span></div>
                      </div>
                       <div className="flex items-center pt-1.5">
                         {renderStars(college.rating)}
                      </div>
                    </CardContent>
                    <CardFooter className="p-3 border-t bg-transparent mt-auto">
                       <Button variant="default" size="sm" className="w-full group-hover:bg-primary/90 transition-colors" onClick={() => handleViewDetails(college)}>
                         View AI Insights <ArrowRight className="ml-2 h-4 w-4" />
                       </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="shadow-md mt-6 rounded-xl">
                <CardContent className="p-10 text-center text-muted-foreground">
                  <SearchIcon className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-xl font-semibold mb-2">No colleges found.</p>
                  <p className="text-sm">
                    Try selecting "All Districts" or a different district. If searching, clear your search term.
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
             <Card className="shadow-md mt-6 rounded-xl">
                <CardContent className="p-10 text-center">
                  <ListFilter className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Select a District</h3>
                  <p className="text-muted-foreground">
                    Please choose a district from the dropdown above to view colleges.
                  </p>
                </CardContent>
              </Card>
          )}
        </div>
      )}
    </div>
  );
}
