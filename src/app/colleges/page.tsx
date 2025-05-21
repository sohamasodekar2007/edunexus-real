
'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Brain, Dna, Filter, Search as SearchIcon, Building, ListFilter, MapPin, Users2, School, Home,
  Calendar, Landmark, IndianRupee, Ruler, Star, ExternalLink, Sparkles, ChevronRight
} from 'lucide-react';
import type { College } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const MAHARASHTRA_DISTRICTS: string[] = [
  'All Districts', 'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana',
  'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna',
  'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded',
  'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad',
  'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha',
  'Washim', 'Yavatmal',
];

const getInitials = (name: string = '') => {
  return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || 'C';
};

const mockColleges: College[] = [
  { id: '1', name: 'Veermata Jijabai Technological Institute (VJTI)', district: 'Mumbai City', stream: 'PCM', establishedYear: 1887, collegeType: 'Autonomous', annualFees: '₹85,000', campusSizeAcres: 16, rating: 4.7, logoPlaceholder: 'VJ', website: 'https://vjti.ac.in', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '2', name: 'College of Engineering, Pune (COEP) Technological University', district: 'Pune', stream: 'PCM', establishedYear: 1854, collegeType: 'University Department', annualFees: '₹90,000', campusSizeAcres: 36, rating: 4.8, logoPlaceholder: 'CE', website: 'https://www.coep.org.in', courses: ['Comp Engg', 'ENTC', 'Civil Engg'] },
  { id: '3', name: 'Institute of Chemical Technology (ICT)', district: 'Mumbai City', stream: 'PCM', establishedYear: 1933, collegeType: 'Deemed', annualFees: '₹86,000', campusSizeAcres: 16, rating: 4.6, logoPlaceholder: 'IC', website: 'https://www.ictmumbai.edu.in', courses: ['Chem Engg', 'Pharma Sci', 'Food Engg'] },
  { id: '4', name: 'Sardar Patel Institute of Technology (SPIT), Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1995, collegeType: 'Private', annualFees: '₹1,70,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: 'SP', website: 'https://www.spit.ac.in', courses: ['Comp Engg', 'EXTC', 'IT'] },
  { id: '5', name: 'Dwarkadas J. Sanghvi College of Engineering (DJSCE), Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,90,000', campusSizeAcres: 5, rating: 4.4, logoPlaceholder: 'DJ', website: 'https://www.djsce.ac.in', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '6', name: 'Vishwakarma Institute of Technology (VIT), Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,80,000', campusSizeAcres: 7, rating: 4.3, logoPlaceholder: 'VI', website: 'https://www.vit.edu', courses: ['Comp Engg', 'AI & DS', 'ENTC'] },
  { id: '7', name: 'Pune Institute of Computer Technology (PICT), Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: 'PI', website: 'https://pict.edu', courses: ['Comp Engg', 'IT', 'ENTC'] },
  { id: '8', name: 'Grant Government Medical College, Mumbai', district: 'Mumbai City', stream: 'PCB', establishedYear: 1845, collegeType: 'Government', annualFees: '₹1,00,000', campusSizeAcres: 44, rating: 4.7, logoPlaceholder: 'GG', website: 'https://www.ggmc.org', courses: ['MBBS'] },
  { id: '9', name: 'Seth GS Medical College (KEM), Mumbai', district: 'Mumbai City', stream: 'PCB', establishedYear: 1926, collegeType: 'Government', annualFees: '₹1,10,000', campusSizeAcres: 40, rating: 4.8, logoPlaceholder: 'SG', website: 'https://www.kem.edu', courses: ['MBBS', 'MD', 'MS'] },
  { id: '10', name: 'Byramjee Jeejeebhoy Government Medical College (BJMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1946, collegeType: 'Government', annualFees: '₹95,000', campusSizeAcres: 100, rating: 4.6, logoPlaceholder: 'BJ', website: 'https://www.bjmcpune.org', courses: ['MBBS'] },
  { id: '11', name: 'Armed Forces Medical College (AFMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1948, collegeType: 'Government', annualFees: 'Varies', campusSizeAcres: 119, rating: 4.9, logoPlaceholder: 'AF', website: 'https://afmc.nic.in', courses: ['MBBS'] },
  { id: '12', name: 'MIT World Peace University (MIT-WPU) - Faculty of Engineering, Pune', district: 'Pune', stream: 'Both', establishedYear: 1983, collegeType: 'Private', annualFees: '₹3,50,000', campusSizeAcres: 65, rating: 4.2, logoPlaceholder: 'MI', website: 'https://mitwpu.edu.in', courses: ['Comp Engg (PCM)', 'B.Pharm (PCB)'] },
];


export default function CollegesPage() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedStream, setSelectedStream] = useState<'PCB' | 'PCM' | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>('All Districts');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedCollegeForDetails, setSelectedCollegeForDetails] = useState<College | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const availableDistricts = MAHARASHTRA_DISTRICTS;
  const allColleges = mockColleges;

  useEffect(() => {
    if (!selectedStream) {
      setIsModalOpen(true);
    }
  }, [selectedStream]);

  const handleStreamSelect = (stream: 'PCB' | 'PCM') => {
    setSelectedStream(stream);
    setSelectedDistrict('All Districts');
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
    );
  }, [selectedStream, selectedDistrict, searchTerm, allColleges]);

  const handleViewDetails = (college: College) => {
    setSelectedCollegeForDetails(college);
    setIsDetailsModalOpen(true);
  };
  
  const renderStars = (rating: number | undefined) => {
    if (rating === undefined || rating === null) return <span className="text-xs text-muted-foreground">N/A</span>;
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.4 && rating % 1 < 0.9; // Heuristic for half star
    const almostFullStar = rating % 1 >= 0.9; // Heuristic for almost full star
    let renderedFullStars = fullStars;
    if(almostFullStar) renderedFullStars++;
    
    const emptyStars = 5 - renderedFullStars - (halfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(renderedFullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
        ))}
        {halfStar && (
           <Star key="half" className="h-4 w-4 text-yellow-400" style={{clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)'}} />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-yellow-300" />
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
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary">{selectedCollegeForDetails.name}</DialogTitle>
              <DialogDescription>
                District: {selectedCollegeForDetails.district} | Stream: {selectedCollegeForDetails.stream === 'Both' ? 'PCM & PCB' : selectedCollegeForDetails.stream}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Detailed branch-wise information, cutoffs, and admission insights for this college are currently being curated.
              </p>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center">
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  AI-Powered Insights (Coming Soon):
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Our AI (like Gemini) will soon provide summaries of popular branches, typical MHT-CET/JEE/NEET cutoff ranges, and key highlights for {selectedCollegeForDetails.name}! Stay tuned.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedStream && (
        <div className="space-y-6 pt-4">
          <Card className="shadow-lg sticky top-4 md:top-6 z-10 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className='flex items-center gap-2'>
                  <Button variant="ghost" size="icon" onClick={() => {setSelectedStream(null); setIsModalOpen(true);}} className="sm:hidden">
                     <ListFilter className="h-5 w-5" />
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
                  <Link href="/landing" passHref>
                    <Button variant="outline" className="hidden sm:inline-flex">
                      <Home className="mr-2 h-4 w-4" /> Home
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
                      disabled={!selectedDistrict && selectedDistrict !== 'All Districts'}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDistrict ? (
            filteredColleges.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredColleges.map((college) => (
                  <Card key={college.id} className="shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col bg-card rounded-xl overflow-hidden border hover:border-primary group">
                    <CardHeader className="flex flex-row items-center gap-4 p-4 bg-muted/20 group-hover:bg-primary/5 transition-colors">
                      <Avatar className="h-16 w-16 rounded-lg border-2 border-primary/20">
                        <AvatarImage src={`https://placehold.co/80x80.png?text=${college.logoPlaceholder || getInitials(college.name)}`} alt={college.name} data-ai-hint="college emblem" />
                        <AvatarFallback>{college.logoPlaceholder || getInitials(college.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base md:text-md font-bold leading-tight group-hover:text-primary transition-colors">
                          {college.website ? (
                            <a href={college.website} target="_blank" rel="noopener noreferrer" className="hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm">
                              {college.name} <ExternalLink className="inline-block h-3.5 w-3.5 ml-1 text-muted-foreground group-hover:text-primary" />
                            </a>
                          ) : college.name }
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1 flex items-center">
                          <MapPin className="h-3.5 w-3.5 mr-1.5" /> {college.district}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-grow space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted-foreground">
                        <div className="flex items-center text-xs"><Calendar className="h-3.5 w-3.5 mr-1.5 text-sky-600" /> Estd: <span className="font-medium text-foreground ml-1">{college.establishedYear || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><Landmark className="h-3.5 w-3.5 mr-1.5 text-purple-600" /> Type: <span className="font-medium text-foreground ml-1">{college.collegeType || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><IndianRupee className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Fees: <span className="font-medium text-foreground ml-1">{college.annualFees || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><Ruler className="h-3.5 w-3.5 mr-1.5 text-orange-600" /> Campus: <span className="font-medium text-foreground ml-1">{college.campusSizeAcres ? `${college.campusSizeAcres} Acres` : 'N/A'}</span></div>
                      </div>
                       <div className="flex items-center pt-2">
                         {renderStars(college.rating)}
                      </div>
                       {college.courses && college.courses.length > 0 && (
                        <div className="pt-1">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 tracking-wider">Popular Streams</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {college.courses.slice(0, 3).map(course => (
                              <Badge key={course} variant="secondary" className="text-xs px-2 py-0.5">{course}</Badge>
                            ))}
                             {college.courses.length > 3 && <Badge variant="outline" className="text-xs px-2 py-0.5">+{college.courses.length-3} more</Badge>}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-3 border-t bg-transparent">
                       <Button variant="default" size="sm" className="w-full group-hover:bg-primary/90 transition-colors" onClick={() => handleViewDetails(college)}>
                         View Details <ChevronRight className="ml-2 h-4 w-4" />
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
