

'use client';

import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, BookOpen, Brain, HelpCircle, Edit, ListChecks, Trash2, Loader2, ClipboardPaste } from 'lucide-react';
import { addQuestionAction } from '@/app/auth/actions';

type QuestionFormData = {
  subject: string;
  lessonName: string;
  lessonTopic: string;
  difficulty: string;
  tags: string;
  isPYQ: boolean;
  pyqExamName: string;
  pyqYear: string;
  pyqDate: string;
  pyqShift: string;
  questionType: 'text' | 'image' | 'text_image';
  questionText: string;
  questionImage: File | null;
  optionsFormat: 'text_options' | 'image_options';
  optionAText: string;
  optionAImage: File | null;
  optionBText: string;
  optionBImage: File | null;
  optionCText: string;
  optionCImage: File | null;
  optionDText: string;
  optionDImage: File | null;
  correctOption: 'A' | 'B' | 'C' | 'D' | '';
  explanationText: string;
  explanationImage: File | null;
};

const initialFormData: QuestionFormData = {
  subject: '',
  lessonName: '',
  lessonTopic: '',
  difficulty: '',
  tags: '',
  isPYQ: false,
  pyqExamName: '',
  pyqYear: '',
  pyqDate: '',
  pyqShift: '',
  questionType: 'text',
  questionText: '',
  questionImage: null,
  optionsFormat: 'text_options',
  optionAText: '',
  optionAImage: null,
  optionBText: '',
  optionBImage: null,
  optionCText: '',
  optionCImage: null,
  optionDText: '',
  optionDImage: null,
  correctOption: '',
  explanationText: '',
  explanationImage: null,
};

