
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Brain, Dna, Filter, Search as SearchIcon, Building, ListFilter, MapPin, School, Home,
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
  { id: '5161', name: 'Dr. Vithalrao Vikhe Patil College of Engineering, Ahmednagar', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Dr. Vithalrao Vikhe Patil College of Engineering Var'), website: '#' },
  { id: '5162', name: 'Amrutvahini Sheti & Shikshan Vikas Sansthas Amrutvahini College of Engineering, Sangamner', district: 'AhilyaNagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 26, rating: 4.3, logoPlaceholder: getInitials('Amrutvahini College of Engineering'), website: '#' },

  // Akola
  { id: '1116', name: "Shri Shivaji Education Societys College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials("Shri Shivaji Education Society's College of Engineering and Technology"), website: '#' },
  { id: 'coet_akola', name: "College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('College of Engineering and Technology Akola'), website: '#' },
  { id: 'bcoer_akola', name: "Bhonsala College of Engineering and Research, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('Bhonsala College of Engineering and Research'), website: '#' },
  { id: '1276', name: "Manav School of Engineering & Technology, Gut No. 1035 Nagpur Surat Highway, NH No. 6 Tal.Vyala, Balapur, Akola, 444302", district: 'Akola', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Manav School of Engineering & Technology'), website: '#' },
  { id: 'vcoe_akola', name: "Vidyabharati College of Engineering, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('Vidyabharati College of Engineering'), website: '#' },
  { id: 'gp_akola', name: "Government Polytechnic, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1958, collegeType: 'Government', annualFees: '₹12,000', campusSizeAcres: 30, rating: 4.2, logoPlaceholder: getInitials('Government Polytechnic Akola'), website: '#' },
  { id: 'jd_akola', name: "J D College of Engineering & Management - Extension Center, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('J D College of Engineering & Management - Extension Center'), website: '#' },
  { id: 'sacet_akola', name: "Shankarlal Agrawal College of Engineering & Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('Shankarlal Agrawal College of Engineering & Technology'), website: '#' },
  { id: 'shvpm_akola', name: "Shri Hanuman Vyayam Prasarak Mandal's College of Engineering and Technology, Akola", district: 'Akola', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 22, rating: 4.0, logoPlaceholder: getInitials("Shri Hanuman Vyayam Prasarak Mandal's College of Engineering and Technology"), website: '#' },

  // Amravati
  { id: '1002', name: 'Government College of Engineering, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 1964, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 114, rating: 4.5, logoPlaceholder: getInitials('Government College of Engineering Amravati'), website: '#' },
  { id: '1105', name: 'Prof. Ram Meghe Institute of Technology & Research, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.3, logoPlaceholder: getInitials('Prof. Ram Meghe Institute of Technology & Research'), website: '#' },
  { id: '1107', name: 'P. R. Pote (Patil) Education & Welfare Trusts Group of Institution(Integrated Campus), Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials('P. R. Pote (Patil) Education & Welfare Trusts Group of Institution'), website: '#' },
  { id: '1114', name: 'Sipna Shikshan Prasarak Mandal College of Engineering & Technology, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 22, rating: 4.2, logoPlaceholder: getInitials('Sipna Shikshan Prasarak Mandal College of Engineering & Technology'), website: '#' },
  { id: 'ghr_amravati', name: 'G. H. Raisoni College of Engineering and Management, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials("G H Raisoni Amravati"), website: '#' },
  { id: '1121', name: 'Shri Hanuman Vyayam Prasarak Mandals College of Engineering & Technology, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials('Shri Hanuman Vyayam Prasarak Mandals College of Engineering & Technology'), website: '#' },
  { id: '1123', name: 'Dr.Rajendra Gode Institute of Technology & Research, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('Dr.Rajendra Gode Institute of Technology & Research'), website: '#' },
  { id: 'prp_amravati', name: 'P. R. Patil College of Engineering & Technology, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('PR Patil Amravati'), website: '#' },
  { id: 'des_amravati', name: 'DESs College of Engineering and Technology, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials("DES College Amravati"), website: '#' },
  { id: 'ibss_amravati', name: 'IBSS College of Engineering, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 7, rating: 3.6, logoPlaceholder: getInitials("IBSS College"), website: '#' },
  { id: '1005', name: 'Sant Gadge Baba Amravati University,Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 1983, collegeType: 'University Department', annualFees: '₹30000', campusSizeAcres: 470, rating: 4.3, logoPlaceholder: getInitials('Sant Gadge Baba Amravati University'), website: '#' },
  { id: '1126', name: 'Shri. Dadasaheb Gawai Charitable Trusts Dr. Smt. Kamaltai Gawai Institute of Engineering & Technology, Darapur, Amravati', district: 'Amravati', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('Kamaltai Gawai Darapur'), website: '#' },
  { id: '1128', name: 'Prof Ram Meghe College of Engineering and Management, Badnera', district: 'Amravati', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('Prof Ram Meghe Badnera'), website: '#' },

  // Beed
  { id: '2136', name: 'Aditya Engineering College , Beed', district: 'Beed', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('Aditya Engineering College Beed'), website: '#' },
  { id: '2137', name: 'Nagnathappa Halge Engineering College, Parli, Beed', district: 'Beed', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials('Nagnathappa Halge Engineering College'), website: '#' },
  { id: '2133', name: 'Mahatma Basaweshwar Education Societys College of Engineering, Ambejogai', district: 'Beed', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Mahatma Basaweshwar Education Societys College of Engineering'), website: '#' },
  { id: 'acaet_beed', name: "Aditya College of Agricultural Engineering and Technology, Beed", district: 'Beed', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Aditya Agricultural Engineering"), website: '#' },
  { id: 'acft_beed', name: "Aditya College of Food Technology, Beed", district: 'Beed', stream: 'Both', establishedYear: 2007, collegeType: 'Private', annualFees: '₹92,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials("Aditya Food Technology"), website: '#' },
  { id: 'acab_beed', name: "Aditya College of Agricultural Biotechnology, Beed", district: 'Beed', stream: 'PCB', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials("Aditya Agri Biotech"), website: '#' },
  { id: '2282', name: 'Aditya Education Trusts Mitthulalji Sarada Polytechnic, Nalwandi Road, Beed', district: 'Beed', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹40000', campusSizeAcres: 5, rating: 3.5, logoPlaceholder: getInitials('Mitthulalji Sarada Poly'), website: '#' },

  // Bhandara
  { id: '4143', name: 'Sanmarg Shikshan Sanstha, Mandukarrao Pandav College of Engineering, Bhandara', district: 'Bhandara', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Mandukarrao Pandav College of Engineering'), website: '#' },
  { id: '4302', name: 'Gondia Education Societys Manoharbhai Patel Institute Of Engineering & Technology, Shahapur, Bhandara', district: 'Bhandara', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials('Manoharbhai Patel Institute Of Engineering & Technology Bhandara'), website: '#' },
  { id: '4679', name: 'Karanjekar College of Engineering & Management, Sakoli', district: 'Bhandara', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('Karanjekar College of Engineering & Management'), website: '#' },

  // Buldhana
  { id: '1101', name: 'Shri Sant Gajanan Maharaj College of Engineering,Shegaon', district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 75, rating: 4.6, logoPlaceholder: getInitials('Shri Sant Gajanan Maharaj College of Engineering'), website: '#' },
  { id: 'sgbau_buldhana', name: "Sant Gadge Baba Amravati University College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'University Department', annualFees: '₹30,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials("SGBAU Buldhana"), website: '#' },
  { id: 'kkw_buldhana', name: "K.K.Wagh Institute of Engineering Education and Research, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 4.1, logoPlaceholder: getInitials("KK Wagh Buldhana"), website: '#' },
  { id: 'pdp_buldhana', name: "Dr. Panjabrao Deshmukh College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials("Dr PDCOE Buldhana"), website: '#' },
  { id: 'vit_buldhana', name: "Vidarbha Institute of Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("VIT Buldhana"), website: '#' },
  { id: 'mit_buldhana', name: "M.I.T. College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials("MIT Buldhana"), website: '#' },
  { id: 'ssiet_buldhana', name: "Shri Shivaji Education Society's Institute of Engineering and Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 16, rating: 3.9, logoPlaceholder: getInitials("SSESIET Buldhana"), website: '#' },
  { id: 'kbp_buldhana', name: "K.B.P. College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹78,000', campusSizeAcres: 13, rating: 3.8, logoPlaceholder: getInitials("KBP Buldhana"), website: '#' },
  { id: 'agp_buldhana', name: "A.G. Patil Institute of Technology, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹72,000', campusSizeAcres: 9, rating: 3.6, logoPlaceholder: getInitials("AG Patil Buldhana"), website: '#' },
  { id: 'bnc_buldhana', name: "Babasaheb Naik College of Engineering, Buldhana", district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("BNCOE Buldhana"), website: '#' },
  { id: '1119', name: 'Paramhansa Ramkrishna Maunibaba Shikshan Santhas , Anuradha Engineering College, Chikhali', district: 'Buldhana', stream: 'PCM', establishedYear: 1993, collegeType: 'Private', annualFees: '₹85000', campusSizeAcres: 20, rating: 3.9, logoPlaceholder: getInitials('Anuradha EC Chikhali'), website: '#' },
  { id: '1125', name: 'Dwarka Bahu Uddeshiya Gramin Vikas Foundation, Rajarshri Shahu College of Engineering, Buldhana', district: 'Buldhana', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹75000', campusSizeAcres: 15, rating: 3.7, logoPlaceholder: getInitials('RSCOE Buldhana'), website: '#' },
  { id: '1130', name: 'Vision Buldhana Educational & Welfare Societys Pankaj Laddhad Institute of Technology & Management Studies, Yelgaon', district: 'Buldhana', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('PLITMS Yelgaon'), website: '#' },
  { id: '1182', name: 'Padmashri Dr. V.B. Kolte College of Engineering, Malkapur, Buldhana', district: 'Buldhana', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials('VB Kolte Malkapur'), website: '#' },
  { id: '1265', name: 'Mauli Group of Institutions, College of Engineering and Technology, Shegaon.', district: 'Buldhana', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹78000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('Mauli Shegaon'), website: '#' },

  // Chandrapur
  { id: '4004', name: 'Government College of Engineering, Chandrapur', district: 'Chandrapur', stream: 'PCM', establishedYear: 1996, collegeType: 'Government', annualFees: '₹22,000', campusSizeAcres: 62, rating: 4.3, logoPlaceholder: getInitials('GCOEC Chandrapur'), website: '#' },
  { id: '4163', name: 'Rajiv Gandhi College of Engineering Research & Technology Chandrapur', district: 'Chandrapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('RCERT Chandrapur'), website: '#' },
  { id: 'chandrapur_somayya', name: 'Somayya Institute of Technology, Chandrapur', district: 'Chandrapur', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('Somayya IT'), website: '#' },
  { id: '4188', name: 'Krushi Jivan Vikas Pratishthan, Ballarpur Institute of Technology, Mouza Bamni', district: 'Chandrapur', stream: 'PCM', establishedYear: 1997, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('BIT Bamni'), website: '#' },
  { id: '4190', name: 'M.D. Yergude Memorial Shikshan Prasarak Mandals Shri Sai College of Engineering & Technology, Badravati', district: 'Chandrapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SSCOET Badravati'), website: '#' },

  // Chh. Sambhaji Nagar (Aurangabad)
  { id: '2008', name: 'Government College of Engineering, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹25,000', campusSizeAcres: 22, rating: 4.4, logoPlaceholder: getInitials('GCOE Chh. Sambhajinagar'), website: '#' },
  { id: '2021', name: 'University Department of Chemical Technology, Aurangabad', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1994, collegeType: 'University Department', annualFees: '₹40,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials('UDCT Chh. Sambhajinagar'), website: '#' },
  { id: '2112', name: 'Shree Yash Pratishthan, Shreeyash College of Engineering and Technology, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('Shreeyash Chh. Sambhajinagar'), website: '#' },
  { id: '2113', name: 'G. S. Mandals Maharashtra Institute of Technology, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials('MIT Chh. Sambhajinagar'), website: '#' },
  { id: '2114', name: 'Deogiri Institute of Engineering and Management Studies, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials('DIEMS Chh. Sambhajinagar'), website: '#' },
  { id: 'gsm_mit_aurangabad', name: "Gramodyogik Shikshan Mandal's Marathwada Institute of Technology, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 17, rating: 4.0, logoPlaceholder: getInitials("GSM MIT Aurangabad"), website: '#' },
  { id: 'jnec_aurangabad', name: "Mahatma Gandhi Mission's Jawaharlal Nehru Engineering College, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1982, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials("JNEC Aurangabad"), website: '#' },
  { id: '2134', name: 'Peoples Education Societys College of Engineering, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 16, rating: 3.8, logoPlaceholder: getInitials('PES Chh. Sambhajinagar'), website: '#' },
  { id: '2135', name: 'Hi-Tech Institute of Technology, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('Hi-Tech Chh. Sambhajinagar'), website: '#' },
  { id: 'sssc_aurangabad', name: "Shri Sai Samajik Vikas Santha's Shri Sai College of Engineering, Paddari Village, Aurangabad", district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials("Shri Sai Paddari"), website: '#' },
  { id: '2250', name: 'Aurangabad College of Engineering, Naygaon Savangi, Aurangabad', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials('ACE Naygaon'), website: '#' },
  { id: '2516', name: 'International Centre Of Excellence In Engineering and Management (ICEEM)', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 13, rating: 3.9, logoPlaceholder: getInitials('ICEEM Chh. Sambhajinagar'), website: '#' },
  { id: '2533', name: 'CSMSS Chh. Shahu College of Engineering, Chhatrapati Sambhajinagar', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1980, collegeType: 'Private', annualFees: '₹92,000', campusSizeAcres: 19, rating: 4.0, logoPlaceholder: getInitials('CSMSS Chh. Sambhajinagar'), website: '#' },
  { id: '1117', name: 'Janata Shikshan Prasarak Mandal', district: 'Chh. Sambhaji Nagar', stream: 'PCM', establishedYear: 1980, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 10, rating: 3.5, logoPlaceholder: getInitials('JSPM Aurangabad'), website: '#' },

  // Dhule
  { id: '5449', name: 'Shri Vile Parle Kelavani Mandals Institute of Technology, Dhule', district: 'Dhule', stream: 'PCM', establishedYear: 2013, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 8, rating: 3.8, logoPlaceholder: getInitials('SVKM IT Dhule'), website: '#' },
  { id: '5103', name: 'Shri Shivaji Vidya Prasarak Sansthas Late Bapusaheb Shivaji Rao Deore College of Engineering,Dhule', district: 'Dhule', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('SSVPS BSDCOE Dhule'), website: '#' },
  { id: '5169', name: 'Nagaon Education Societys Gangamai College of Engineering, Nagaon, Tal Dist Dhule', district: 'Dhule', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials('GCOE Nagaon'), website: '#' },
  { id: 'ses_dhule', name: "Sanjay Education Society's College of Engineering, Dhule", district: 'Dhule', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("Sanjay Education Society"), website: '#' },
  { id: '5172', name: 'R. C. Patel Institute of Technology, Shirpur', district: 'Dhule', stream: 'PCM', establishedYear: 2001, collegeType: 'Autonomous', annualFees: '₹130000', campusSizeAcres: 25, rating: 4.4, logoPlaceholder: getInitials('RCPIT Shirpur'), website: '#' },
  { id: '5365', name: 'Vardhaman Education & Welfare Society,Ahinsa Polytechnic, Post. Dondaicha, Dhule', district: 'Dhule', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹45000', campusSizeAcres: 5, rating: 3.5, logoPlaceholder: getInitials('Ahinsa Poly Dondaicha'), website: '#' },
  { id: '5381', name: 'Shri. Jaykumar Rawal Institute of Technology, Dondaicha.', district: 'Dhule', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SJRIT Dondaicha'), website: '#' },

  // Gadchiroli
  { id: 'npcet_gadchiroli', name: "Namdeorao Poreddiwar College of Engineering and Technology (NPCET), Gadchiroli", district: 'Gadchiroli', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials("NPCET Gadchiroli"), website: '#' },
  { id: 'gcoec_gad_proxy', name: 'Government College of Engineering, Chandrapur (Serving Gadchiroli)', district: 'Gadchiroli', stream: 'PCM', establishedYear: 1996, collegeType: 'Government', annualFees: '₹22,000', campusSizeAcres: 62, rating: 4.3, logoPlaceholder: getInitials('GCE Chandrapur G'), website: '#' },

  // Hingoli
  { id: 'ksiet_hingoli', name: "Khurana Sawant Institute of Engineering & Technology (KSIET), Hingoli", district: 'Hingoli', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹65,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials("KSIET Hingoli"), website: '#' },

  // Jalgaon
  { id: '5171', name: 'Godavari Foundations Godavari College Of Engineering, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials('GFGCOE Jalgaon'), website: '#' },
  { id: '5104', name: 'Shramsadhana Bombay Trust, College of Engineering & Technology, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials('SSBTCOET Jalgaon'), website: '#' },
  { id: '5003', name: 'University Institute of Chemical Technology, North Maharashtra University, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1994, collegeType: 'University Department', annualFees: '₹50,000', campusSizeAcres: 10, rating: 4.3, logoPlaceholder: getInitials('UICT NMU Jalgaon'), website: '#' },
  { id: '5004', name: 'Government College of Engineering, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1996, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 30, rating: 4.4, logoPlaceholder: getInitials('GCOEJ Jalgaon'), website: '#' },
  { id: '5396', name: 'College of Engineering and Technology ,North Maharashtra Knowledge City, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('COETNMKC Jalgaon'), website: '#' },
  { id: '5106', name: 'Khandesh College Education Societys College Of Engineering And Management, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('KCESCOEM Jalgaon'), website: '#' },
  { id: '5168', name: 'T.M.E. Societys J.T.Mahajan College of Engineering, Faizpur', district: 'Jalgaon', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('JTMCOE Faizpur'), website: '#' },
  { id: 'sgdcoe_jalgaon', name: "Shri Gulabrao Deokar College of Engineering, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 17, rating: 3.9, logoPlaceholder: getInitials("Shri Gulabrao Deokar"), website: '#' },
  { id: 'ghr_jalgaon', name: "G.H. Raisoni College of Engineering and Management, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 16, rating: 4.0, logoPlaceholder: getInitials("GH Raisoni Jalgaon"), website: '#' },
  { id: 'mp_jalgaon', name: "Mahajan Polytechnic, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials("Mahajan Polytechnic"), website: '#' },
  { id: 'sgdp_jalgaon', name: "Shri Gulabrao Deokar Polytechnic, Jalgaon", district: 'Jalgaon', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹40000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SGD Poly'), website: '#' },
  { id: 'gp_jalgaon', name: 'Government Polytechnic, Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹10,000', campusSizeAcres: 28, rating: 4.2, logoPlaceholder: getInitials("GP Jalgaon"), website: '#' },
  { id: '5152', name: 'G. H. Raisoni Institute of Business Management,Jalgaon', district: 'Jalgaon', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 5, rating: 3.9, logoPlaceholder: getInitials('GHRIBM Jalgaon'), website: '#' },
  { id: '5170', name: 'Hindi Seva Mandals Shri Sant Gadgebaba College of Engineering & Technology, Bhusawal', district: 'Jalgaon', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('SSGBCOET Bhusawal'), website: '#' },

  // Jalna
  { id: '2138', name: 'Matsyodari Shikshan Sansathas College of Engineering and Technology, Jalna', district: 'Jalna', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('MSSCOET Jalna'), website: '#' },
  { id: 'gp_jalna', name: "Government Polytechnic, Jalna", district: 'Jalna', stream: 'PCM', establishedYear: 1985, collegeType: 'Government', annualFees: '₹11,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("GP Jalna"), website: '#' },
  { id: 'ict_jalna', name: "Institute of Chemical Technology - Marathwada Campus, Jalna", district: 'Jalna', stream: 'PCM', establishedYear: 2018, collegeType: 'Deemed', annualFees: '₹75,000', campusSizeAcres: 203, rating: 4.1, logoPlaceholder: getInitials("ICT Jalna"), website: '#' },

  // Kolhapur
  { id: '6267', name: 'Kolhapur Institute of Technologys College of Engineering(Autonomous), Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,30,000', campusSizeAcres: 37, rating: 4.5, logoPlaceholder: getInitials('KIT Kolhapur'), website: '#' },
  { id: '6222', name: 'Dattajirao Kadam Technical Education Societys Textile & Engineering Institute, Ichalkaranji.', district: 'Kolhapur', stream: 'PCM', establishedYear: 1982, collegeType: 'Autonomous', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.4, logoPlaceholder: getInitials('DKTE Ichalkaranji'), website: '#' },
  { id: '6250', name: 'D.Y. Patil College of Engineering and Technology, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials('DYPCET Kolhapur'), website: '#' },
  { id: '6268', name: 'Tatyasaheb Kore Institute of Engineering and Technology, Warananagar', district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,15,000', campusSizeAcres: 30, rating: 4.3, logoPlaceholder: getInitials('TKIET Warananagar'), website: '#' },
  { id: '6811', name: 'Sanjay Ghodawat Institute', district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'University', annualFees: '₹1,50,000', campusSizeAcres: 165, rating: 4.1, logoPlaceholder: getInitials('SGI Kolhapur'), website: '#' },
  { id: '6217_kol', name: 'Shri. Balasaheb Mane Shikshan Prasarak Mandals, Ashokrao Mane Group of Institutions', district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('Ashokrao Mane Group of Institutions Kolhapur'), website: '#' },
  { id: '6317', name: 'Sharad Institute of Technology College of Engineering, Yadrav(Ichalkaranji)', district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 16, rating: 4.0, logoPlaceholder: getInitials('SITCOE Yadrav'), website: '#' },
  { id: '6468', name: 'Swami Vivekananda Shikshan Sanstha, Dr. Bapuji Salunkhe Institute Of Engineering & Technology,Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹88,000', campusSizeAcres: 14, rating: 3.8, logoPlaceholder: getInitials('DBSIET Kolhapur'), website: '#' },
  { id: '6288', name: 'Bharati Vidyapeeths College of Engineering, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 12, rating: 4.0, logoPlaceholder: getInitials('BVCOEK Kolhapur'), website: '#' },
  { id: '6315', name: 'Holy-Wood Academys Sanjeevan Engineering and Technology Institute, Panhala', district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 11, rating: 3.7, logoPlaceholder: getInitials('SETI Panhala'), website: '#' },
  { id: 'git_kolhapur', name: "Genesis Institute of Technology, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 9, rating: 3.6, logoPlaceholder: getInitials("Genesis Kolhapur"), website: '#' },
  { id: 'ydmit_kagal', name: "Y.D. Mane Institute of Technology, Kagal", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials("YD Mane Kagal"), website: '#' },
  { id: 'sdpc_kolhapur', name: "Shree Datta Polytechnic College, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 7, rating: 3.5, logoPlaceholder: getInitials("Shree Datta Poly"), website: '#' },
  { id: 'amp_ambap', name: "Ashokrao Mane Polytechnic, Ambap", district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹42,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials("AMP Ambap"), website: '#' },
  { id: 'ampc_kolhapur', name: "Ashokrao Mane Polytechnic College, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹43,000', campusSizeAcres: 7, rating: 3.6, logoPlaceholder: getInitials("AMP Kolhapur"), website: '#' },
  { id: 'dkte_group', name: "D.K.T.E. Society's Group, Kolhapur", district: 'Kolhapur', stream: 'PCM', establishedYear: 1982, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials("DKTE Group"), website: '#' },
  { id: 'bvuim_kolhapur', name: "Bharati Vidyapeeth University Institute of Management, Kolhapur", district: 'Kolhapur', stream: 'Both', establishedYear: 1994, collegeType: 'Deemed', annualFees: '₹90,000', campusSizeAcres: 5, rating: 3.9, logoPlaceholder: getInitials("BVUIM Kolhapur"), website: '#' },
  { id: '6780', name: 'D.Y.Patil Education Societys,D.Y.Patil Technical Campus, Faculty of Engineering & Faculty of Management,Talsande,Kolhapur.', district: 'Kolhapur', stream: 'Both', establishedYear: 2011, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('DYPTC Talsande'), website: '#' },
  { id: '6839', name: 'Dr. D Y Patil Pratishthans College of Engineering, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('Dr DYPCOE Kolhapur'), website: '#' },
  { id: '6028', name: 'Department of Technology, Shivaji University, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 2006, collegeType: 'University Department', annualFees: '₹70000', campusSizeAcres: 850, rating: 4.3, logoPlaceholder: getInitials('DOT SUK'), website: '#' },
  { id: '6036', name: 'Government College of Engineering, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 2022, collegeType: 'Government', annualFees: '₹20000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials('GCEK Kolhapur'), website: '#' },
  { id: '6803', name: 'Sant Gajanan Maharaj College of Engineering, Gadhinglaj', district: 'Kolhapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SGMCE Gadhinglaj'), website: '#' },
  { id: '6878', name: 'Dr. A. D. Shinde College Of Engineering, Tal.Gadhinglaj, Kolhapur', district: 'Kolhapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('ADSCOE Gadhinglaj'), website: '#' },
  { id: '6277', name: 'Dr. J. J. Magdum Charitable Trusts Dr. J.J. Magdum College of Engineering, Jaysingpur', district: 'Kolhapur', stream: 'PCM', establishedYear: 1992, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('JJ Magdum Jaysingpur'), website: '#' },

  // Latur
  { id: '2129', name: 'M.S. Bidve Engineering College, Latur', district: 'Latur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 3.9, logoPlaceholder: getInitials('MS Bidve Latur'), website: '#' },
  { id: '2254', name: 'Vilasrao Deshmukh Foundation Group of Institutions, Latur', district: 'Latur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 4.0, logoPlaceholder: getInitials('VDF Latur'), website: '#' },
  { id: '2522', name: 'STMEIs Sandipani Technical Campus-Faculty of Engineering, Latur.', district: 'Latur', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('Sandipani Latur'), website: '#' },

  // Mumbai City
  { id: '3012', name: 'Veermata Jijabai Technological Institute(VJTI), Matunga, Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 1887, collegeType: 'Autonomous', annualFees: '₹85,000', campusSizeAcres: 16, rating: 4.7, logoPlaceholder: getInitials('Veermata Jijabai Technological Institute'), website: 'https://vjti.ac.in' },
  { id: 'ict_mumbai_city', name: 'Institute of Chemical Technology (ICT)', district: 'Mumbai City', stream: 'PCM', establishedYear: 1933, collegeType: 'Deemed', annualFees: '₹86,000', campusSizeAcres: 16, rating: 4.6, logoPlaceholder: getInitials('Institute of Chemical Technology'), website: 'https://www.ictmumbai.edu.in' },
  { id: '3035', name: 'Usha Mittal Institute of Technology SNDT Womens University, Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 1997, collegeType: 'University Department', annualFees: '₹70,000', campusSizeAcres: 5, rating: 4.0, logoPlaceholder: getInitials('Usha Mittal Institute'), website: '#' },
  { id: '3139', name: 'Vidyalankar Institute of Technology,Wadala, Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 11, rating: 4.2, logoPlaceholder: getInitials('Vidyalankar Institute'), website: '#' },
  { id: '3183', name: 'Anjuman-I-Islams M.H. Saboo Siddik College of Engineering, Byculla, Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 2, rating: 3.9, logoPlaceholder: getInitials('M.H. Saboo Siddik'), website: '#' },
  { id: '3188', name: 'Vasantdada Patil Pratishthans College Of Engineering and Visual Arts, Sion, Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 4, rating: 4.0, logoPlaceholder: getInitials('Vasantdada Patil Pratishthans'), website: '#' },
  { id: '3209', name: 'K J Somaiya Institute of Technology', district: 'Mumbai City', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,80,000', campusSizeAcres: 2, rating: 4.3, logoPlaceholder: getInitials('K J Somaiya Institute'), website: '#' },
  { id: '3214', name: 'Xavier Institute Of Engineering C/O Xavier Technical Institute,Mahim,Mumbai', district: 'Mumbai City', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹1,70,000', campusSizeAcres: 3, rating: 4.1, logoPlaceholder: getInitials('Xavier Institute'), website: '#' },

  // Mumbai Suburban
  { id: '3014', name: 'Sardar Patel College of Engineering, Andheri', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1962, collegeType: 'Autonomous', annualFees: '₹90,000', campusSizeAcres: 40, rating: 4.6, logoPlaceholder: getInitials('Sardar Patel College of Engineering'), website: '#' },
  { id: '3215', name: 'Bhartiya Vidya Bhavans Sardar Patel Institute of Technology , Andheri, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1995, collegeType: 'Private', annualFees: '₹1,70,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: getInitials('Sardar Patel Institute of Technology'), website: 'https://www.spit.ac.in' },
  { id: '3199', name: 'Shri Vile Parle Kelvani Mandals Dwarkadas J. Sanghvi College of Engineering, Vile Parle,Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,90,000', campusSizeAcres: 5, rating: 4.4, logoPlaceholder: getInitials('Dwarkadas J. Sanghvi College of Engineering'), website: 'https://www.djsce.ac.in' },
  { id: '3135', name: 'Manjara Charitable Trusts Rajiv Gandhi Institute of Technology, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1992, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 5, rating: 4.1, logoPlaceholder: getInitials('Rajiv Gandhi Institute of Technology'), website: '#' },
  { id: '3148', name: 'Mahavir Education Trusts Shah & Anchor Kutchhi Engineering College, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1985, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 4, rating: 4.0, logoPlaceholder: getInitials('Shah & Anchor Kutchhi'), website: '#' },
  { id: '3176', name: 'Thakur College of Engineering and Technology, Kandivali, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,80,000', campusSizeAcres: 10, rating: 4.3, logoPlaceholder: getInitials('Thakur College'), website: '#' },
  { id: '3182', name: 'Thadomal Shahani Engineering College, Bandra, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 3, rating: 4.3, logoPlaceholder: getInitials('Thadomal Shahani Engineering'), website: '#' },
  { id: '3184', name: 'Fr. Conceicao Rodrigues College of Engineering, Bandra,Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,70,000', campusSizeAcres: 5, rating: 4.2, logoPlaceholder: getInitials('Fr. Conceicao Rodrigues'), website: '#' },
  { id: '3185', name: 'Vivekanand Education Societys Institute of Technology, Chembur, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,65,000', campusSizeAcres: 7, rating: 4.1, logoPlaceholder: getInitials('Vivekanand Education Society'), website: '#' },
  { id: '3201', name: 'Rizvi Education Societys Rizvi College of Engineering, Bandra,Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹1,55,000', campusSizeAcres: 3, rating: 3.9, logoPlaceholder: getInitials('Rizvi College of Engineering'), website: '#' },
  { id: '3203', name: 'Atharva College of Engineering,Malad(West),Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 6, rating: 4.0, logoPlaceholder: getInitials('Atharva College'), website: '#' },
  { id: '3204', name: 'St. Francis Institute of Technology,Borivali, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,75,000', campusSizeAcres: 5, rating: 4.1, logoPlaceholder: getInitials('St. Francis Institute'), website: '#' },
  { id: '3208', name: 'Don Bosco Institute of Technology, Mumbai', district: 'Mumbai Suburban', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,65,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('Don Bosco Institute'), website: '#' },

  // Nagpur
  { id: '4005', name: 'Laxminarayan Institute of Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1942, collegeType: 'University Department', annualFees: '₹30,000', campusSizeAcres: 78, rating: 4.5, logoPlaceholder: getInitials('LIT Nagpur'), website: '#' },
  { id: '4025', name: 'Government College of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2016, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials('GCOEN Nagpur'), website: '#' },
  { id: '4104', name: 'Kavi Kulguru Institute of Technology & Science, Ramtek', district: 'Nagpur', stream: 'PCM', establishedYear: 1985, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 45, rating: 4.1, logoPlaceholder: getInitials('KKITS Ramtek'), website: '#' },
  { id: '4115', name: 'Shri Ramdeobaba College of Engineering and Management, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1984, collegeType: 'Autonomous', annualFees: '₹1,50,000', campusSizeAcres: 20, rating: 4.7, logoPlaceholder: getInitials('RCOEM Nagpur'), website: '#' },
  { id: '4116', name: 'Ankush Shikshan Sansthas G.H.Raisoni College of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1996, collegeType: 'Autonomous', annualFees: '₹1,40,000', campusSizeAcres: 25, rating: 4.6, logoPlaceholder: getInitials('GHRCE Nagpur'), website: '#' },
  { id: '4123', name: 'Lokmanya Tilak Jankalyan Shikshan Sanstha, Priyadarshani College of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('PCE Nagpur'), website: '#' },
  { id: '4137', name: 'Sir Shantilal Badjate Charitable Trusts S. B. Jain Institute of technology, Management & Research, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 15, rating: 4.2, logoPlaceholder: getInitials('SB Jain Nagpur'), website: '#' },
  { id: '4147', name: 'K.D.K. College of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('KDK Nagpur'), website: '#' },
  { id: '4167', name: 'Yeshwantrao Chavan College of Engineering,Wanadongri, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1984, collegeType: 'Autonomous', annualFees: '₹1,45,000', campusSizeAcres: 20, rating: 4.5, logoPlaceholder: getInitials('YCCE Nagpur'), website: '#' },
  { id: '4174', name: 'ST. Vincent Pallotti College of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2004, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 10, rating: 4.1, logoPlaceholder: getInitials('St Vincent Pallotti Nagpur'), website: '#' },
  { id: '4304', name: 'Cummins College of Engineering For Women, Sukhali (Gupchup), Tal. Hingna Hingna Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 4.3, logoPlaceholder: getInitials('Cummins Nagpur'), website: '#' },
  { id: '4133', name: 'Sanmarg Shikshan Sansthas Smt. Radhikatai Pandav College of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹95000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('SRPCE Nagpur'), website: '#' },
  { id: '4134', name: 'Guru Nanak Institute of Engineering & Technology,Kalmeshwar, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 12, rating: 3.8, logoPlaceholder: getInitials('GNIET Nagpur'), website: '#' },
  { id: '4135', name: 'Amar Seva Mandals Shree Govindrao Vanjari College of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1997, collegeType: 'Private', annualFees: '₹105000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('ASMSGVCOET Nagpur'), website: '#' },
  { id: '4136', name: 'Lokmanya Tilak Jankalyan Shikshan Sastha, Priyadarshini J. L. College Of Engineering, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('PJLCE Nagpur'), website: '#' },
  { id: '4138', name: 'Jaidev Education Society, J D College of Engineering and Management, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹110000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('JDCOEM Nagpur'), website: '#' },
  { id: '4139', name: 'Samridhi Sarwajanik Charitable Trust, Jhulelal Institute of Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('JIT Nagpur'), website: '#' },
  { id: '4141', name: 'Shriram Gram Vikas Shikshan Sanstha, Vilasrao Deshmukh College of Engineering and Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('VDCOET Nagpur'), website: '#' },
  { id: '4142', name: 'Ankush Shikshan Sansthas G. H. Raisoni Institute of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹130000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('GHRIET Nagpur'), website: '#' },
  { id: '4144', name: 'Shri. Sai Shikshan Sanstha, Nagpur Institute of Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹115000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('NIT Nagpur'), website: '#' },
  { id: '4145', name: 'Wainganga College of Engineering and Management, Dongargaon, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('WCEM Nagpur'), website: '#' },
  { id: '4151', name: 'Vidarbha Bahu-Uddeshiya Shikshan Sansthas Tulshiramji Gaikwad Patil College of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹110000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('TGPCOET Nagpur'), website: '#' },
  { id: '4172', name: 'Anjuman College of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('ACET Nagpur'), website: '#' },
  { id: '4177', name: 'Priyadarshini Bhagwati College of Engineering, Harpur Nagar, Umred Road,Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('PBCOE Nagpur'), website: '#' },
  { id: '4181', name: 'Swaminarayan Siddhanta Institute Of Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SSIT Nagpur'), website: '#' },
  { id: '4192', name: 'Maitraya Education Society, Nagarjuna Institute of Engineering Technology & Management, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('NIETM Nagpur'), website: '#' },
  { id: '4193', name: 'K.D.M. Education Society, Vidharbha Institute of Technology,Umred Road ,Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('VIT Nagpur (KDM)'), website: '#' },
  { id: '4196', name: 'Gurunanak Educational Societys Gurunanak Institute of Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹105000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('GIT Nagpur'), website: '#' },
  { id: '4285', name: 'V M Institute of Engineering and Technology, Dongargaon, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('VMIET Nagpur'), website: '#' },
  { id: '4613', name: 'Suryodaya College of Engineering & Technology, Nagpur', district: 'Nagpur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹95000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('SCET Nagpur'), website: '#' },

  // Nanded
  { id: '2020', name: 'Shri Guru Gobind Singhji Institute of Engineering and Technology, Nanded', district: 'Nanded', stream: 'PCM', establishedYear: 1981, collegeType: 'Autonomous', annualFees: '₹90,000', campusSizeAcres: 46, rating: 4.5, logoPlaceholder: getInitials('SGGSIE&T Nanded'), website: '#' },
  { id: '2116', name: 'Matoshri Pratishans Group of Institutions (Integrated Campus), Kupsarwadi , Nanded', district: 'Nanded', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('Matoshri Nanded'), website: '#' },
  { id: '2127', name: 'Mahatma Gandhi Missions College of Engineering, Hingoli Rd, Nanded.', district: 'Nanded', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('MGM Nanded'), website: '#' },
  { id: '2508', name: 'GRAMIN TECHNICAL AND MANAGEMENT CAMPUS NANDED.', district: 'Nanded', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('GTMC Nanded'), website: '#' },

  // Nandurbar
  { id: '5164', name: 'P.S.G.V.P. Mandals D.N. Patel College of Engineering, Shahada, Dist. Nandurbar', district: 'Nandurbar', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 20, rating: 3.8, logoPlaceholder: getInitials('DN Patel Shahada'), website: '#' },
  { id: '5322', name: 'Jamia Institute Of Engineering And Management Studies, Akkalkuwa', district: 'Nandurbar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('JIEMS Akkalkuwa'), website: '#' },
  { id: '5497', name: 'P.G. College of Engineering & Technology, Nandurbar', district: 'Nandurbar', stream: 'PCM', establishedYear: 2015, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('PGCOET Nandurbar'), website: '#' },

  // Nashik
  { id: '5108', name: 'Maratha Vidya Prasarak Samajs Karmaveer Adv. Baburao Ganpatrao Thakare College Of Engineering, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 25, rating: 4.2, logoPlaceholder: getInitials('MVP KBTCOE'), website: '#' },
  { id: '5109', name: 'Sandip Foundation, Sandip Institute of Technology and Research Centre, Mahiravani, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 250, rating: 4.1, logoPlaceholder: getInitials('SITRC Nashik'), website: '#' },
  { id: '5121', name: 'K. K. Wagh Institute of Engineering Education and Research, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 23, rating: 4.5, logoPlaceholder: getInitials('KKWIEER Nashik'), website: '#' },
  { id: '5125', name: 'Pravara Rural Education Societys Sir Visvesvaraya Institute of Technology, Chincholi Dist. Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('SVIT Chincholi'), website: '#' },
  { id: '5130', name: 'Brahma Valley College of Engineering & Research, Trimbakeshwar, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 20, rating: 3.8, logoPlaceholder: getInitials('BVCOER Nashik'), website: '#' },
  { id: '5151', name: 'MET Bhujbal Knowledge City MET Leagues Engineering College, Adgaon, Nashik.', district: 'Nashik', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 34, rating: 4.0, logoPlaceholder: getInitials('MET BKC Nashik'), website: '#' },
  { id: '5173', name: 'SNJBs Late Sau. Kantabai Bhavarlalji Jain College of Engineering, (Jain Gurukul), Neminagar,Chandwad,(Nashik)', district: 'Nashik', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('SNJB Chandwad'), website: '#' },
  { id: '5177', name: 'Matoshri College of Engineering and Research Centre, Eklahare, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 10, rating: 4.1, logoPlaceholder: getInitials('MCOERC Nashik'), website: '#' },
  { id: '5181', name: 'Gokhale Education Societys, R.H. Sapat College of Engineering, Management Studies and Research, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('RHSCOEMSR Nashik'), website: '#' },
  { id: '5182', name: 'Kalyani Charitable Trust, Late Gambhirrao Natuba Sapkal College of Engineering, Anjaneri, Trimbakeshwar Road, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('LGNSCOE Nashik'), website: '#' },
  { id: '5184', name: 'Amruta Vaishnavi Education & Welfare Trusts Shatabdi Institute of Engineering & Research, Agaskhind Tal. Sinnar', district: 'Nashik', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SIER Sinnar'), website: '#' },
  { id: '5244', name: 'METs Institute of Technology Polytechnic, Bhujbal Knowledge City, Adgaon Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹50,000', campusSizeAcres: 34, rating: 3.8, logoPlaceholder: getInitials('MET Poly Nashik'), website: '#' },
  { id: '5330', name: 'PUNE VIDYARTHI GRIHA’S COLLEGE OF ENGINEERING & SHRIKRUSHNA S. DHAMANKAR INSTITUTE OF MANAGEMENT, NASHIK', district: 'Nashik', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('PVGCOE Nashik'), website: '#' },
  { id: '5331', name: 'Sandip Foundations, Sandip Institute of Engineering & Management, Nashik', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,25,000', campusSizeAcres: 250, rating: 4.0, logoPlaceholder: getInitials('SIEM Nashik'), website: '#' },
  { id: '5390', name: 'K.V.N. Naik S. P. Sansths Loknete Gopinathji Munde Institute of Engineering Education & Research, Nashik.', district: 'Nashik', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('LGMIEER Nashik'), website: '#' },
  { id: '5399', name: 'Sanghavi College of Engineering, Varvandi, Nashik.', district: 'Nashik', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('Sanghavi COE Nashik'), website: '#' },
  { id: '5401', name: 'Jawahar Education Societys Institute of Technology, Management & Research, Nashik.', district: 'Nashik', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials('JITMR Nashik'), website: '#' },
  { id: '5411', name: 'Maulana Mukhtar Ahmad Nadvi Technical Campus, Malegaon.', district: 'Nashik', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.6, logoPlaceholder: getInitials('MMANTC Malegaon'), website: '#' },
  { id: '5418', name: 'Guru Gobind Singh College of Engineering & Research Centre, Nashik.', district: 'Nashik', stream: 'PCM', establishedYear: 2013, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('GGSCOERC Nashik'), website: '#' },
  { id: '2111', name: 'Everest Education Society, Group of Institutions (Integrated Campus), Ohar', district: 'Nashik', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('Everest Ohar'), website: '#' },
  { id: '5124', name: 'Jagadamba Education Soc. Nashiks S.N.D. College of Engineering & Reserch, Babulgaon', district: 'Yavatmal', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('SND Babulgaon'), website: '#' },

  // Osmanabad (Dharashiv)
  { id: '2130', name: 'Terna Public Charitable Trusts College of Engineering, Dharashiv', district: 'Osmanabad', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.0, logoPlaceholder: getInitials('Terna Dharashiv'), website: '#' },
  { id: '2131', name: 'Shree Tuljabhavani College of Engineering, Tuljapur', district: 'Osmanabad', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 20, rating: 3.8, logoPlaceholder: getInitials('STBC Tuljapur'), website: '#' },
  { id: '2146', name: 'Adarsh Shikshan Prasarak Mandals K. T. Patil College of Engineering and Technology, Dharashiv', district: 'Osmanabad', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 15, rating: 3.7, logoPlaceholder: getInitials('KT Patil Dharashiv'), website: '#' },
  { id: '1268', name: 'Siddhivinayak Technical Campus, School of Engineering & Research Technology, Shirasgon, Nile', district: 'Osmanabad', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹75000', campusSizeAcres: 12, rating: 3.6, logoPlaceholder: getInitials('Siddhivinayak Shirasgon'), website: '#' },
  { id: '2641', name: 'Dr. V.K. Patil College of Engineering & Technology', district: 'Osmanabad', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹70000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('VK Patil Osmanabad'), website: '#' },

  // Palghar
  { id: '3194', name: 'Vidyavardhinis College of Engineering and Technology, Vasai', district: 'Palghar', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,25,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('VCET Vasai'), website: '#' },
  { id: '3218', name: 'Aldel Education Trusts St. John College of Engineering & Management, Vevoor, Palghar', district: 'Palghar', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('St John Palghar'), website: '#' },
  { id: '3221', name: 'Late Shri. Vishnu Waman Thakur Charitable Trust, Viva Institute of Technology, Shirgaon', district: 'Palghar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('Viva Shirgaon'), website: '#' },
  { id: '3222', name: 'Haji Jamaluddin Thim Trusts Theem College of Engineering, At. Villege Betegaon, Boisar', district: 'Palghar', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('Theem Boisar'), website: '#' },
  { id: '3460', name: 'Universal College of Engineering,Kaman Dist. Palghar', district: 'Palghar', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('UCOE Palghar'), website: '#' },
  { id: '3465', name: 'Ideal Institute of Technology, Wada, Dist.Thane', district: 'Palghar', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹80000', campusSizeAcres: 8, rating: 3.4, logoPlaceholder: getInitials('Ideal Wada'), website: '#' },

  // Parbhani
  { id: '2252', name: 'Marathwada Shikshan Prasarak Mandals Shri Shivaji Institute of Engineering and Management Studies, Parbhani', district: 'Parbhani', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.7, logoPlaceholder: getInitials('SSIEMS Parbhani'), website: '#' },

  // Pune
  { id: '6006', name: 'COEP Technological University', district: 'Pune', stream: 'PCM', establishedYear: 1854, collegeType: 'University Department', annualFees: '₹90,000', campusSizeAcres: 36, rating: 4.8, logoPlaceholder: getInitials('COEP Technological University'), website: 'https://www.coep.org.in' },
  { id: '6273', name: 'Bansilal Ramnath Agarawal Charitable Trusts Vishwakarma Institute of Technology, Bibwewadi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,80,000', campusSizeAcres: 7, rating: 4.3, logoPlaceholder: getInitials('Vishwakarma Institute of Technology'), website: 'https://www.vit.edu' },
  { id: '6271', name: 'Pune Institute of Computer Technology, Dhankavdi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 5, rating: 4.5, logoPlaceholder: getInitials('Pune Institute of Computer Technology'), website: 'https://pict.edu' },
  { id: 'bjmc_pune', name: 'Byramjee Jeejeebhoy Government Medical College (BJMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1946, collegeType: 'Government', annualFees: '₹95,000', campusSizeAcres: 100, rating: 4.6, logoPlaceholder: getInitials('Byramjee Jeejeebhoy'), website: 'https://www.bjmcpune.org' },
  { id: 'afmc_pune', name: 'Armed Forces Medical College (AFMC), Pune', district: 'Pune', stream: 'PCB', establishedYear: 1948, collegeType: 'Government', annualFees: 'Varies', campusSizeAcres: 119, rating: 4.9, logoPlaceholder: getInitials('Armed Forces Medical College'), website: 'https://afmc.nic.in' },
  { id: 'mitwpu_pune', name: 'MIT World Peace University (MIT-WPU) - Faculty of Engineering, Pune', district: 'Pune', stream: 'Both', establishedYear: 1983, collegeType: 'Private', annualFees: '₹3,50,000', campusSizeAcres: 65, rating: 4.2, logoPlaceholder: getInitials('MIT World Peace University'), website: 'https://mitwpu.edu.in' },
  { id: 'bvcoe_pune_deemed', name: 'Bharati Vidyapeeth Deemed University College of Engineering, Pune', district: 'Pune', stream: 'Both', establishedYear: 1983, collegeType: 'Deemed', annualFees: '₹1,60,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('Bharati Vidyapeeth College of Engineering'), website: '#' },
  { id: '6004', name: 'Government College of Engineering & Research, Avasari Khurd', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Government', annualFees: '₹25,000', campusSizeAcres: 50, rating: 4.2, logoPlaceholder: getInitials('GCER Avasari'), website: '#' },
  { id: '6122', name: 'TSSMSs Pd. Vasantdada Patil Institute of Technology, Bavdhan, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 5, rating: 4.0, logoPlaceholder: getInitials('Vasantdada Patil Institute'), website: '#' },
  { id: '6138', name: 'Genba Sopanrao Moze Trust Parvatibai Genba Moze College of Engineering,Wagholi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('Parvatibai Genba Moze'), website: '#' },
  { id: '6139', name: 'Progressive Education Societys Modern College of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 12, rating: 4.1, logoPlaceholder: getInitials('Modern College of Engineering'), website: '#' },
  { id: '6141', name: 'Jaywant Shikshan Prasarak Mandals,Rajarshi Shahu College of Engineering, Tathawade, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('Rajarshi Shahu College'), website: '#' },
  { id: '6144', name: 'Genba Sopanrao Moze College of Engineering, Baner-Balewadi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 8, rating: 3.8, logoPlaceholder: getInitials('Genba Sopanrao Moze Baner'), website: '#' },
  { id: '6146', name: 'MIT Academy of Engineering,Alandi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Autonomous', annualFees: '₹1,90,000', campusSizeAcres: 13, rating: 4.4, logoPlaceholder: getInitials('MIT Academy of Engineering'), website: '#' },
  { id: '6175', name: 'Pimpri Chinchwad Education Trust, Pimpri Chinchwad College of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Autonomous', annualFees: '₹1,50,000', campusSizeAcres: 25, rating: 4.5, logoPlaceholder: getInitials('PCCOE Pune'), website: '#' },
  { id: '6276', name: 'MKSSSs Cummins College of Engineering for Women, Karvenagar,Pune', district: 'Pune', stream: 'PCM', establishedYear: 1991, collegeType: 'Autonomous', annualFees: '₹1,70,000', campusSizeAcres: 4, rating: 4.4, logoPlaceholder: getInitials('Cummins College'), website: '#' },
  { id: '6145', name: 'JSPMS Jaywantrao Sawant College of Engineering,Pune', district: 'Pune', stream: 'PCM', establishedYear: 1995, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('JSCOE Pune'), website: '#' },
  { id: '6149', name: 'Siddhant College of Engineering, A/p Sudumbare, Tal.Maval, Dist-Pune', district: 'Pune', stream: 'PCM', establishedYear: 2004, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 11, rating: 3.7, logoPlaceholder: getInitials('Siddhant COE'), website: '#' },
  { id: '6155', name: 'G.H.Raisoni College of Engineering & Management, Wagholi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('GHRMEM Wagholi'), website: '#' },
  { id: '6156', name: 'Marathwada Mitra Mandals College of Engineering, Karvenagar, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1967, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials('MMCOE Pune'), website: '#' },
  { id: '6177', name: 'Sinhgad College of Engineering, Vadgaon (BK), Pune', district: 'Pune', stream: 'PCM', establishedYear: 1996, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 30, rating: 4.1, logoPlaceholder: getInitials('SCOE Vadgaon'), website: '#' },
  { id: '6178', name: 'Sinhgad Technical Education Societys Smt. Kashibai Navale College of Engineering,Vadgaon,Pune', district: 'Pune', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,45,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('SKNCOE Vadgaon'), website: '#' },
  { id: '6179', name: 'Indira College of Engineering & Management, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 8, rating: 4.0, logoPlaceholder: getInitials('ICEM Pune'), website: '#' },
  { id: '6182', name: 'Sinhgad Technical Education Society, Sinhgad Institute of Technology and Science, Narhe (Ambegaon)', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('SITS Narhe'), website: '#' },
  { id: '6183', name: 'Al-Ameen Educational and Medical Foundation, College of Engineering, Koregaon, Bhima', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('Al-Ameen COE'), website: '#' },
  { id: '6184', name: 'K. J.s Educational Institut Trinity College of Engineering and Research, Pisoli, Haveli', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('KJEI TCOER'), website: '#' },
  { id: '6185', name: 'Sinhagad Institute of Technology, Lonavala', district: 'Pune', stream: 'PCM', establishedYear: 2004, collegeType: 'Private', annualFees: '₹1,35,000', campusSizeAcres: 20, rating: 3.9, logoPlaceholder: getInitials('SIT Lonavala'), website: '#' },
  { id: '6187', name: 'Sinhgad Academy of Engineering, Kondhwa (BK) Kondhwa-Saswad Road, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('SAE Kondhwa'), website: '#' },
  { id: '6203', name: 'Marathwada Mitra Mandals Institute of Technology, Lohgaon, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 8, rating: 3.9, logoPlaceholder: getInitials('MMIT Lohgaon'), website: '#' },
  { id: '6206', name: 'Pune District Education Associations College of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('PDEA COE'), website: '#' },
  { id: '6207', name: 'Dr. D. Y. Patil Unitech Societys Dr. D. Y. Patil Institute of Technology, Pimpri, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials('DYPUS DIT Pimpri'), website: '#' },
  { id: '6272', name: 'Dr. D. Y. Patil Pratishthans D.Y.Patil College of Engineering Akurdi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials('DYPCOE Akurdi'), website: '#' },
  { id: '6274', name: 'Pune Vidyarthi Grihas College of Engineering and Technology and G K Pate(Wani) Institute of Management, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1985, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('PVGCOET Pune'), website: '#' },
  { id: '6275', name: 'Shivnagar Vidya Prasarak Mandals College of Engineering, Malegaon-Baramati', district: 'Pune', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 25, rating: 4.0, logoPlaceholder: getInitials('SVPM COE Baramati'), website: '#' },
  { id: '6278', name: 'All India Shri Shivaji Memorial Societys College of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1992, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 12, rating: 4.1, logoPlaceholder: getInitials('AISSMS COE'), website: '#' },
  { id: '6281', name: 'Modern Education Societys College of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,35,000', campusSizeAcres: 8, rating: 4.0, logoPlaceholder: getInitials('MES COE Pune'), website: '#' },
  { id: '6282', name: 'All India Shri Shivaji Memorial Societys Institute of Information Technology,Pune', district: 'Pune', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 5, rating: 4.0, logoPlaceholder: getInitials('AISSMS IOIT'), website: '#' },
  { id: '6284', name: 'Vidya Pratishthans Kamalnayan Bajaj Institute of Engineering & Technology, Baramati Dist.Pune', district: 'Pune', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials('VPKBIET Baramati'), website: '#' },
  { id: '6285', name: 'Bharati Vidyapeeths College of Engineering for Women, Katraj, Dhankawadi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2000, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 5, rating: 3.9, logoPlaceholder: getInitials('BVCOEW Pune'), website: '#' },
  { id: '6289', name: 'B.R.A.C.Ts Vishwakarma Institute of Information Technology, Kondhwa (Bk.), Pune', district: 'Pune', stream: 'PCM', establishedYear: 2002, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 10, rating: 4.2, logoPlaceholder: getInitials('VIIT Pune'), website: '#' },
  { id: '6298', name: 'Zeal Education Societys Zeal College of Engineering & Reserch, Narhe, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('ZCOER Pune'), website: '#' },
  { id: '6307', name: 'Dhole Patil Education Society, Dhole Patil College of Engineering, Wagholi, Tal. Haveli', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('DPCOE Wagholi'), website: '#' },
  { id: '6310', name: 'Nutan Maharashtra Vidya Prasarak Mandal, Nutan Maharashtra Institute of Engineering &Technology, Talegaon station, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('NMIET Talegaon'), website: '#' },
  { id: '6311', name: 'Jayawant Shikshan Prasarak Mandal, Bhivarabai Sawant Institute of Technology & Research, Wagholi', district: 'Pune', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,15,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('BSITR Wagholi'), website: '#' },
  { id: '6318', name: 'Abhinav Education Societys College of Engineering and Technology (Degree), Wadwadi', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('AESCOET Wadwadi'), website: '#' },
  { id: '6319', name: 'Shahajirao Patil Vikas Pratishthan, S.B.Patil College of Engineering, Vangali, Tal. Indapur', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SBPCOE Indapur'), website: '#' },
  { id: '6320', name: 'K.J.s Educational Institutes K.J.College of Engineering & Management Research, Pisoli', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('KJCOEMR Pisoli'), website: '#' },
  { id: '6322', name: 'Shree Gajanan Maharaj Shikshan Prasarak Mandal Sharadchandra Pawar College of Engineering, Dumbarwadi', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SGMSPM SPCOE'), website: '#' },
  { id: '6324', name: 'Rajgad Dnyanpeeths Technical Campus,Dhangwadi, Bhor', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.6, logoPlaceholder: getInitials('RDTC Bhor'), website: '#' },
  { id: '6325', name: 'Alard Charitable Trusts Alard College of Engineering and Management, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('ACEM Pune'), website: '#' },
  { id: '6419', name: 'Nutan College of Engineering and Research, Talegaon Dabhade Tal. Maval, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('NCER Talegaon'), website: '#' },
  { id: '6609', name: 'Jaihind College Of Engineering,Kuran', district: 'Pune', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.5, logoPlaceholder: getInitials('JCOE Kuran'), website: '#' },
  { id: '6622_pune', name: 'ISBM College Of Engineering Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials('ISBM COE'), website: '#' },
  { id: '6625', name: 'Universal College of Engineering & Research, Sasewadi', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('UCOER Sasewadi'), website: '#' },
  { id: '6628', name: 'Dattakala Group Of Institutions, Swami - Chincholi Tal. Daund Dist. Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.6, logoPlaceholder: getInitials('DKGOI Daund'), website: '#' },
  { id: '6632', name: 'Navsahyadri Education Societys Group of Institutions', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('NESGOI Pune'), website: '#' },
  { id: '6634', name: 'KJEIs Trinity Academy of Engineering, Yewalewadi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('KJEI TAE'), website: '#' },
  { id: '6635', name: 'Samarth Group of Institutions, Bangarwadi, Post Belhe Tal. Junnar Dist. Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.5, logoPlaceholder: getInitials('SGOI Junnar'), website: '#' },
  { id: '6649', name: 'TSSMs Bhivarabai Sawant College of Engineering and Research, Narhe, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('BSCOER Narhe'), website: '#' },
  { id: '6732', name: 'Ajeenkya DY Patil School of Engineering, Lohegaon, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2015, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('ADYPSOE Lohegaon'), website: '#' },
  { id: '6754', name: 'International Institute of Information Technology (I²IT), Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2003, collegeType: 'Private', annualFees: '₹1,80,000', campusSizeAcres: 10, rating: 4.3, logoPlaceholder: getInitials('I²IT Pune'), website: '#' },
  { id: '6755', name: 'JSPM Narhe Technical Campus, Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('JSPM NTC'), website: '#' },
  { id: '6758', name: 'Sahyadri Valley College of Engineering & Technology, Rajuri, Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SVCOET Rajuri'), website: '#' },
  { id: '6759', name: 'Shree Ramchandra College of Engineering, Lonikand,Pune', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SRCOE Lonikand'), website: '#' },
  { id: '6767', name: 'Suman Ramesh Tulsiani Technical Campus: Faculty of Engineering, Kamshet,Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SRTTC Kamshet'), website: '#' },
  { id: '6768', name: 'P.K. Technical Campus, Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('PKTC Pune'), website: '#' },
  { id: '6769', name: 'Rasiklal M. Dhariwal Sinhgad Technical Institutes Campus, Warje, Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('RMDSTIC Warje'), website: '#' },
  { id: '6770', name: 'SKN Sinhgad Institute of Technology & Science, Kusgaon(BK),Pune.', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('SKNSITS Kusgaon'), website: '#' },
  { id: '6772', name: 'NBN Sinhgad Technical Institutes Campus, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('NBNSTIC Pune'), website: '#' },
  { id: '6794', name: 'Anantrao Pawar College of Engineering & Research, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('APCOER Pune'), website: '#' },
  { id: '6795', name: 'Shri.Someshwar Shikshan Prasarak Mandal, Sharadchandra Pawar College of Engineering & Technology, Someshwar Nagar', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹100000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('SSSPM SPCOET'), website: '#' },
  { id: '6796', name: 'Bharati Vidyapeeths College of Engineering,Lavale, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('BVCOE Lavale'), website: '#' },
  { id: '6802', name: 'Dr. D.Y.Patil Institute of Engineering, Management & Reseach, Akurdi, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 10, rating: 4.1, logoPlaceholder: getInitials('DYPIEMR Akurdi'), website: '#' },
  { id: '6808', name: 'Keystone School of Engineering, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('Keystone SOE'), website: '#' },
  { id: '6815', name: 'Vidya Prasarini Sabhas College of Engineering & Technology, Lonavala', district: 'Pune', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('VPSCOET Lonavala'), website: '#' },
  { id: '6822', name: 'Pimpri Chinchwad Education Trusts Pimpri Chinchwad College Of Engineering And Research, Ravet', district: 'Pune', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('PCCOER Ravet'), website: '#' },
  { id: '6834', name: 'Dr.D.Y.Patil College Of Engineering & Innovation,Talegaon', district: 'Pune', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('DYPCOEI Talegaon'), website: '#' },
  { id: '6991', name: 'Dr. D.Y. Patil Technical Campus, Varale, Talegaon, Pune', district: 'Pune', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('DYPTC Varale'), website: '#' },

  // Raigad
  { id: '3033', name: 'Dr. Babasaheb Ambedkar Technological University, Lonere', district: 'Raigad', stream: 'PCM', establishedYear: 1989, collegeType: 'University', annualFees: '₹60,000', campusSizeAcres: 500, rating: 4.4, logoPlaceholder: getInitials('DBATU Lonere'), website: '#' },
  { id: '3147', name: 'Saraswati Education Society, Yadavrao Tasgaonkar Institute of Engineering & Technology, Karjat', district: 'Raigad', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 25, rating: 3.8, logoPlaceholder: getInitials('YTIET Karjat'), website: '#' },
  { id: '3198', name: 'Konkan Gyanpeeth College of Engineering, Karjat', district: 'Raigad', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 33, rating: 3.9, logoPlaceholder: getInitials('KGCE Karjat'), website: '#' },
  { id: '3223', name: 'Mahatma Education Societys Pillai HOC College of Engineering & Technology, Tal. Khalapur. Dist. Raigad', district: 'Raigad', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 16, rating: 3.9, logoPlaceholder: getInitials('Pillai HOC'), website: '#' },
  { id: '3224', name: 'Leela Education Society, G.V. Acharya Institute of Engineering and Technology, Shelu, Karjat', district: 'Raigad', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('GVA Karjat'), website: '#' },
  { id: '3353', name: 'Dilkap Research Institute Of Engineering and Management Studies, At.Mamdapur, Post- Neral, Tal- Karjat, Mumbai', district: 'Raigad', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('Dilkap Neral'), website: '#' },
  { id: '3447', name: 'G.M.Vedak Institute of Technology, Tala, Raigad.', district: 'Raigad', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('GMVIT Tala'), website: '#' },
  { id: '3467', name: 'Vishwaniketans Institute of Management Entrepreneurship and Engineering Technology(i MEET), Khalapur Dist Raigad', district: 'Raigad', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('iMEET Khalapur'), website: '#' },
  { id: '3146', name: 'Jawahar Education Societys Annasaheb Chudaman Patil College of Engineering,Kharghar, Navi Mumbai', district: 'Raigad', stream: 'PCM', establishedYear: 1992, collegeType: 'Private', annualFees: '₹1,30,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('ACPCOE Kharghar'), website: '#' },
  { id: '3154', name: 'Saraswati Education Societys Saraswati College of Engineering,Kharghar Navi Mumbai', district: 'Raigad', stream: 'PCM', establishedYear: 2004, collegeType: 'Private', annualFees: '₹1,35,000', campusSizeAcres: 11, rating: 4.1, logoPlaceholder: getInitials('SCOE Kharghar'), website: '#' },
  { id: '3175', name: 'M.G.M.s College of Engineering and Technology, Kamothe, Navi Mumbai', district: 'Raigad', stream: 'PCM', establishedYear: 1986, collegeType: 'Private', annualFees: '₹1,40,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('MGM Kamothe'), website: '#' },
  { id: '3192', name: 'Smt. Indira Gandhi College of Engineering, Navi Mumbai', district: 'Raigad', stream: 'PCM', establishedYear: 1993, collegeType: 'Private', annualFees: '₹1,20,000', campusSizeAcres: 5, rating: 3.8, logoPlaceholder: getInitials('SIGCE Navi Mumbai'), website: '#' },
  { id: '3207', name: 'Mahatma Education Societys Pillai College of Engineering, New Panvel', district: 'Raigad', stream: 'PCM', establishedYear: 1999, collegeType: 'Autonomous', annualFees: '₹1,70,000', campusSizeAcres: 15, rating: 4.3, logoPlaceholder: getInitials('Pillai COE Panvel'), website: '#' },
  { id: '3439', name: 'Anjuman-I-Islams Kalsekar Technical Campus, Panvel', district: 'Raigad', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Kalsekar Panvel'), website: '#' },
  { id: '3477', name: 'Chhartrapati Shivaji Maharaj Institute of Technology, Shedung, Panvel', district: 'Raigad', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('CSMIT Panvel'), website: '#' },
  { id: '3220', name: 'Yadavrao Tasgaonkar College of Engineering & Management', district: 'Raigad', stream: 'PCM', establishedYear: 2005, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 15, rating: 3.7, logoPlaceholder: getInitials('YTCOEM'), website: '#' },

  // Ratnagiri
  { id: '3042', name: 'Government College of Engineering, Ratnagiri', district: 'Ratnagiri', stream: 'PCM', establishedYear: 2008, collegeType: 'Government', annualFees: '₹20,000', campusSizeAcres: 20, rating: 4.0, logoPlaceholder: getInitials('GCOER Ratnagiri'), website: '#' },
  { id: '3200', name: 'Hope Foundation and research centers Finolex Academy of Management and Technology, Ratnagiri', district: 'Ratnagiri', stream: 'PCM', establishedYear: 1996, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('FAMT Ratnagiri'), website: '#' },
  { id: '3202', name: 'Rajendra Mane College of Engineering & Technology Ambav Deorukh', district: 'Ratnagiri', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 45, rating: 3.9, logoPlaceholder: getInitials('RMCET Deorukh'), website: '#' },
  { id: '3216', name: 'Gharda Foundations Gharda Institute of Technology,Khed, Ratnagiri', district: 'Ratnagiri', stream: 'PCM', establishedYear: 2007, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 35, rating: 3.8, logoPlaceholder: getInitials('GIT Khed'), website: '#' },
  { id: '3462', name: 'VPMs Maharshi Parshuram College of Engineering, Velneshwar, Ratnagiri.', district: 'Ratnagiri', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.6, logoPlaceholder: getInitials('MPCOE Velneshwar'), website: '#' },

  // Sangli
  { id: '6007', name: 'Walchand College of Engineering, Sangli', district: 'Sangli', stream: 'PCM', establishedYear: 1947, collegeType: 'Autonomous', annualFees: '₹1,00,000', campusSizeAcres: 90, rating: 4.7, logoPlaceholder: getInitials('Walchand Sangli'), website: '#' },
  { id: '6214', name: 'K. E. Societys Rajarambapu Institute of Technology, Walwa, Sangli', district: 'Sangli', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,25,000', campusSizeAcres: 17, rating: 4.5, logoPlaceholder: getInitials('RIT Walwa'), website: '#' },
  { id: '6217_san', name: 'Shri. Balasaheb Mane Shikshan Prasarak Mandals, Ashokrao Mane Group of Institutions', district: 'Sangli', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 18, rating: 3.9, logoPlaceholder: getInitials('AMGOI Sangli'), website: '#' },
  { id: '6269', name: 'Shetkari Shikshan Mandals Pad. Vasantraodada Patil Institute of Technology, Budhgaon, Sangli', district: 'Sangli', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 25, rating: 4.1, logoPlaceholder: getInitials('VPIT Budhgaon'), website: '#' },
  { id: '6283', name: 'Annasaheb Dange College of Engineering and Technology, Ashta, Sangli', district: 'Sangli', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 20, rating: 4.2, logoPlaceholder: getInitials('ADCET Ashta'), website: '#' },
  { id: '6304', name: 'Loknete Hanumantrao Charitable Trusts Adarsh Institute of Technology and Research Centre, Vita,Sangli', district: 'Sangli', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('AITRC Vita'), website: '#' },
  { id: '6313', name: 'Jaywant College of Engineering & Polytechnic , Kille Macchindragad Tal. Walva District- Sangali', district: 'Sangli', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('JCOEP Walva'), website: '#' },
  { id: '6644', name: 'Shri. Ambabai Talim Sansthas Sanjay Bhokare Group of Institutes, Miraj', district: 'Sangli', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('SBGI Miraj'), website: '#' },
  { id: '6762', name: 'Nanasaheb Mahadik College of Engineering,Walwa, Sangli.', district: 'Sangli', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('NMCOE Walwa'), website: '#' },
  { id: '6799', name: 'Shivganga Charitable Trust, Sangli Vishveshwarya Technical Campus, Faculty of Diploma Engineering, Patgaon, Miraj', district: 'Sangli', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 5, rating: 3.5, logoPlaceholder: getInitials('SVTC Patgaon'), website: '#' },

  // Satara
  { id: '6005', name: 'Government College of Engineering, Karad', district: 'Satara', stream: 'PCM', establishedYear: 1960, collegeType: 'Government', annualFees: '₹25,000', campusSizeAcres: 40, rating: 4.5, logoPlaceholder: getInitials('GCE Karad'), website: '#' },
  { id: '6270', name: 'Rayat Shikshan Sansthas Karmaveer Bhaurao Patil College of Engineering, Satara', district: 'Satara', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 20, rating: 4.1, logoPlaceholder: getInitials('KBPCOE Satara'), website: '#' },
  { id: '6303', name: 'Dr. Ashok Gujar Technical Institutes Dr. Daulatrao Aher College of Engineering, Karad', district: 'Satara', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 15, rating: 3.9, logoPlaceholder: getInitials('DACOE Karad'), website: '#' },
  { id: '6305', name: 'S.D.N.C.R.E.SS.Late Narayandas Bhawandas Chhabada Institute of Engineering & Technology, Satara', district: 'Satara', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('LNBCIET Satara'), website: '#' },
  { id: '6466', name: 'Shree Santkrupa Shikshan Sanstha, Shree Santkrupa Institute Of Engineering & Technology, Karad', district: 'Satara', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SSIET Karad'), website: '#' },
  { id: '6545', name: 'Samarth Education Trusts Arvind Gavali College Of Engineering Panwalewadi, Varye,Satara.', district: 'Satara', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('AGCOE Satara'), website: '#' },
  { id: '6766', name: 'Phaltan Education Societys College of Engineering Thakurki Tal- Phaltan Dist-Satara', district: 'Satara', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('COE Phaltan'), website: '#' },
  { id: '6797', name: 'Dnyanshree Institute Engineering and Technology, Satara', district: 'Satara', stream: 'PCM', establishedYear: 2012, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('DIET Satara'), website: '#' },
  { id: '6757', name: 'Yashoda Technical Campus, Wadhe, Satara.', district: 'Satara', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90000', campusSizeAcres: 10, rating: 3.8, logoPlaceholder: getInitials('YTC Satara'), website: '#' },

  // Sindhudurg
  { id: '3206', name: 'S.S.P.M.s College of Engineering, Kankavli', district: 'Sindhudurg', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 3.7, logoPlaceholder: getInitials('SSPM Kankavli'), website: '#' },
  { id: '3440', name: 'Metropolitan Institute of Technology & Management, Sukhalwad, Sindhudurg.', district: 'Sindhudurg', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 8, rating: 3.5, logoPlaceholder: getInitials('MITM Sindhudurg'), website: '#' },
  { id: '3470', name: 'YASHWANTRAO BHONSALE INSTITUTE OF TECHNOLOGY', district: 'Sindhudurg', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('YBIT Sindhudurg'), website: '#' },

  // Solapur
  { id: '6219', name: 'KSGBSs Bharat- Ratna Indira Gandhi College of Engineering, Kegaon, Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 20, rating: 3.9, logoPlaceholder: getInitials('BIGCE Solapur'), website: '#' },
  { id: '6220', name: 'Shri Vithal Education and Research Institutes College of Engineering, Pandharpur', district: 'Solapur', stream: 'PCM', establishedYear: 1998, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.0, logoPlaceholder: getInitials('SVERI COE Pandharpur'), website: '#' },
  { id: '6223', name: 'Pradnya Niketan Education Societys Nagesh Karajagi Orchid College of Engineering & Technology, Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 15, rating: 4.1, logoPlaceholder: getInitials('NK Orchid Solapur'), website: '#' },
  { id: '6265', name: 'Walchand Institute of Technology, Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 1983, collegeType: 'Autonomous', annualFees: '₹1,10,000', campusSizeAcres: 30, rating: 4.4, logoPlaceholder: getInitials('WIT Solapur'), website: '#' },
  { id: '6293', name: 'Kai Amdar Bramhadevdada Mane Shikshan & Samajik Prathistans Bramhadevdada Mane Institute of Technology, Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 2006, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 18, rating: 3.8, logoPlaceholder: getInitials('BMIT Solapur'), website: '#' },
  { id: '6308', name: 'Shanti Education Society, A.G. Patil Institute of Technology, Soregaon, Solapur(North)', district: 'Solapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('AGPIT Solapur'), website: '#' },
  { id: '6321', name: 'Vidya Vikas Pratishthan Institute of Engineering and Technology, Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('VVPIET Solapur'), website: '#' },
  { id: '6326', name: 'Shri Pandurang Pratishtan, Karmayogi Engineering College, Shelve, Pandharpur', district: 'Solapur', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 12, rating: 3.7, logoPlaceholder: getInitials('KEC Shelve'), website: '#' },
  { id: '6444', name: 'Shriram Institute Of Engineering & Technology, (Poly), Paniv', district: 'Solapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹40,000', campusSizeAcres: 5, rating: 3.5, logoPlaceholder: getInitials('SIET Poly Paniv'), website: '#' },
  { id: '6640', name: 'N. B. Navale Sinhgad College of Engineering, Kegaon, solapur', district: 'Solapur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 15, rating: 4.0, logoPlaceholder: getInitials('NBNSCOE Solapur'), website: '#' },
  { id: '6643', name: 'S K N Sinhgad College of Engineering, Korti Tal. Pandharpur Dist Solapur', district: 'Solapur', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹1,05,000', campusSizeAcres: 12, rating: 3.9, logoPlaceholder: getInitials('SKNSCOE Korti'), website: '#' },
  { id: '6756', name: 'Fabtech Technical Campus College of Engineering and Research, Sangola', district: 'Solapur', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('FTCOER Sangola'), website: '#' },
  { id: '6781', name: 'Bhagwant Institute of Technology, Barshi', district: 'Solapur', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('BIT Barshi'), website: '#' },
  { id: '6782', name: 'Sahakar Maharshee Shankarrao Mohite Patil Institute of Technology & Research, Akluj', district: 'Solapur', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('SMSMPITR Akluj'), website: '#' },
  { id: '6901', name: 'MAEERs MIT College of Railway Engineering and Research, Jamgaon, Barshi', district: 'Solapur', stream: 'PCM', establishedYear: 2017, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.9, logoPlaceholder: getInitials('MITCORER Barshi'), website: '#' },
  { id: '6938', name: 'Shree Siddheshwar Womens College Of Engineering Solapur.', district: 'Solapur', stream: 'PCM', establishedYear: 1999, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 8, rating: 3.7, logoPlaceholder: getInitials('SSWCOE Solapur'), website: '#' },

  // Thane
  { id: '3187', name: 'N.Y.S.S.s Datta Meghe College of Engineering, Airoli, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1988, collegeType: 'Private', annualFees: '₹1,50,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('Datta Meghe Airoli'), website: '#' },
  { id: '3189', name: 'Bharati Vidyapeeth College of Engineering, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1990, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 5, rating: 4.2, logoPlaceholder: getInitials('BVCOE Navi Mumbai'), website: '#' },
  { id: '3190', name: 'Terna Engineering College, Nerul, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1991, collegeType: 'Private', annualFees: '₹1,55,000', campusSizeAcres: 5, rating: 4.1, logoPlaceholder: getInitials('Terna Nerul'), website: '#' },
  { id: '3193', name: 'Shivajirao S. Jondhale College of Engineering, Dombivali,Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 7, rating: 3.7, logoPlaceholder: getInitials('SSJCOE Dombivali'), website: '#' },
  { id: '3196', name: 'Lokmanya Tilak College of Engineering, Kopar Khairane, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,45,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('LTCOE Navi Mumbai'), website: '#' },
  { id: '3197', name: 'Agnel Charities FR. C. Rodrigues Institute of Technology, Vashi, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 1994, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 5, rating: 4.2, logoPlaceholder: getInitials('FCRIT Vashi'), website: '#' },
  { id: '3210', name: 'Excelsior Education Societys K.C. College of Engineering and Management Studies and Research, Kopri, Thane (E)', district: 'Thane', stream: 'PCM', establishedYear: 2001, collegeType: 'Private', annualFees: '₹1,25,000', campusSizeAcres: 3, rating: 3.8, logoPlaceholder: getInitials('KC College Thane'), website: '#' },
  { id: '3211', name: 'S.I.E.S. Graduate School of Technology, Nerul, Navi Mumbai', district: 'Thane', stream: 'PCM', establishedYear: 2002, collegeType: 'Private', annualFees: '₹1,60,000', campusSizeAcres: 4, rating: 4.1, logoPlaceholder: getInitials('SIES GST Nerul'), website: '#' },
  { id: '3212', name: 'WATUMULL INSTITUTE OF ELECTRONICS ENGINEERING & COMPUTER TECHNOLOGY, ULHASNAGAR', district: 'Thane', stream: 'PCM', establishedYear: 1981, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 2, rating: 3.7, logoPlaceholder: getInitials('Watumull Ulhasnagar'), website: '#' },
  { id: '3217', name: 'Vighnaharata Trusts Shivajirao S. Jondhale College of Engineering & Technology, Shahapur, Asangaon, Dist Thane', district: 'Thane', stream: 'PCM', establishedYear: 2004, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 3.6, logoPlaceholder: getInitials('SSJondhale Asangaon'), website: '#' },
  { id: '3219', name: 'Koti Vidya Charitable Trusts Smt. Alamuri Ratnamala Institute of Engineering and Technology, Sapgaon, Tal. Shahapur', district: 'Thane', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 15, rating: 3.7, logoPlaceholder: getInitials('ARMIET Shahapur'), website: '#' },
  { id: '3277', name: 'Shree Shankar Narayan Education Trust,Pravin Patil College of Diploma Engg. & Technology, Bhayinder (E) Western Rly', district: 'Thane', stream: 'PCM', establishedYear: 2002, collegeType: 'Private', annualFees: '₹60,000', campusSizeAcres: 3, rating: 3.5, logoPlaceholder: getInitials('Pravin Patil Diploma'), website: '#' },
  { id: '3351', name: 'Bharat College of Engineering, Kanhor, Badlapur(W)', district: 'Thane', stream: 'PCM', establishedYear: 2010, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 5, rating: 3.6, logoPlaceholder: getInitials('Bharat COE Badlapur'), website: '#' },
  { id: '3436', name: 'B.R. Harne College of Engineering & Technology, Karav, Tal-Ambernath.', district: 'Thane', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 7, rating: 3.5, logoPlaceholder: getInitials('BR Harne Ambernath'), website: '#' },
  { id: '3445', name: 'Vishvatmak Jangli Maharaj Ashram Trusts Vishvatmak Om Gurudev College of Engineering, Mohili-Aghai, Shahpur.', district: 'Thane', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 10, rating: 3.5, logoPlaceholder: getInitials('VOGCOE Shahpur'), website: '#' },
  { id: '3471', name: 'New Horizon Institute of Technology & Management, Thane', district: 'Thane', stream: 'PCM', establishedYear: 2015, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 3, rating: 3.6, logoPlaceholder: getInitials('NHITM Thane'), website: '#' },
  { id: '3475', name: 'A. P. Shah Institute of Technology, Thane', district: 'Thane', stream: 'PCM', establishedYear: 2014, collegeType: 'Private', annualFees: '₹1,10,000', campusSizeAcres: 4, rating: 3.7, logoPlaceholder: getInitials('AP Shah Thane'), website: '#' },
  { id: '3503', name: 'Indala College Of Engineering, Bapsai Tal.Kalyan', district: 'Thane', stream: 'PCM', establishedYear: 2011, collegeType: 'Private', annualFees: '₹85,000', campusSizeAcres: 5, rating: 3.5, logoPlaceholder: getInitials('Indala Kalyan'), website: '#' },

  // Wardha
  { id: '4118', name: 'Bapurao Deshmukh College of Engineering, Sevagram', district: 'Wardha', stream: 'PCM', establishedYear: 1983, collegeType: 'Private', annualFees: '₹95,000', campusSizeAcres: 30, rating: 4.0, logoPlaceholder: getInitials('BDCOE Sevagram'), website: '#' },
  { id: '4175', name: 'JMSS Shri Shankarprasad Agnihotri College of Engineering, Wardha', district: 'Wardha', stream: 'PCM', establishedYear: 1984, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('SSPAC Wardha'), website: '#' },
  { id: '4197', name: 'Jai Mahakali Shikshan Sanstha, Agnihotri College of Engineering, Sindhi(Meghe)', district: 'Wardha', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹75,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('ACE Sindhi Meghe'), website: '#' },
  { id: '4648', name: 'R.V. Parankar College of Engineering & Technology, Arvi, Dist Wardha', district: 'Wardha', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 8, rating: 3.6, logoPlaceholder: getInitials('RVPCOET Arvi'), website: '#' },
  { id: '4649', name: 'Bajaj Institute of Technology, Wardha', district: 'Wardha', stream: 'PCM', establishedYear: 2017, collegeType: 'Private', annualFees: '₹1,00,000', campusSizeAcres: 10, rating: 4.0, logoPlaceholder: getInitials('BIT Wardha'), website: '#' },

  // Washim
  { id: '1180', name: 'Sanmati Engineering College, Sawargaon Barde, Washim', district: 'Washim', stream: 'PCM', establishedYear: 2008, collegeType: 'Private', annualFees: '₹70,000', campusSizeAcres: 10, rating: 3.7, logoPlaceholder: getInitials('Sanmati Washim'), website: '#' },

  // Yavatmal
  { id: '1012', name: 'Government College of Engineering,Yavatmal', district: 'Yavatmal', stream: 'PCM', establishedYear: 2004, collegeType: 'Government', annualFees: '₹22,000', campusSizeAcres: 40, rating: 4.2, logoPlaceholder: getInitials('GCOEY Yavatmal'), website: '#' },
  { id: '1120', name: 'Jawaharlal Darda Institute of Engineering and Technology, Yavatmal', district: 'Yavatmal', stream: 'PCM', establishedYear: 1996, collegeType: 'Private', annualFees: '₹90,000', campusSizeAcres: 25, rating: 4.0, logoPlaceholder: getInitials('JDIET Yavatmal'), website: '#' },
  { id: '1127', name: 'Jagadambha Bahuuddeshiya Gramin Vikas Sansthas Jagdambha College of Engineering and Technology, Yavatmal', district: 'Yavatmal', stream: 'PCM', establishedYear: 2009, collegeType: 'Private', annualFees: '₹80,000', campusSizeAcres: 15, rating: 3.8, logoPlaceholder: getInitials('JCET Yavatmal'), website: '#' },
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
        setAiDetailsError(result.error || "Failed to fetch AI-powered details.");
        toast({
          title: "Error Fetching AI Details",
          description: result.error || "Could not retrieve AI-powered details for this college.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
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
      setAiCollegeDetails(null);
      setAiDetailsError(null);
      setIsFetchingAiDetails(false);
      setSelectedCollegeForDetails(null);
    }
  };

  const renderStars = (rating: number | undefined) => {
    if (rating === undefined || rating === null || rating === 0) return <span className="text-xs text-muted-foreground">N/A</span>;
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
        {[...Array(emptyStars < 0 ? 0 : emptyStars)].map((_, i) => (
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
            <DialogHeader className="pb-4 border-b mb-4">
              <DialogTitle className="text-xl font-bold text-primary">{selectedCollegeForDetails.name}</DialogTitle>
              <DialogDescription>
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
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <h4 className="font-semibold">Error Fetching Details</h4>
                    </div>
                    <p className="text-sm">{aiDetailsError}</p>
                  </div>
                )}

                {aiCollegeDetails && !isFetchingAiDetails && !aiDetailsError && (
                  <>
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold mb-2 text-accent">College Overview</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {aiCollegeDetails.collegeSummary || "No summary available from AI."}
                      </p>
                    </div>

                     {aiCollegeDetails.branches && aiCollegeDetails.branches.length > 0 && (
                        <div className="mt-2">
                          <h3 className="text-lg font-semibold mb-3 text-accent">AI-Generated Branch Insights &amp; Typical Cutoffs</h3>
                          <div className="divide-y divide-border/60 rounded-md border border-border/60 shadow-sm">
                            {aiCollegeDetails.branches.map((branch, index) => (
                              <div key={index} className="p-4 hover:bg-muted/50 transition-colors">
                                <h4 className="text-md font-semibold text-primary mb-1.5">{branch.branchName}</h4>
                                {branch.intake && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium">Approx. Intake:</span> {branch.intake}
                                  </p>
                                )}
                                <div className="space-y-1.5 text-xs">
                                  {branch.mhtCetCutoff && (
                                    <div className="flex items-baseline">
                                      <span className="w-28 shrink-0 text-muted-foreground font-medium">MHT-CET Cutoff:</span>
                                      <span className="text-foreground">{branch.mhtCetCutoff}</span>
                                    </div>
                                  )}
                                  {branch.jeeMainCutoff && (
                                    <div className="flex items-baseline">
                                      <span className="w-28 shrink-0 text-muted-foreground font-medium">JEE Main Cutoff:</span>
                                      <span className="text-foreground">{branch.jeeMainCutoff}</span>
                                    </div>
                                  )}
                                  {branch.neetCutoff && (
                                    <div className="flex items-baseline">
                                      <span className="w-28 shrink-0 text-muted-foreground font-medium">NEET Cutoff:</span>
                                      <span className="text-foreground">{branch.neetCutoff}</span>
                                    </div>
                                  )}
                                  {!(branch.mhtCetCutoff || branch.jeeMainCutoff || branch.neetCutoff) && (
                                    <p className="text-muted-foreground italic">No specific cutoff information available from AI for this branch.</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    {(!aiCollegeDetails.branches || aiCollegeDetails.branches.length === 0) && (
                        <p className="text-sm text-muted-foreground italic mt-4">No specific branch information available from AI.</p>
                    )}
                  </>
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
            <DialogFooter className="mt-4 pt-4 border-t">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredColleges.map((college) => (
                  <Card key={college.id} className="shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col bg-card rounded-xl overflow-hidden border hover:border-primary group">
                     <CardHeader className="p-4">
                        <CardTitle className="text-md md:text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                          {college.website && college.website !== '#' ? (
                            <a href={college.website} target="_blank" rel="noopener noreferrer" className="hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm">
                              {college.name} <ExternalLink className="inline-block h-3.5 w-3.5 ml-1 text-muted-foreground group-hover:text-primary" />
                            </a>
                          ) : college.name }
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1 flex items-center">
                          <MapPin className="h-3.5 w-3.5 mr-1.5" /> {college.district}
                        </CardDescription>
                      </CardHeader>
                    <CardContent className="p-4 flex-grow space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted-foreground">
                        <div className="flex items-center text-xs"><Calendar className="h-3.5 w-3.5 mr-1.5 text-sky-600 dark:text-sky-400" /> Estd: <span className="font-medium text-foreground ml-1">{college.establishedYear || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><Landmark className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" /> Type: <span className="font-medium text-foreground ml-1">{college.collegeType || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><IndianRupee className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400" /> Fees: <span className="font-medium text-foreground ml-1">{college.annualFees || 'N/A'}</span></div>
                        <div className="flex items-center text-xs"><Ruler className="h-3.5 w-3.5 mr-1.5 text-orange-600 dark:text-orange-400" /> Campus: <span className="font-medium text-foreground ml-1">{college.campusSizeAcres ? `${college.campusSizeAcres} Acres` : 'N/A'}</span></div>
                      </div>
                       <div className="flex items-center pt-2">
                         {renderStars(college.rating)}
                      </div>
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
};
```

I've updated the "View Details" dialog in `src/app/colleges/page.tsx` to provide a more advanced and structured UI for displaying AI-generated college details.

**Key Changes:**
*   **Enhanced Dialog Header**: Clearer separation of title and description.
*   **ScrollArea for Content**: Ensures long lists of branch details or long summaries are scrollable within the dialog.
*   **Improved College Overview Display**: Better spacing for the `collegeSummary`.
*   **Structured Branch Insights**:
    *   A dedicated heading for "AI-Generated Branch Insights & Typical Cutoffs".
    *   The list of branches is now within a `div` with its own border and subtle shadow, making it visually distinct.
    *   Each branch is separated by a horizontal divider (`divide-y`).
    *   Within each branch:
        *   The `branchName` is a more prominent, primary-colored heading.
        *   `intake` information is clearly labeled.
        *   Cutoff details (MHT-CET, JEE Main, NEET) are displayed with fixed-width labels for better alignment and readability, making it easier to scan.
*   **Clearer Fallbacks**: Messages for "No summary available" or "No specific branch information available" are more user-friendly.
*   **Loading/Error States**: Maintained existing robust handling for loading spinners and error messages.

This refined UI should make the detailed college information easier to consume and more visually appealing.