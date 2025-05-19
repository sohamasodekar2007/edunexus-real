
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type { UserClass } from '@/types';

const USER_CLASSES_OPTIONS: UserClass[] = ["11th Grade", "12th Grade", "Dropper", "Teacher"];
const TARGET_EXAM_YEAR_OPTIONS: string[] = ["-- Not Set --", "2025", "2026", "2027", "2028"]; // Example years

export default function SettingsPage() {
  const router = useRouter();
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>('U');
  const [userClass, setUserClass] = useState<UserClass | ''>('');
  const [userTargetYear, setUserTargetYear] = useState<string>('-- Not Set --');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedFullName = localStorage.getItem('userFullName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedPhone = localStorage.getItem('userPhone');
      const storedAvatarFallback = localStorage.getItem('userAvatarFallback');
      const storedClass = localStorage.getItem('userClass') as UserClass | null;
      const storedTargetYear = localStorage.getItem('userTargetYear');

      if (storedFullName) setUserFullName(storedFullName);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedPhone) setUserPhone(storedPhone);
      if (storedAvatarFallback) setUserAvatarFallback(storedAvatarFallback);
      if (storedClass && USER_CLASSES_OPTIONS.includes(storedClass)) setUserClass(storedClass);
      if (storedTargetYear && storedTargetYear !== 'N/A' ) setUserTargetYear(storedTargetYear);
      
      // For avatar preview, you might load from user.avatarUrl if it's stored
      // For now, it uses the fallback.
      setAvatarPreview(`https://placehold.co/96x96.png?text=${storedAvatarFallback || 'U'}`);
    }
  }, []);

  const handleSaveChanges = () => {
    // Placeholder for save logic
    console.log("Save Changes Clicked. Data to save:", { userClass, userTargetYear });
    // router.push('/profile'); // Navigate back or show toast
  };

  const handleCancel = () => {
    router.back();
  };

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Basic validation (can be expanded)
      if (file.size > 2 * 1024 * 1024) { // Max 2MB
        alert("File is too large. Max 2MB allowed.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Here you would typically upload the file to a server
    }
  };

  const handleRemoveProfilePicture = () => {
    setAvatarPreview(`https://placehold.co/96x96.png?text=${userAvatarFallback}`);
    // Here you would typically send a request to the server to remove the picture
  };


  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-muted/30 py-4 z-10 -mx-4 md:-mx-6 px-4 md:px-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="w-9"></div> {/* Placeholder for alignment */}
      </header>

      <Card className="shadow-lg w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>Manage your personal information and profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Profile Picture Section */}
          <div>
            <Label htmlFor="profilePicture" className="text-sm font-medium">Profile Picture</Label>
            <div className="mt-2 flex items-center gap-4">
              <Avatar className="h-24 w-24 text-3xl">
                <AvatarImage src={avatarPreview || `https://placehold.co/96x96.png?text=${userAvatarFallback}`} alt={userFullName} data-ai-hint="user avatar settings"/>
                <AvatarFallback>{userAvatarFallback}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild>
                  <Label htmlFor="profilePictureFile" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" /> Change
                  </Label>
                </Button>
                <input type="file" id="profilePictureFile" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleProfilePictureChange} />
                <Button variant="destructive" onClick={handleRemoveProfilePicture}>
                  <XCircle className="mr-2 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Max 2MB. JPG, PNG, WEBP.</p>
          </div>

          {/* Form Fields Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={userFullName} disabled className="mt-1 bg-muted/50" />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input id="phoneNumber" value={userPhone} disabled className="mt-1 bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">Contact support to change phone number.</p>
            </div>
            <div>
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input id="emailAddress" type="email" value={userEmail} disabled className="mt-1 bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div>
              <Label htmlFor="academicStatus">Academic Status</Label>
              <Select value={userClass} onValueChange={(value) => setUserClass(value as UserClass)} disabled={false /* Enable if editable */}>
                <SelectTrigger id="academicStatus" className="mt-1">
                  <SelectValue placeholder="Select your class" />
                </SelectTrigger>
                <SelectContent>
                  {USER_CLASSES_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="targetExamYear">Target Exam Year</Label>
              <Select value={userTargetYear} onValueChange={setUserTargetYear} disabled={false /* Enable if editable */}>
                <SelectTrigger id="targetExamYear" className="mt-1">
                  <SelectValue placeholder="-- Not Set --" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_EXAM_YEAR_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 pt-8">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