export default function AddQuestionPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<QuestionFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);

  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [optionAImagePreview, setOptionAImagePreview] = useState<string | null>(null);
  const [optionBImagePreview, setOptionBImagePreview] = useState<string | null>(null);
  const [optionCImagePreview, setOptionCImagePreview] = useState<string | null>(null);
  const [optionDImagePreview, setOptionDImagePreview] = useState<string | null>(null);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (formData.questionType === 'image') {
      setFormData(prev => ({
        ...prev,
        optionAText: 'Option A',
        optionBText: 'Option B',
        optionCText: 'Option C',
        optionDText: 'Option D',
        optionsFormat: 'text_options' // Image questions imply text placeholders for A,B,C,D
      }));
    } else if (formData.questionType === 'text') {
        setFormData(prev => ({
            ...prev,
            optionsFormat: 'text_options'
        }));
    }
    // For 'text_image', optionsFormat is handled by its own Select component
  }, [formData.questionType]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof QuestionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: keyof QuestionFormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, fieldName: keyof QuestionFormData, setPreview: (url: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, [fieldName]: file }));
      setPreview(URL.createObjectURL(file));
    } else {
      setFormData(prev => ({ ...prev, [fieldName]: null }));
      setPreview(null);
    }
  };

  const handlePasteImage = async (
    fieldName: keyof Pick<QuestionFormData, 'questionImage' | 'optionAImage' | 'optionBImage' | 'optionCImage' | 'optionDImage' | 'explanationImage'>, // Ensure only image fields
    setPreview: (url: string | null) => void
  ) => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast({ title: "Clipboard API Not Supported", description: "Your browser does not support pasting images from the clipboard.", variant: "destructive" });
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      if (permission.state === 'denied') {
        toast({ title: "Clipboard Access Denied", description: "Please allow clipboard access in your browser settings.", variant: "destructive" });
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted_image.${imageType.split('/')[1]}`, { type: imageType });
          setFormData(prev => ({ ...prev, [fieldName]: file }));
          if (setPreview) {
            setPreview(URL.createObjectURL(file));
          }
          toast({ title: "Image Pasted", description: `Image pasted successfully into ${fieldName}.` });
          return; 
        }
      }
      toast({ title: "No Image Found", description: "No image found in the clipboard.", variant: "destructive" });
    } catch (error) {
      console.error('Failed to read clipboard contents: ', error);
      toast({ title: "Paste Failed", description: "Could not read image from clipboard. Ensure you have an image copied.", variant: "destructive" });
    }
  };


  const handleReset = () => {
    setFormData(initialFormData);
    setQuestionImagePreview(null);
    setOptionAImagePreview(null);
    setOptionBImagePreview(null);
    setOptionCImagePreview(null);
    setOptionDImagePreview(null);
    setExplanationImagePreview(null);
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const dataToSubmit = new FormData();
    // Helper to append if value is not null, undefined, or empty string (for optional text fields)
    const appendIfPresent = (key: string, value: string | boolean | File | null | undefined) => {
      if (value instanceof File) {
        dataToSubmit.append(key, value);
      } else if (typeof value === 'boolean') {
        dataToSubmit.append(key, value.toString());
      } else if (value !== null && value !== undefined && value !== '') {
         dataToSubmit.append(key, value as string);
      }
    };

    for (const key in formData) {
      appendIfPresent(key, formData[key as keyof QuestionFormData]);
    }
    
    try {
      const result = await addQuestionAction(dataToSubmit);
      if (result.success) {
        toast({ title: "Success", description: "Question added successfully!" });
        handleReset();
      } else {
        toast({ title: "Error", description: result.error || "Failed to add question.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderFileInput = (name: keyof QuestionFormData, preview: string | null, setPreview: (url: string | null) => void, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="file" accept="image/*" onChange={(e) => handleFileChange(e, name, setPreview)} className="mt-1" />
      {preview && <Image src={preview} alt={`${label} preview`} width={100} height={100} className="mt-2 rounded-md border" data-ai-hint="question image preview" />}
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <PlusCircle className="mr-3 h-8 w-8 text-primary" />
          Add New Question
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-accent" />Basic Information</CardTitle>
            <CardDescription>Provide the fundamental details for the question.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Select name="subject" value={formData.subject} onValueChange={(value) => handleSelectChange('subject', value)}>
                <SelectTrigger id="subject" className="mt-1"><SelectValue placeholder="Select Subject" /></SelectTrigger>
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
              <Input id="lessonName" name="lessonName" value={formData.lessonName} onChange={handleInputChange} placeholder="e.g., Kinematics" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="lessonTopic">Lesson Topic (Optional)</Label>
              <Input id="lessonTopic" name="lessonTopic" value={formData.lessonTopic} onChange={handleInputChange} placeholder="e.g., Projectile Motion" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select name="difficulty" value={formData.difficulty} onValueChange={(value) => handleSelectChange('difficulty', value)}>
                <SelectTrigger id="difficulty" className="mt-1"><SelectValue placeholder="Select Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
              <Input id="tags" name="tags" value={formData.tags} onChange={handleInputChange} placeholder="e.g., conceptual, numerical" className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><HelpCircle className="mr-2 h-5 w-5 text-accent" />Previous Year Question (PYQ) Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="isPYQ" name="isPYQ" checked={formData.isPYQ} onCheckedChange={(checked) => handleCheckboxChange('isPYQ', checked as boolean)} />
              <Label htmlFor="isPYQ" className="text-sm font-medium">Is this a Previous Year Question?</Label>
            </div>
            {formData.isPYQ && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="pyqExamName">Exam Name</Label>
                  <Select name="pyqExamName" value={formData.pyqExamName} onValueChange={(value) => handleSelectChange('pyqExamName', value)}>
                    <SelectTrigger id="pyqExamName" className="mt-1"><SelectValue placeholder="Select Exam" /></SelectTrigger>
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
                        <SelectTrigger id="pyqShift" className="mt-1"><SelectValue placeholder="Select Shift" /></SelectTrigger>
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

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Edit className="mr-2 h-5 w-5 text-accent" />Question Content</CardTitle>
            <CardDescription>Define the type and content of the question.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="questionType">Question Type</Label>
              <Select name="questionType" value={formData.questionType} onValueChange={(value) => handleSelectChange('questionType', value as QuestionFormData['questionType'] )}>
                <SelectTrigger id="questionType" className="mt-1"><SelectValue placeholder="Select Question Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Question</SelectItem>
                  <SelectItem value="image">Image Question</SelectItem>
                  <SelectItem value="text_image">Text + Image Question</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.questionType === 'text' && (
              <div>
                <Label htmlFor="questionText">Question Text (Supports MathJax/LaTeX)</Label>
                <Textarea id="questionText" name="questionText" value={formData.questionText} onChange={handleInputChange} placeholder="Enter question text..." className="mt-1 min-h-[100px]" />
              </div>
            )}
            {(formData.questionType === 'image' || formData.questionType === 'text_image') && (
              <div className="space-y-2">
                {renderFileInput('questionImage', questionImagePreview, setQuestionImagePreview, "Question Image")}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePasteImage('questionImage', setQuestionImagePreview)}
                  className="mt-1"
                >
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Paste Image
                </Button>
              </div>
            )}
             {formData.questionType === 'text_image' && (
              <div>
                <Label htmlFor="questionText">Accompanying Text (Supports MathJax/LaTeX)</Label>
                <Textarea id="questionText" name="questionText" value={formData.questionText} onChange={handleInputChange} placeholder="Enter accompanying text for the image question..." className="mt-1 min-h-[100px]" />
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />Options</CardTitle>
            <CardDescription>Provide the answer choices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(formData.questionType === 'text_image') && (
              <div>
                <Label htmlFor="optionsFormat">Options Format</Label>
                <Select name="optionsFormat" value={formData.optionsFormat} onValueChange={(value) => handleSelectChange('optionsFormat', value as QuestionFormData['optionsFormat'] )}>
                  <SelectTrigger id="optionsFormat" className="mt-1"><SelectValue placeholder="Select Options Format" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text_options">Text Options</SelectItem>
                    <SelectItem value="image_options">Image Options</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.questionType === 'text' || formData.questionType === 'image' || (formData.questionType === 'text_image' && formData.optionsFormat === 'text_options')) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="optionAText">Option A (Text)</Label>
                  <Textarea id="optionAText" name="optionAText" value={formData.optionAText} onChange={handleInputChange} placeholder="Option A text..." className="mt-1" 
                    readOnly={formData.questionType === 'image'} />
                </div>
                <div>
                  <Label htmlFor="optionBText">Option B (Text)</Label>
                  <Textarea id="optionBText" name="optionBText" value={formData.optionBText} onChange={handleInputChange} placeholder="Option B text..." className="mt-1"
                    readOnly={formData.questionType === 'image'} />
                </div>
                <div>
                  <Label htmlFor="optionCText">Option C (Text)</Label>
                  <Textarea id="optionCText" name="optionCText" value={formData.optionCText} onChange={handleInputChange} placeholder="Option C text..." className="mt-1" 
                    readOnly={formData.questionType === 'image'} />
                </div>
                <div>
                  <Label htmlFor="optionDText">Option D (Text)</Label>
                  <Textarea id="optionDText" name="optionDText" value={formData.optionDText} onChange={handleInputChange} placeholder="Option D text..." className="mt-1"
                    readOnly={formData.questionType === 'image'} />
                </div>
              </div>
            )}

            {(formData.questionType === 'text_image' && formData.optionsFormat === 'image_options') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderFileInput('optionAImage', optionAImagePreview, setOptionAImagePreview, "Option A Image")}
                {renderFileInput('optionBImage', optionBImagePreview, setOptionBImagePreview, "Option B Image")}
                {renderFileInput('optionCImage', optionCImagePreview, setOptionCImagePreview, "Option C Image")}
                {renderFileInput('optionDImage', optionDImagePreview, setOptionDImagePreview, "Option D Image")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Brain className="mr-2 h-5 w-5 text-accent" />Explanation & Correct Answer</CardTitle>
            <CardDescription>Specify the correct answer and provide an explanation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="correctOption">Correct Option</Label>
              <Select name="correctOption" value={formData.correctOption} onValueChange={(value) => handleSelectChange('correctOption', value as QuestionFormData['correctOption'])}>
                <SelectTrigger id="correctOption" className="mt-1"><SelectValue placeholder="Select Correct Option" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="explanationText">Explanation Text (Supports MathJax/LaTeX, Optional)</Label>
              <Textarea id="explanationText" name="explanationText" value={formData.explanationText} onChange={handleInputChange} placeholder="Enter explanation text..." className="mt-1 min-h-[100px]" />
            </div>
            {renderFileInput('explanationImage', explanationImagePreview, setExplanationImagePreview, "Explanation Image (Optional)")}
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
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


