
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
  Calendar, Landmark, IndianRupee, Ruler, Star, ExternalLink, Sparkles, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';
import type { College } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getCollegeDetailsAction } from '@/app/auth/actions'; 
import type { CollegeDetailsOutput } from '@/ai/flows/college-details-flow'; 
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
  { id: '1', name: 'Veermata Jijabai Technological Institute (VJTI)', district: 'Mumbai City', stream: 'PCM', establishedYear: 1887, collegeType: 'Autonomous', annualFees: '₹85,000', campusSizeAcres: 16, rating: 4.7, logoPlaceholder: getInitials('Veermata Jijabai Technological Institute'), website: 'https://vjti.ac.in', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '2', name: 'College of Engineering, Pune (COEP) Technological University', district: 'Pune', stream: 'PCM', establishedYear: 1854, collegeType: 'University Department', annualFees: '₹90,000', campusSizeAcres: 36, rating: 4.8, logoPlaceholder: getInitials('College of Engineering, Pune'), website: 'https://www.coep.org.in', courses: ['Comp Engg', 'ENTC', 'Civil Engg'] },
  { id: '3', name: 'Institute of Chemical Technology (ICT)', district: 'Mumbai City', stream: 'PCM', establishedYear: 1933, collegeType: 'Deemed', annualFees: '₹86,000', campusSizeAcres: 16, rating: 4.6, logoPlaceholder: getInitials('Institute of Chemical Technology'), website: 'https://www.ictmumbai.edu.in', courses: ['Chem Engg', 'Pharma Sci', 'Food Engg'] },
  { id: '4', name: 'Sardar Patel Institute of Technology (SPIT), Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1995, collegeType: 'Private', annualFees: '₹1,70,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: getInitials('Sardar Patel Institute of Technology'), website: 'https://www.spit.ac.in', courses: ['Comp Engg', 'EXTC', 'IT'] },
  { id: '5', name: 'Dwarkadas J. Sanghvi College of Engineering (DJSCE), Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,90,000', campusSizeAcres: 5, rating: 4.4, logoPlaceholder: getInitials('Dwarkadas J. Sanghvi College of Engineering'), website: 'https://www.djsce.ac.in', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '6', name: 'Vishwakarma Institute of Technology (VIT), Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,80,000', campusSizeAcres: 7, rating: 4.3, logoPlaceholder: getInitials('Vishwakarma Institute of Technology'), website: 'https://www.vit.edu', courses: ['Comp Engg', 'AI & DS', 'ENTC'] },
  { id: '7', name: 'Pune Institute of Computer Technology (PICT), Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: getInitials('Pune Institute of Computer Technology'), website: 'https://pict.edu', courses: ['Comp Engg', 'IT', 'ENTC'] },
  { id: '8', name: 'Grant Government Medical College, Mumbai', district: 'Mumbai City', stream: 'PCB', establishedYear: 1845, collegeType: 'Government', annualFees: '₹1,00,000', campusSizeAcres: 44, rating: 4.7, logoPlaceholder: getInitials('Grant Government Medical College'), website: 'https://www.ggmc.org', courses: ['MBBS'] },
  { id: '9', name: 'Seth GS Medical College (KEM), Mumbai', district: 'Mumbai City', stream: 'PCB', establishedYear: 1926, collegeType: 'Government', annualFees: '₹1,10,000', campusSizeAcres: 40, rating: 4.8, logoPlaceholder: getInitials('Seth GS Medical College'), website: 'https://www.kem.edu', courses: ['MBBS', 'MD', 'MS'] },
  { id: '10', name: 'Byramjee Jeejeebhoy Government Medical College (BJMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1946, collegeType: 'Government', annualFees: '₹95,000', campusSizeAcres: 100, rating: 4.6, logoPlaceholder: getInitials('Byramjee Jeejeebhoy Government Medical College'), website: 'https://www.bjmcpune.org', courses: ['MBBS'] },
  { id: '11', name: 'Armed Forces Medical College (AFMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1948, collegeType: 'Government', annualFees: 'Varies', campusSizeAcres: 119, rating: 4.9, logoPlaceholder: getInitials('Armed Forces Medical College'), website: 'https://afmc.nic.in', courses: ['MBBS'] },
  { id: '12', name: 'MIT World Peace University (MIT-WPU) - Faculty of Engineering, Pune', district: 'Pune', stream: 'Both', establishedYear: 1983, collegeType: 'Private', annualFees: '₹3,50,000', campusSizeAcres: 65, rating: 4.2, logoPlaceholder: getInitials('MIT World Peace University'), website: 'https://mitwpu.edu.in', courses: ['Comp Engg (PCM)', 'B.Pharm (PCB)'] },
  { id: '13', name: 'Bharati Vidyapeeth Deemed University College of Engineering, Pune', district: 'Pune', stream: 'Both', establishedYear: 1983, collegeType: 'Deemed', annualFees: '₹1,60,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('Bharati Vidyapeeth Deemed University College of Engineering'), website: 'https://coepune.bharatividyapeeth.edu/', courses: ['IT (PCM)', 'B.Tech Biotech (PCB)'] },
  // AhilyaNagar Colleges
  { id: '14', name: 'Dr. Vithalrao Vikhe Patil College of Engineering, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Dr. Vithalrao Vikhe Patil College of Engineering'), website: '#', courses: ['Mech Engg', 'Comp Engg', 'Civil Engg'] },
  { id: '15', name: 'Rajiv Gandhi College of Engineering & Polytechnic, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('Rajiv Gandhi College of Engineering & Polytechnic'), website: '#', courses: ['Comp Engg', 'ENTC', 'Mech Engg'] },
  { id: '16', name: 'Pravara Rural Engineering College, Loni', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('Pravara Rural Engineering College'), website: '#', courses: ['Chem Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '17', name: 'Shri Chhatrapati Shivaji Maharaj College of Engineering, Nepti', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Shri Chhatrapati Shivaji Maharaj College of Engineering'), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '18', name: 'Adsul Technical Campus Faculty of Engineering & MBA, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.6, logoPlaceholder: getInitials('Adsul Technical Campus'), website: '#', courses: ['Comp Engg', 'ENTC', 'MBA'] },
  { id: '19', name: 'Shri Sant Gadge Baba College of Engineering and Technology, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('Shri Sant Gadge Baba College of Engineering'), website: '#', courses: ['Mech Engg', 'Civil Engg', 'Electrical Engg'] },
  { id: '20', name: 'Vidya Niketan College of Engineering, Sangamner', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('Vidya Niketan College of Engineering'), website: '#', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '21', name: "Hon. Shri Babanrao Pachpute Vichardhara Trust's Faculty of Engineering, AhilyaNagar", district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 22, rating: 4.0, logoPlaceholder: getInitials("Hon. Shri Babanrao Pachpute Vichardhara Trust"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'Civil Engg'] },
  { id: '22', name: 'Shri Chhatrapati Shivaji College of Engineering, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 17, rating: 3.8, logoPlaceholder: getInitials('Shri Chhatrapati Shivaji College of Engineering'), website: '#', courses: ['ENTC', 'Comp Engg', 'Mech Engg'] },
  { id: '23', name: 'Shri Sai Baba Institute of Engineering Research and Allied Sciences, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 14, rating: 3.7, logoPlaceholder: getInitials('Shri Sai Baba Institute'), website: '#', courses: ['IT', 'Comp Engg', 'ENTC'] },
  { id: '24', name: "Vishwabharati Academy's College of Engineering, AhilyaNagar", district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 19, rating: 3.9, logoPlaceholder: getInitials("Vishwabharati Academy"), website: '#', courses: ['Mech Engg', 'Comp Engg', 'AI & DS'] },
  { id: '25', name: 'G H Raisoni College of Engineering and Management, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 20, rating: 4.2, logoPlaceholder: getInitials('G H Raisoni College'), website: '#', courses: ['Comp Engg', 'IT', 'Data Science'] },
  { id: '26', name: 'Government Polytechnic, AhilyaNagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹15,000', campusSizeAcres: 30, rating: 4.3, logoPlaceholder: getInitials('Government Polytechnic AhilyaNagar'), website: '#', courses: ['Diploma Mech', 'Diploma Civil', 'Diploma Electrical'] },
  { id: '27', name: 'Sanjivani College of Engineering, Kopargaon', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,25,000', campusSizeAcres: 28, rating: 4.4, logoPlaceholder: getInitials('Sanjivani College of Engineering'), website: '#', courses: ['Comp Engg', 'Mech Engg', 'IT'] },
  { id: '28', name: 'Amrutvahini College of Engineering, Sangamner', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 26, rating: 4.3, logoPlaceholder: getInitials('Amrutvahini College of Engineering'), website: '#', courses: ['Mech Engg', 'Comp Engg', 'Civil Engg'] },
  // Akola Colleges
  { id: '29', name: "Shri Shivaji Education Society's College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials("Shri Shivaji Education Society's College"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'Civil Engg'] },
  { id: '30', name: "College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("College of Engineering and Technology Akola"), website: '#', courses: ['ENTC', 'IT', 'Electrical Engg'] },
  { id: '31', name: "Bhonsala College of Engineering and Research, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials("Bhonsala College"), website: '#', courses: ['Comp Engg', 'Mech Engg'] },
  { id: '32', name: "Manav School of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Manav School"), website: '#', courses: ['Civil Engg', 'Comp Engg'] },
  { id: '33', name: "Vidyabharati College of Engineering, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Vidyabharati College"), website: '#', courses: ['Mech Engg', 'ENTC'] },
  { id: '34', name: "Government Polytechnic, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1958, collegeType: 'Government', annualFees: '₹12,000', campusSizeAcres: 30, rating: 4.2, logoPlaceholder: getInitials("Government Polytechnic Akola"), website: '#', courses: ['Diploma Mech', 'Diploma Electrical', 'Diploma Civil'] },
  { id: '35', name: "J D College of Engineering & Management - Extension Center, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials("J D College"), website: '#', courses: ['Comp Engg', 'MBA'] },
  { id: '36', name: "Shankarlal Agrawal College of Engineering & Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials("Shankarlal Agrawal College"), website: '#', courses: ['IT', 'Mech Engg'] },
  { id: '37', name: "Shri Hanuman Vyayam Prasarak Mandal's College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 22, rating: 4.0, logoPlaceholder: getInitials("Shri Hanuman Vyayam Prasarak Mandal"), website: '#', courses: ['Comp Engg', 'Civil Engg', 'Mech Engg'] },
  // Amravati Colleges
  { id: '38', name: "Government College of Engineering, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 1964, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 114, rating: 4.5, logoPlaceholder: getInitials("Government College Amravati"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '39', name: "Prof. Ram Meghe Institute of Technology & Research, Badnera", district: 'Amravati', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.3, logoPlaceholder: getInitials("Prof Ram Meghe Institute"), website: '#', courses: ['IT', 'Comp Engg', 'ENTC'] },
  { id: '40', name: "P. R. Pote (Patil) College of Engineering & Management, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials("P R Pote Patil College"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'MBA'] },
  { id: '41', name: "Sipna College of Engineering and Technology, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 22, rating: 4.2, logoPlaceholder: getInitials("Sipna College"), website: '#', courses: ['Comp Engg', 'IT', 'Electrical Engg'] },
  { id: '42', name: "G. H. Raisoni College of Engineering and Management, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials("G H Raisoni Amravati"), website: '#', courses: ['Comp Engg', 'AI & DS', 'Mech Engg'] },
  { id: '43', name: "Shri Hanuman Vyayam Prasarak Mandal's College of Engineering & Technology, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials("HVPM Amravati"), website: '#', courses: ['Civil Engg', 'Comp Engg', 'ENTC'] },
  { id: '44', name: "Dr. Rajendra Gode Institute of Technology & Research, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials("Dr Rajendra Gode Institute"), website: '#', courses: ['Mech Engg', 'IT', 'Comp Engg'] },
  { id: '45', name: "P. R. Patil College of Engineering & Technology, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials("P R Patil College"), website: '#', courses: ['Comp Engg', 'Electrical Engg'] },
  { id: '46', name: "DES's College of Engineering and Technology, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials("DES College Amravati"), website: '#', courses: ['Civil Engg', 'Mech Engg'] },
  { id: '47', name: "IBSS College of Engineering, Amravati", district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 7, rating: 3.6, logoPlaceholder: getInitials("IBSS College"), website: '#', courses: ['Comp Engg', 'IT'] },
  // Beed Colleges
  { id: '48', name: "Aditya Engineering College, Beed", district: 'Beed', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials("Aditya Engineering College Beed"), website: '#', courses: ['Mech Engg', 'Comp Engg', 'Civil Engg'] },
  { id: '49', name: "Nagnathappa Halge Engineering College, Parli, Beed", district: 'Beed', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials("Nagnathappa Halge Engineering College"), website: '#', courses: ['Electrical Engg', 'Comp Engg'] },
  { id: '50', name: "Mahatma Basaveshwar Education Society's College of Engineering, Beed", district: 'Beed', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("Mahatma Basaveshwar College"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'ENTC'] },
  { id: '51', name: "Aditya College of Agricultural Engineering and Technology, Beed", district: 'Beed', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Aditya Agricultural Engineering"), website: '#', courses: ['Agricultural Engg'] },
  { id: '52', name: "Aditya College of Food Technology, Beed", district: 'Beed', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹92,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials("Aditya Food Technology"), website: '#', courses: ['Food Technology'] },
  { id: '53', name: "Aditya College of Agricultural Biotechnology, Beed", district: 'Beed', stream: 'PCB', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials("Aditya Agri Biotech"), website: '#', courses: ['Agricultural Biotech'] },
  // Bhandara Colleges
  { id: '54', name: "Madhukarrao Pandav College of Engineering, Bhandara", district: 'Bhandara', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Madhukarrao Pandav College"), website: '#', courses: ['Comp Engg', 'Mech Engg'] },
  { id: '55', name: "Manoharbhai Patel Institute of Engineering and Technology (MPIET), Bhandara", district: 'Bhandara', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials("Manoharbhai Patel Institute"), website: '#', courses: ['Civil Engg', 'Comp Engg', 'Electrical Engg'] },
  { id: '56', name: "Karanjekar College of Engineering & Management, Bhandara", district: 'Bhandara', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials("Karanjekar College"), website: '#', courses: ['Mech Engg', 'MBA'] },
  // Buldhana Colleges
  { id: '57', name: "Sant Gadge Baba Amravati University College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'University Department', annualFees: '₹30,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials("SGBAU College Buldhana"), website: '#', courses: ['Comp Engg', 'IT'] },
  { id: '58', name: "K.K.Wagh Institute of Engineering Education and Research, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 4.1, logoPlaceholder: getInitials("K K Wagh Buldhana"), website: '#', courses: ['Mech Engg', 'ENTC'] },
  { id: '59', name: "Dr. Panjabrao Deshmukh College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Dr Panjabrao Deshmukh Buldhana"), website: '#', courses: ['Civil Engg', 'Comp Engg'] },
  { id: '60', name: "Vidarbha Institute of Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Vidarbha Institute Buldhana"), website: '#', courses: ['Mech Engg', 'Electrical Engg'] },
  { id: '61', name: "M.I.T. College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials("MIT Buldhana"), website: '#', courses: ['Comp Engg', 'IT'] },
  { id: '62', name: "Shri Shivaji Education Society's Institute of Engineering and Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 16, rating: 3.9, logoPlaceholder: getInitials("Shri Shivaji Buldhana"), website: '#', courses: ['ENTC', 'Mech Engg'] },
  { id: '63', name: "K.B.P. College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹78,000', campusSizeAcres: 13, rating: 3.8, logoPlaceholder: getInitials("KBP College Buldhana"), website: '#', courses: ['Civil Engg', 'Comp Engg'] },
  { id: '64', name: "A.G. Patil Institute of Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹72,000', campusSizeAcres: 9, rating: 3.6, logoPlaceholder: getInitials("AG Patil Buldhana"), website: '#', courses: ['Mech Engg', 'IT'] },
  { id: '65', name: "Babasaheb Naik College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("Babasaheb Naik Buldhana"), website: '#', courses: ['Comp Engg', 'Electrical Engg'] },
  // Chandrapur Colleges
  { id: '66', name: "Government College of Engineering, Chandrapur", district: 'Chandrapur', stream: 'PCM', establishedYear: 1996, collegeType: 'Government', annualFees: '₹22,000', campusSizeAcres: 62, rating: 4.3, logoPlaceholder: getInitials("Government College Chandrapur"), website: '#', courses: ['Mech Engg', 'Electrical Engg', 'Comp Engg'] },
  { id: '67', name: "Rajiv Gandhi College of Engineering, Research and Technology, Chandrapur", district: 'Chandrapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("Rajiv Gandhi Chandrapur"), website: '#', courses: ['Comp Engg', 'IT', 'Civil Engg'] },
  { id: '68', name: "Ballarpur Institute of Technology, Chandrapur", district: 'Chandrapur', stream: 'PCM', establishedYear: 1997, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials("Ballarpur Institute"), website: '#', courses: ['Mech Engg', 'ENTC'] },
  { id: '69', name: "Shri Sai College of Engineering and Technology, Chandrapur", district: 'Chandrapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Shri Sai Chandrapur"), website: '#', courses: ['Comp Engg', 'Electrical Engg'] },
  { id: '70', name: "Somayya Institute of Technology, Chandrapur", district: 'Chandrapur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials("Somayya Institute"), website: '#', courses: ['IT', 'Mech Engg'] },
  // Chh. Sambhaji Nagar (Aurangabad) Colleges
  { id: '71', name: "Government College of Engineering, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹25,000', campusSizeAcres: 22, rating: 4.4, logoPlaceholder: getInitials("GCE Aurangabad"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '72', name: "University Department of Chemical Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1994, collegeType: 'University Department', annualFees: '₹40,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials("UDCT Aurangabad"), website: '#', courses: ['Chem Engg', 'Food Tech'] },
  { id: '73', name: "Shree Yash Pratishthan's Shreeyash College of Engineering and Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials("Shreeyash College"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'ENTC'] },
  { id: '74', name: "G. S. Mandal's Maharashtra Institute of Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials("MIT Aurangabad"), website: '#', courses: ['Comp Engg', 'IT', 'Civil Engg'] },
  { id: '75', name: "Deogiri Institute of Engineering and Management Studies, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials("Deogiri Institute"), website: '#', courses: ['Mech Engg', 'Electrical Engg', 'MBA'] },
  { id: '76', name: "Gramodyogik Shikshan Mandal's Marathwada Institute of Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 17, rating: 4.0, logoPlaceholder: getInitials("GSM MIT Aurangabad"), website: '#', courses: ['Comp Engg', 'Civil Engg', 'ENTC'] },
  { id: '77', name: "Mahatma Gandhi Mission's Jawaharlal Nehru Engineering College, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1982, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials("JNEC Aurangabad"), website: '#', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '78', name: "People's Education Society's College of Engineering, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 16, rating: 3.8, logoPlaceholder: getInitials("PES College Aurangabad"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '79', name: "Hi-Tech Institute of Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials("Hi-Tech Institute"), website: '#', courses: ['Comp Engg', 'ENTC'] },
  { id: '80', name: "Shri Sai Samajik Vikas Santha's Shri Sai College of Engineering, Paddari Village, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials("Shri Sai Paddari"), website: '#', courses: ['Mech Engg', 'Electrical Engg'] },
  { id: '81', name: "Aurangabad College of Engineering, Naygaon Savangi, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials("ACE Naygaon"), website: '#', courses: ['Comp Engg', 'IT'] },
  { id: '82', name: "International Centre of Excellence in Engineering and Management, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 13, rating: 3.9, logoPlaceholder: getInitials("ICEEM Aurangabad"), website: '#', courses: ['Comp Engg', 'MBA'] },
  { id: '83', name: "CSMSS Chh. Shahu College of Engineering, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1980, collegeType: 'Private', annualFees: '₹92,000', campusSizeAcres: 19, rating: 4.0, logoPlaceholder: getInitials("CSMSS Shahu College"), website: '#', courses: ['Mech Engg', 'Civil Engg', 'Comp Engg'] },
  // Dhule Colleges
  { id: '84', name: "SVKM's Institute of Technology (SVKM-IOT), Dhule", district: 'Dhule', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials("SVKM IOT"), website: '#', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '85', name: "SSVPS's Bapusaheb Shivajirao Deore College of Engineering, Dhule", district: 'Dhule', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("SSVPS BSD"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '86', name: "Gangamai College of Engineering, Dhule", district: 'Dhule', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials("Gangamai College"), website: '#', courses: ['Comp Engg', 'ENTC'] },
  { id: '87', name: "Sanjay Education Society's College of Engineering, Dhule", district: 'Dhule', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Sanjay Education Society"), website: '#', courses: ['Mech Engg', 'Electrical Engg'] },
  // Gadchiroli Colleges
  { id: '88', name: "Namdeorao Poreddiwar College of Engineering and Technology (NPCET), Gadchiroli", district: 'Gadchiroli', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials("NPCET Gadchiroli"), website: '#', courses: ['Comp Engg', 'Civil Engg'] },
  // Note: "Government College of Engineering, Chandrapur" is already added under Chandrapur district.
  // Hingoli Colleges
  { id: '89', name: "Khurana Sawant Institute of Engineering & Technology (KSIET), Hingoli", district: 'Hingoli', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials("KSIET Hingoli"), website: '#', courses: ['Mech Engg', 'Comp Engg'] },
  { id: '90', name: "Mahatma Gandhi Missions College of Engineering, Hingoli Road, Nanded", district: 'Nanded', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials("MGM Nanded"), website: '#', courses: ['Comp Engg', 'IT', 'Civil Engg'] }, // District is Nanded
  // Jalgaon Colleges
  { id: '91', name: "Godavari College of Engineering, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials("Godavari College Jalgaon"), website: '#', courses: ['Mech Engg', 'Comp Engg'] },
  { id: '92', name: "SSBT's College of Engineering and Technology, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials("SSBT Jalgaon"), website: '#', courses: ['Comp Engg', 'IT', 'Chem Engg'] },
  { id: '93', name: "North Maharashtra University Institute of Chemical Technology (NMU-UICT), Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1994, collegeType: 'University Department', annualFees: '₹50,000', campusSizeAcres: 10, rating: 4.3, logoPlaceholder: getInitials("NMU UICT"), website: '#', courses: ['Chem Engg', 'Pharma Tech'] },
  { id: '94', name: "Government College of Engineering, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1996, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 30, rating: 4.4, logoPlaceholder: getInitials("GCE Jalgaon"), website: '#', courses: ['Mech Engg', 'Electrical Engg', 'Comp Engg'] },
  { id: '95', name: "College of Engineering & Technology, North Maharashtra Knowledge City (COET-NMKC), Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("COET NMKC"), website: '#', courses: ['Comp Engg', 'Civil Engg'] },
  { id: '96', name: "KCE Society's College of Engineering and Management, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("KCE Society Jalgaon"), website: '#', courses: ['IT', 'Mech Engg', 'MBA'] },
  { id: '97', name: "J. T. Mahajan College of Engineering, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials("JT Mahajan"), website: '#', courses: ['Comp Engg', 'Electrical Engg'] },
  { id: '98', name: "Shri Gulabrao Deokar College of Engineering, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 17, rating: 3.9, logoPlaceholder: getInitials("Shri Gulabrao Deokar"), website: '#', courses: ['Mech Engg', 'Civil Engg', 'ENTC'] },
  { id: '99', name: "G.H. Raisoni College of Engineering and Management, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 16, rating: 4.0, logoPlaceholder: getInitials("GH Raisoni Jalgaon"), website: '#', courses: ['Comp Engg', 'IT', 'MBA'] },
  { id: '100', name: "Mahajan Polytechnic, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials("Mahajan Polytechnic"), website: '#', courses: ['Diploma Mech', 'Diploma Electrical'] },
  { id: '101', name: "Shri Gulabrao Deokar Polytechnic, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹45,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials("SGD Polytechnic"), website: '#', courses: ['Diploma Civil', 'Diploma Comp'] },
  { id: '102', name: "Government Polytechnic, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹10,000', campusSizeAcres: 28, rating: 4.2, logoPlaceholder: getInitials("GP Jalgaon"), website: '#', courses: ['Diploma Mech', 'Diploma IT', 'Diploma E&TC'] },
  // Jalna Colleges
  { id: '103', name: "Matsyodari Shikshan Sanstha's College of Engineering and Technology, Jalna", district: 'Jalna', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials("MSS Jalna"), website: '#', courses: ['Comp Engg', 'Mech Engg'] },
  { id: '104', name: "Government Polytechnic, Jalna", district: 'Jalna', stream: 'PCM', establishedYear: 1985, collegeType: 'Government', annualFees: '₹11,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("GP Jalna"), website: '#', courses: ['Diploma Civil', 'Diploma Electrical'] },
  { id: '105', name: "Institute of Chemical Technology - Marathwada Campus, Jalna", district: 'Jalna', stream: 'PCM', establishedYear: 2018, collegeType: 'Deemed', annualFees: '₹75,000', campusSizeAcres: 203, rating: 4.1, logoPlaceholder: getInitials("ICT Jalna"), website: '#', courses: ['Chem Engg', 'Polymer Engg'] },
  // Kolhapur Colleges
  { id: '106', name: "KIT's College of Engineering, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,30,000', campusSizeAcres: 37, rating: 4.5, logoPlaceholder: getInitials("KIT Kolhapur"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'Biotech Engg'] },
  { id: '107', name: "DKTE Society's Textile and Engineering Institute, Ichalkaranji", district: 'Kolhapur', stream: 'PCM', establishedYear: 1982, collegeType: 'Autonomous', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.4, logoPlaceholder: getInitials("DKTE Ichalkaranji"), website: '#', courses: ['Textile Engg', 'Comp Engg', 'Mech Engg'] },
  { id: '108', name: "DY Patil College of Engineering and Technology, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials("DY Patil Kolhapur"), website: '#', courses: ['Comp Engg', 'IT', 'Civil Engg'] },
  { id: '109', name: "Tatyasaheb Kore Institute of Engineering and Technology (TKIET), Warananagar", district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,15,000', campusSizeAcres: 30, rating: 4.3, logoPlaceholder: getInitials("TKIET Warananagar"), website: '#', courses: ['Chem Engg', 'Comp Engg', 'Mech Engg'] },
  { id: '110', name: "Sanjay Ghodawat University, Kolhapur", district: 'Kolhapur', stream: 'Both', establishedYear: 2009, collegeType: 'University', annualFees: '₹1,50,000', campusSizeAcres: 165, rating: 4.1, logoPlaceholder: getInitials("Sanjay Ghodawat University"), website: '#', courses: ['Comp Engg (PCM)', 'Aeronautical Engg (PCM)', 'B.Pharm (PCB)'] },
  { id: '111', name: "Ashokrao Mane Group of Institutions, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Ashokrao Mane Group"), website: '#', courses: ['Mech Engg', 'Comp Engg', 'Civil Engg'] },
  { id: '112', name: "Sharad Institute of Technology College of Engineering, Yadrav", district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 16, rating: 4.0, logoPlaceholder: getInitials("Sharad Institute Yadrav"), website: '#', courses: ['Comp Engg', 'ENTC', 'IT'] },
  { id: '113', name: "Dr. Bapuji Salunkhe Institute of Engineering and Technology, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials("Dr Bapuji Salunkhe"), website: '#', courses: ['Civil Engg', 'Mech Engg', 'Comp Engg'] },
  { id: '114', name: "Bharati Vidyapeeth College of Engineering, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 12, rating: 4.0, logoPlaceholder: getInitials("BVCOE Kolhapur"), website: '#', courses: ['Comp Engg', 'IT', 'Mech Engg'] },
  { id: '115', name: "Sanjeevan Engineering and Technology Institute, Panhala", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 11, rating: 3.7, logoPlaceholder: getInitials("Sanjeevan Panhala"), website: '#', courses: ['Mech Engg', 'Comp Engg', 'Electrical Engg'] },
  { id: '116', name: "Genesis Institute of Technology, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 9, rating: 3.6, logoPlaceholder: getInitials("Genesis Kolhapur"), website: '#', courses: ['Comp Engg', 'ENTC'] },
  { id: '117', name: "Y.D. Mane Institute of Technology, Kagal", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("YD Mane Kagal"), website: '#', courses: ['Mech Engg', 'Civil Engg'] },
  { id: '118', name: "Shree Datta Polytechnic College, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 7, rating: 3.5, logoPlaceholder: getInitials("Shree Datta Poly"), website: '#', courses: ['Diploma Mech', 'Diploma Comp'] },
  { id: '119', name: "Ashokrao Mane Polytechnic, Ambap", district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹42,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials("AMP Ambap"), website: '#', courses: ['Diploma Civil', 'Diploma Electrical'] },
  { id: '120', name: "Ashokrao Mane Polytechnic College, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹43,000', campusSizeAcres: 7, rating: 3.6, logoPlaceholder: getInitials("AMP Kolhapur"), website: '#', courses: ['Diploma IT', 'Diploma Mech'] }, // Assuming this is different from Ambap
  { id: '121', name: "D.K.T.E. Society's Group, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 1982, collegeType: 'Private', annualFees: '₹N/A', campusSizeAcres: 0, rating: 4.0, logoPlaceholder: getInitials("DKTE Group"), website: '#', courses: ['Various Engg'] }, // Generic entry for a group
  { id: '122', name: "Bharati Vidyapeeth University Institute of Management, Kolhapur", district: 'Kolhapur', stream: 'Both', establishedYear: 1994, collegeType: 'Deemed', annualFees: '₹90,000', campusSizeAcres: 5, rating: 3.9, logoPlaceholder: getInitials("BVUIM Kolhapur"), website: '#', courses: ['MBA', 'BBA (PCM/PCB relevant for some specializations)'] },
  { id: '123', name: "D.Y. Patil Technical Campus, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials("DYPTC Kolhapur"), website: '#', courses: ['Comp Engg', 'Mech Engg', 'Civil Engg'] },
  { id: '124', name: "Dr. D.Y. Patil Prat", district: 'Kolhapur', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials("Dr DYP Prat"), website: '#', courses: ['Comp Engg', 'Mech Engg'] }, // Used cut-off name
];


export default function CollegesPage() {
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
    if (!selectedStream) {
      setIsModalOpen(true);
    }
  }, [selectedStream]);

  const handleStreamSelect = (stream: 'PCB' | 'PCM') => {
    setSelectedStream(stream);
    setSelectedDistrict('All Districts'); // Reset district on stream change
    setSearchTerm(''); // Reset search term on stream change
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
        setAiDetailsError(result.error || "Failed to fetch AI-powered details.");
        toast({
          title: "Error Fetching Details",
          description: result.error || "Could not retrieve details for this college.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setAiDetailsError(message);
      toast({
        title: "Error",
        description: `Failed to fetch college details: ${message}`,
        variant: "destructive",
      });
    } finally {
      setIsFetchingAiDetails(false);
    }
  };
  
  const handleDetailsModalOpenChange = (open: boolean) => {
    setIsDetailsModalOpen(open);
    if (!open) {
      setAiCollegeDetails(null);
      setAiDetailsError(null);
      setIsFetchingAiDetails(false);
      setSelectedCollegeForDetails(null);
    }
  };

  const renderStars = (rating: number | undefined) => {
    if (rating === undefined || rating === null) return <span className="text-xs text-muted-foreground">N/A</span>;
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.4 && rating % 1 < 0.9; 
    const almostFullStar = rating % 1 >= 0.9;
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
        <Dialog open={isDetailsModalOpen} onOpenChange={handleDetailsModalOpenChange}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl bg-background/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary">{selectedCollegeForDetails.name}</DialogTitle>
              <DialogDescription>
                {selectedCollegeForDetails.district} | Stream: {selectedCollegeForDetails.stream === 'Both' ? 'PCM & PCB' : selectedCollegeForDetails.stream}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] p-1 pr-3 -mr-2">
              <div className="py-4 space-y-4">
                {isFetchingAiDetails && (
                  <div className="flex flex-col items-center justify-center h-40">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                    <p className="text-muted-foreground">Fetching AI-powered details...</p>
                  </div>
                )}
                {aiDetailsError && !isFetchingAiDetails && (
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <h4 className="font-semibold">Error Fetching Details</h4>
                    </div>
                    <p className="text-sm">{aiDetailsError}</p>
                  </div>
                )}
                {aiCollegeDetails && !isFetchingAiDetails && !aiDetailsError && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-accent">College Overview</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiCollegeDetails.collegeSummary || "No summary available."}</p>
                    </div>
                    
                    {aiCollegeDetails.branches && aiCollegeDetails.branches.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mt-4 mb-3 text-accent">AI-Generated Branch Insights &amp; Typical Cutoffs</h3>
                        <div className="space-y-3">
                          {aiCollegeDetails.branches.map((branch, index) => (
                            <Card key={index} className="shadow-sm border-border/70">
                              <CardHeader className="pb-2 pt-3 px-4">
                                <CardTitle className="text-md font-semibold">{branch.branchName}</CardTitle>
                                {branch.intake && <CardDescription className="text-xs">Intake: {branch.intake}</CardDescription>}
                              </CardHeader>
                              <CardContent className="px-4 pb-3 text-xs space-y-1">
                                {branch.mhtCetCutoff && <p><strong className="text-muted-foreground">MHT-CET:</strong> {branch.mhtCetCutoff}</p>}
                                {branch.jeeMainCutoff && <p><strong className="text-muted-foreground">JEE Main:</strong> {branch.jeeMainCutoff}</p>}
                                {branch.neetCutoff && <p><strong className="text-muted-foreground">NEET:</strong> {branch.neetCutoff}</p>}
                                {!(branch.mhtCetCutoff || branch.jeeMainCutoff || branch.neetCutoff) && <p className="text-muted-foreground italic">No specific cutoff information available from AI.</p>}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!aiCollegeDetails.branches || aiCollegeDetails.branches.length === 0) && (
                        <p className="text-sm text-muted-foreground italic">No specific branch information available from AI.</p>
                    )}
                  </div>
                )}
                 {!aiCollegeDetails && !isFetchingAiDetails && !aiDetailsError && (
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
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => handleDetailsModalOpenChange(false)}>Close</Button>
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
                  <Link href="/landing" passHref legacyBehavior>
                    <Button variant="outline" className="hidden sm:inline-flex" asChild>
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
                          {college.website && college.website !== '#' ? (
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


    