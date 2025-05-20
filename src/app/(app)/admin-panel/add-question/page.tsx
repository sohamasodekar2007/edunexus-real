
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, BookOpen, Brain, Tag, HelpCircle, CalendarDays, Edit, Image as ImageIcon, Type, ListChecks, Trash2, Loader2 } from 'lucide-react';
// import { addQuestionAction } from '@/app/auth/actions'; // Will be uncommented later

// Define types for form state - can be expanded
type QuestionFormData = {
  subject: string;
  lessonName: string;
  difficulty: string;
  tags: string; // Comma-separated for now
  isPYQ: boolean;
  pyqExamName: string;
  pyqYear: string;
  pyqDate: string;
  pyqShift: string;
  questionType: string;
  // ... more fields will be added
};

const initialFormData: QuestionFormData = {
  subject: '',
  lessonName: '',
  difficulty: '',
  tags: '',
  isPYQ: false,
  pyqExamName: '',
  pyqYear: '',
  pyqDate: '',
  pyqShift: '',
  questionType: 'text',
};

export default function AddQuestionPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<QuestionFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  // const [lessonSuggestions, setLessonSuggestions] = useState<string[]>([]); // For autocomplete later

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof QuestionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: keyof QuestionFormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Form Data Submitted:", formData);

    // Placeholder for server action call
    // const questionDataForAction = new FormData();
    // Object.entries(formData).forEach(([key, value]) => {
    //   if (typeof value === 'boolean') {
    //     questionDataForAction.append(key, value.toString());
    //   } else if (value !== null && value !== undefined) {
    //     questionDataForAction.append(key, value as string);
    //   }
    // });
    // // Append file fields here when implemented

    try {
      // const result = await addQuestionAction(questionDataForAction);
      // if (result.success) {
      //   toast({ title: "Success", description: "Question added successfully!" });
      //   setFormData(initialFormData); // Reset form
      // } else {
      //   toast({ title: "Error", description: result.error || "Failed to add question.", variant: "destructive" });
      // }
      toast({ title: "Submit (Placeholder)", description: "Form submission logic to be implemented." });
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));


    } catch (error) {
      console.error("Submission error:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <PlusCircle className="mr-3 h-8 w-8 text-primary" />
          Add New Question
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-accent" />Basic Information</CardTitle>
            <CardDescription>Provide the fundamental details for the question.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Select name="subject" value={formData.subject} onValueChange={(value) => handleSelectChange('subject', value)}>
                <SelectTrigger id="subject" className="mt-1">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lessonName">Lesson Name</Label>
              <Input id="lessonName" name="lessonName" value={formData.lessonName} onChange={handleInputChange} placeholder="e.g., Kinematics, Chemical Bonding" className="mt-1" />
              {/* Add suggestions/autocomplete later */}
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select name="difficulty" value={formData.difficulty} onValueChange={(value) => handleSelectChange('difficulty', value)}>
                <SelectTrigger id="difficulty" className="mt-1">
                  <SelectValue placeholder="Select Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" value={formData.tags} onChange={handleInputChange} placeholder="e.g., conceptual, numerical, formula-based" className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: PYQ Details */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><HelpCircle className="mr-2 h-5 w-5 text-accent" />Previous Year Question (PYQ) Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="isPYQ" name="isPYQ" checked={formData.isPYQ} onCheckedChange={(checked) => handleCheckboxChange('isPYQ', checked as boolean)} />
              <Label htmlFor="isPYQ" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Is this a Previous Year Question?
              </Label>
            </div>
            {formData.isPYQ && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="pyqExamName">Exam Name</Label>
                  <Select name="pyqExamName" value={formData.pyqExamName} onValueChange={(value) => handleSelectChange('pyqExamName', value)}>
                    <SelectTrigger id="pyqExamName" className="mt-1">
                      <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JEE Main">JEE Main</SelectItem>
                      <SelectItem value="JEE Advanced">JEE Advanced</SelectItem>
                      <SelectItem value="KCET">KCET</SelectItem>
                      <SelectItem value="WBJEE">WBJEE</SelectItem>
                      <SelectItem value="MHT CET PCM">MHT CET PCM</SelectItem>
                      <SelectItem value="MHT CET PCB">MHT CET PCB</SelectItem>
                      <SelectItem value="NEET">NEET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pyqYear">Year</Label>
                  <Input id="pyqYear" name="pyqYear" type="number" value={formData.pyqYear} onChange={handleInputChange} placeholder="e.g., 2023" className="mt-1" />
                </div>
                {formData.pyqExamName !== 'NEET' && (
                  <>
                    <div>
                      <Label htmlFor="pyqDate">Date (Optional)</Label>
                      <Input id="pyqDate" name="pyqDate" type="date" value={formData.pyqDate} onChange={handleInputChange} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="pyqShift">Shift (Optional)</Label>
                       <Select name="pyqShift" value={formData.pyqShift} onValueChange={(value) => handleSelectChange('pyqShift', value)}>
                        <SelectTrigger id="pyqShift" className="mt-1">
                          <SelectValue placeholder="Select Shift" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N/A">N/A</SelectItem>
                          <SelectItem value="Shift 1">Shift 1</SelectItem>
                          <SelectItem value="Shift 2">Shift 2</SelectItem>
                          <SelectItem value="Morning">Morning</SelectItem>
                          <SelectItem value="Afternoon">Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Question Type & Content */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Edit className="mr-2 h-5 w-5 text-accent" />Question Content</CardTitle>
            <CardDescription>Define the type and content of the question itself.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div>
              <Label htmlFor="questionType">Question Type</Label>
              <Select name="questionType" value={formData.questionType} onValueChange={(value) => handleSelectChange('questionType', value)}>
                <SelectTrigger id="questionType" className="mt-1">
                  <SelectValue placeholder="Select Question Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Question</SelectItem>
                  <SelectItem value="image">Image Question</SelectItem>
                  <SelectItem value="text_image">Text + Image Question</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Placeholder for content inputs based on questionType */}
            <div className="p-4 border-dashed border-muted-foreground/50 rounded-md text-center text-muted-foreground">
              Question content input area (Text, Image, or Text+Image) will appear here based on selection.
              <br />
              (Implementation for this section is pending)
            </div>
          </CardContent>
        </Card>
        
        {/* Section 4: Options */}
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />Options</CardTitle>
            <CardDescription>Provide the answer choices for the question.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="p-4 border-dashed border-muted-foreground/50 rounded-md text-center text-muted-foreground">
              Options input area (Text or Image) will appear here based on Question Type.
              <br />
              (Implementation for this section is pending)
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Explanation & Correct Answer */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Brain className="mr-2 h-5 w-5 text-accent" />Explanation & Correct Answer</CardTitle>
            <CardDescription>Specify the correct answer and provide an explanation.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="p-4 border-dashed border-muted-foreground/50 rounded-md text-center text-muted-foreground">
              Correct option selector and explanation input (Text/Image) will appear here.
              <br />
              (Implementation for this section is pending)
            </div>
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={() => setFormData(initialFormData)} disabled={isLoading}>
            <Trash2 className="mr-2 h-4 w-4" /> Reset Form
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Question
          </Button>
        </CardFooter>
      </form>
    </div>
  );
}
