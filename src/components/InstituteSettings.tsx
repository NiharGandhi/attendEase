
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Institute, InstituteSettingsFormData } from '@/lib/types';
import { instituteSettingsFormSchema } from '@/lib/types';
import { UploadCloud, Building, Link as LinkIcon, Save, Briefcase, Settings2 } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function InstituteSettings() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const instituteId = searchParams.get('instituteId');

  const [institute, setInstitute] = useState<Institute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<InstituteSettingsFormData>({
    resolver: zodResolver(instituteSettingsFormSchema),
    defaultValues: {
      name: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
    },
  });

  useEffect(() => {
    if (instituteId) {
      fetchInstituteDetails();
    } else {
      setIsLoading(false);
      toast({ variant: 'destructive', title: 'Error', description: 'Institute ID is missing.' });
      router.push('/'); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId]);

  async function fetchInstituteDetails() {
    if (!instituteId) return;
    setIsLoading(true);
    try {
      const instituteRef = doc(db, 'institutes', instituteId);
      const docSnap = await getDoc(instituteRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Institute;
        setInstitute({ ...data, id: docSnap.id });
        form.reset({
          name: data.name,
          address: data.address || '',
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone || '',
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Institute not found.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch institute details.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(values: InstituteSettingsFormData) {
    if (!instituteId) return;
    setIsSubmitting(true);
    try {
      const instituteRef = doc(db, 'institutes', instituteId);
      await updateDoc(instituteRef, {
        ...values,
        // updatedAt: serverTimestamp(), // Consider adding this if tracking updates is important
      });
      toast({ title: 'Settings Updated', description: 'Institute details saved successfully.' });
      fetchInstituteDetails(); 
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update settings.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleLogoUpload = async () => {
    if (!logoFile || !instituteId) {
      toast({ variant: "destructive", title: "Upload Error", description: "No logo file selected or institute ID missing." });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const filePath = `institutes/${instituteId}/logos/${logoFile.name}`;
      const logoStorageRef = storageRef(storage, filePath);
      await uploadBytes(logoStorageRef, logoFile);
      const downloadURL = await getDownloadURL(logoStorageRef);

      const instituteRef = doc(db, 'institutes', instituteId);
      await updateDoc(instituteRef, { logoUrl: downloadURL });

      toast({ title: "Logo Uploaded", description: "Institute logo updated successfully." });
      setInstitute(prev => prev ? { ...prev, logoUrl: downloadURL } : null);
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
    } catch (error) {
      toast({ variant: "destructive", title: "Logo Upload Failed", description: "Could not upload logo." });
    } finally {
      setIsUploadingLogo(false);
    }
  };
  
  if (isLoading) return <div className="flex justify-center items-center h-64"><p className="text-lg">Loading institute settings...</p></div>;
  if (!instituteId || !institute) return <p className="text-destructive text-center p-4">Institute data could not be loaded. Please ensure you are logged in or try again later.</p>;

  return (
    <div className="space-y-8">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Building className="h-6 w-6 text-primary"/>Institute Profile</CardTitle>
          <CardDescription>Manage your institute&apos;s general information and branding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Institute Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </Form>
          
          <div className="pt-6">
            <h3 className="text-lg font-semibold mb-2">Institute Logo</h3>
            <CardDescription className="mb-4">Upload or update your institute&apos;s logo (PNG, JPG, SVG recommended).</CardDescription>
            {institute.logoUrl && (
              <div className="mb-4 p-4 border rounded-md bg-muted/30 inline-block">
                <p className="font-medium mb-2 text-sm">Current Logo:</p>
                <Image src={institute.logoUrl} alt={`${institute.name} Logo`} width={120} height={120} className="rounded-md border object-contain bg-background shadow-sm" data-ai-hint="institute logo"/>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Input type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef} onChange={(e) => e.target.files && setLogoFile(e.target.files[0])} className="max-w-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>
              <Button onClick={handleLogoUpload} disabled={!logoFile || isUploadingLogo} className="w-full sm:w-auto">
                <UploadCloud className="mr-2 h-4 w-4"/> {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
              </Button>
            </div>
            {logoFile && <p className="text-sm text-muted-foreground mt-2">Selected: {logoFile.name}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-t-4 border-accent">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><LinkIcon className="h-6 w-6 text-accent"/>LMS & External Integrations</CardTitle>
          <CardDescription>Connect AttendEase with your existing systems for a streamlined workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Alert variant="default" className="bg-accent/10 border-accent/30">
                <LinkIcon className="h-5 w-5 text-accent" />
                <AlertTitle className="text-accent font-semibold">LMS Integration (Coming Soon)</AlertTitle>
                <AlertDescription className="text-accent/80">
                    We are actively developing integrations with popular Learning Management Systems like Brightspace, Moodle, Canvas, and others. 
                    This will enable seamless synchronization of student rosters, class schedules, and attendance data, reducing manual data entry and ensuring consistency across platforms.
                    Stay tuned for updates on specific LMS connectors and availability!
                </AlertDescription>
            </Alert>

            <Alert variant="default" className="bg-secondary/50 border-secondary/70">
                <Settings2 className="h-5 w-5 text-secondary-foreground" />
                <AlertTitle className="text-secondary-foreground font-semibold">API & Webhooks for Custom Integrations (Future Development)</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                    AttendEase aims to provide a flexible integration pathway for your institution's unique ecosystem. We are planning to develop:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li><strong>RESTful API:</strong> A comprehensive API will allow your developers to programmatically access and manage data within AttendEase, including student information, class schedules, and attendance records. This can be used to build custom dashboards, automate administrative tasks, or synchronize with proprietary internal systems.</li>
                        <li><strong>Webhooks:</strong> Configure webhooks to receive real-time notifications about events in AttendEase (e.g., new student registration, attendance session completion). This enables your other applications to react instantly to changes, facilitating automated workflows and data synchronization.</li>
                    </ul>
                     <p className="mt-2">This will provide the tools needed for deeper integration with student information systems (SIS), HR platforms, or other institutional software. Detailed developer documentation will be provided upon release.</p>
                </AlertDescription>
            </Alert>
        </CardContent>
      </Card>

    </div>
  );
}

