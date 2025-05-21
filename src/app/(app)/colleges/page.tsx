
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Dna, Filter, Search as SearchIcon, Building, ListFilter, MapPin, Users2 } from 'lucide-react';
import type { College } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock Data (Replace with API call in the future)
const MAHARASHTRA_DISTRICTS: string[] = [
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana',
  'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna',
  'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded',
  'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad',
  'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha',
  'Washim', 'Yavatmal',
];

const mockColleges: College[] = [
  { id: '1', name: 'Veermata Jijabai Technological Institute (VJTI)', district: 'Mumbai City', stream: 'PCM' },
  { id: '2', name: 'College of Engineering, Pune (COEP) Technological University', district: 'Pune', stream: 'PCM' },
  { id: '3', name: 'Institute of Chemical Technology (ICT)', district: 'Mumbai City', stream: 'PCM' },
  { id: '4', name: 'Sardar Patel Institute of Technology (SPIT), Mumbai', district: 'Mumbai Suburban', stream: 'PCM' },
  { id: '5', name: 'Dwarkadas J. Sanghvi College of Engineering (DJSCE), Mumbai', district: 'Mumbai Suburban', stream: 'PCM' },
  { id: '6', name: 'Vishwakarma Institute of Technology (VIT), Pune', district: 'Pune', stream: 'PCM' },
  { id: '7', name: 'Pune Institute of Computer Technology (PICT), Pune', district: 'Pune', stream: 'PCM' },
  { id: '8', name: 'Government College of Engineering, Karad', district: 'Satara', stream: 'PCM' },
  { id: '9', name: 'Walchand College of Engineering, Sangli', district: 'Sangli', stream: 'PCM' },
  { id: '10', name: 'Shri Ramdeobaba College of Engineering and Management, Nagpur', district: 'Nagpur', stream: 'PCM' },
  { id: '11', name: 'Grant Government Medical College, Mumbai', district: 'Mumbai City', stream: 'PCB' },
  { id: '12', name: 'Seth GS Medical College (KEM), Mumbai', district: 'Mumbai City', stream: 'PCB' },
  { id: '13', name: 'Byramjee Jeejeebhoy Government Medical College (BJMC), Pune', district: 'Pune', stream: 'PCB' },
  { id: '14', name: 'Lokmanya Tilak Municipal Medical College (Sion), Mumbai', district: 'Mumbai Suburban', stream: 'PCB' },
  { id: '15', name: 'Government Medical College, Nagpur', district: 'Nagpur', stream: 'PCB' },
  { id: '16', name: 'Topiwala National Medical College (Nair), Mumbai', district: 'Mumbai City', stream: 'PCB' },
  { id: '17', name: 'Government Medical College, Aurangabad', district: 'Aurangabad', stream: 'PCB' },
  { id: '18', name: 'Dr. Vaishampayan Memorial Government Medical College, Solapur', district: 'Solapur', stream: 'PCB' },
  { id: '19', name: 'Rajiv Gandhi Medical College, Thane', district: 'Thane', stream: 'PCB' },
  { id: '20', name: 'Armed Forces Medical College (AFMC), Pune', district: 'Pune', stream: 'PCB' },
  { id: '21', name: 'MIT World Peace University (MIT-WPU) - Faculty of Engineering, Pune', district: 'Pune', stream: 'Both' },
  { id: '22', name: 'Bharati Vidyapeeth Deemed University College of Engineering, Pune', district: 'Pune', stream: 'Both' },
];


export default function CollegesPage() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedStream, setSelectedStream] = useState<'PCB' | 'PCM' | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  // const [allColleges] = useState<College[]>(mockColleges); // If fetching, replace with fetched data
  // const [isLoading, setIsLoading] = useState(false); // For API calls

  useEffect(() => {
    if (!selectedStream) {
      setIsModalOpen(true);
    }
  }, [selectedStream]);

  const handleStreamSelect = (stream: 'PCB' | 'PCM') => {
    setSelectedStream(stream);
    setSelectedDistrict(null); // Reset district when stream changes
    setSearchTerm(''); // Reset search term
    setIsModalOpen(false);
  };

  const filteredColleges = useMemo(() => {
    if (!selectedStream || !selectedDistrict) {
      return [];
    }
    return mockColleges.filter(college =>
      (college.stream === selectedStream || college.stream === 'Both') &&
      college.district === selectedDistrict &&
      college.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedStream, selectedDistrict, searchTerm]);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 min-h-screen">
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open && !selectedStream) setIsModalOpen(true); else setIsModalOpen(open);}}>
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
            <p className="text-xs text-muted-foreground text-center">You can change your stream selection later.</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedStream && (
        <div className="space-y-8">
          <Card className="shadow-lg sticky top-16 md:top-20 z-10 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className='flex items-center gap-2'>
                  <Button variant="ghost" size="icon" onClick={() => {setSelectedStream(null); setIsModalOpen(true);}} className="sm:hidden">
                     <ListFilter className="h-5 w-5" />
                  </Button>
                  <h1 className="text-2xl font-bold text-primary">
                    {selectedStream} Colleges in Maharashtra
                  </h1>
                </div>
                <Button variant="outline" onClick={() => {setSelectedStream(null); setIsModalOpen(true);}} className="hidden sm:inline-flex">
                  <Filter className="mr-2 h-4 w-4" /> Change Stream
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="districtSelect" className="text-sm font-medium">Select District</Label>
                  <Select
                    value={selectedDistrict || ''}
                    onValueChange={(value) => setSelectedDistrict(value === 'all' ? null : value)}
                  >
                    <SelectTrigger id="districtSelect" className="w-full mt-1">
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        <SelectItem value="all">All Districts</SelectItem>
                        {MAHARASHTRA_DISTRICTS.sort().map((district) => (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredColleges.map((college) => (
                  <Card key={college.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary flex items-start">
                        <Building className="h-6 w-6 mr-3 text-accent shrink-0 mt-1"/>
                        {college.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400"/> District: {college.district}
                      </div>
                       <div className="flex items-center text-sm text-muted-foreground">
                        <Users2 className="h-4 w-4 mr-2 text-gray-400"/> Stream: {college.stream === 'Both' ? 'PCM & PCB' : college.stream}
                      </div>
                    </CardContent>
                    <CardFooter>
                       <Button variant="outline" className="w-full" onClick={() => alert(`More details for ${college.name} (Coming Soon)`)}>
                         View Details
                       </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="shadow-md">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p className="text-lg">No colleges found matching your criteria for "{selectedDistrict}".</p>
                  <p className="text-sm">Try a different district or broaden your search term.</p>
                </CardContent>
              </Card>
            )
          ) : (
             <Card className="shadow-md">
                <CardContent className="p-10 text-center">
                  <ListFilter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
