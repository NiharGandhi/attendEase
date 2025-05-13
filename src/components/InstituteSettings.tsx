
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription as FormDesc, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Institute, InstituteSettingsFormData } from '@/lib/types';
import { instituteSettingsFormSchema } from '@/lib/types';
import { UploadCloud, Building, LinkIcon as LinkExternalIcon, Save, Settings2, Webhook, DatabaseZap, TerminalSquare } from 'lucide-react';
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
      webhookUrl: '',
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
          webhookUrl: data.webhookUrl || '',
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Institute not found.' });
        router.push('/');
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
      const dataToUpdate: Partial<Institute> = {
        name: values.name,
        address: values.address,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        webhookUrl: values.webhookUrl || null, 
      };
      await updateDoc(instituteRef, dataToUpdate);
      toast({ title: 'Settings Updated', description: 'Institute details saved successfully.' });
      setInstitute(prev => ({ ...prev, ...dataToUpdate } as Institute)); // Update local state
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
              
              <div className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Institute Logo</h3>
                <CardDescription className="mb-4">Upload or update your institute&apos;s logo (PNG, JPG, SVG recommended).</CardDescription>
                {institute.logoUrl && (
                  <div className="mb-4 p-4 border rounded-md bg-muted/30 inline-block">
                    <p className="font-medium mb-2 text-sm">Current Logo:</p>
                    <Image src={institute.logoUrl} alt={`${institute.name} Logo`} width={120} height={120} className="rounded-md border object-contain bg-background shadow-sm" data-ai-hint="institute logo" unoptimized/>
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
               <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto mt-6">
                <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save General Changes'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-t-4 border-accent">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Webhook className="h-6 w-6 text-accent"/>External Integrations & Data Export</CardTitle>
          <CardDescription>Configure webhooks and learn about API and system integrations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <Form {...form}> {/* Use the same form instance */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="webhookUrl"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Attendance Data Webhook URL</FormLabel>
                        <FormControl><Input type="url" placeholder="https://your-service.com/webhook-receiver" {...field} value={field.value ?? ''} /></FormControl>
                        <FormDesc>
                            If configured, AttendEase will POST attendance data (upon manual trigger from reports page) to this URL. 
                            This allows you to integrate attendance information into your custom dashboards or external systems. Ensure the endpoint can handle JSON payloads.
                        </FormDesc>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
                    <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving Webhook...' : 'Save Webhook Configuration'}
                </Button>
            </form>
          </Form>

             <Alert variant="default" className="bg-purple-50 border-purple-200 text-purple-700">
                <TerminalSquare className="h-5 w-5 !text-purple-700" />
                <AlertTitle className="font-semibold !text-purple-700">AttendEase API Endpoints</AlertTitle>
                <AlertDescription className="!text-purple-700/90">
                    AttendEase provides RESTful API endpoints for programmatic access to your institute&apos;s data. 
                    This allows for custom integrations and automation.
                    <p className="mt-2 text-xs">Base URL: <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code></p>
                    <strong className="block mt-2 text-xs">Available Endpoints:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                        <li><code>GET /institutes</code> - List all institutes (paginated).</li>
                        <li><code>GET /institutes/&#123;instituteId&#125;</code> - Get details for a specific institute.</li>
                        <li><code>GET /institutes/&#123;instituteId&#125;/students</code> - List students for an institute (paginated).</li>
                        <li><code>GET /students/&#123;studentId&#125;</code> - Get details for a specific student.</li>
                        <li><code>GET /institutes/&#123;instituteId&#125;/scheduled-classes</code> - List scheduled classes for an institute (paginated).</li>
                        <li><code>GET /scheduled-classes/&#123;classId&#125;/attendance</code> - Get attendance records for a class (paginated, supports date filter).</li>
                    </ul>
                    <p className="mt-2 text-xs">
                        <strong>Note:</strong> These are read-only endpoints. Write operations and more comprehensive API access are planned for future development. Authentication/authorization mechanisms will be required for secure access.
                    </p>
                </AlertDescription>
            </Alert>

            <Alert variant="default" className="bg-accent/10 border-accent/30 mt-8">
                <LinkExternalIcon className="h-5 w-5 text-accent" />
                <AlertTitle className="text-accent font-semibold">LMS Integration (Planned)</AlertTitle>
                <AlertDescription className="text-accent/80">
                    We are actively developing integrations with popular Learning Management Systems (LMS) like Brightspace, Moodle, Canvas, and others. 
                    This will enable seamless synchronization of student rosters, class schedules, and attendance data, reducing manual data entry and ensuring consistency across platforms.
                    Stay tuned for updates on specific LMS connectors and availability!
                </AlertDescription>
            </Alert>
            
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
                <DatabaseZap className="h-5 w-5 !text-blue-700" />
                <AlertTitle className="font-semibold !text-blue-700">Student Information System (SIS) Integration (Planned)</AlertTitle>
                <AlertDescription className="!text-blue-700/90">
                    We understand the importance of integrating with your central Student Information System. 
                    Future development will focus on providing pathways for synchronization with common SIS platforms.
                    This could involve:
                     <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                        <li>Automated import/sync of student rosters and course enrollments from your SIS.</li>
                        <li>Export of attendance data back to your SIS for official record-keeping and reporting.</li>
                        <li>Standardized data formats (e.g., CSV, LIS) and potential direct API integrations where feasible.</li>
                    </ul>
                    <p className="mt-1 text-xs">Our goal is to make AttendEase a complementary tool that enhances your existing SIS by automating the attendance process.</p>
                </AlertDescription>
            </Alert>

        </CardContent>
      </Card>

    </div>
  );
}
