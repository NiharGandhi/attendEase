
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
import { UploadCloud, Building, Save, Settings2, Webhook, DatabaseZap, TerminalSquare, BookOpenCheck, Link as LinkIcon, KeyRound, FileText, Shuffle } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
  
  const handleLmsIntegration = (lmsName: string) => {
    toast({
      title: `${lmsName} Integration (Coming Soon)`,
      description: `We are actively working on integrating AttendEase with ${lmsName} and other popular Learning Management Systems. This will enable seamless synchronization of student rosters, class schedules, and attendance data. Stay tuned for updates!`,
      duration: 7000,
    });
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
          <CardTitle className="text-2xl flex items-center gap-2"><Settings2 className="h-6 w-6 text-accent"/>Integrations & Connectivity</CardTitle>
          <CardDescription>Configure webhooks, API access, and Learning Management System (LMS) / Student Information System (SIS) integrations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            {/* Webhook Configuration */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2"><Webhook className="h-5 w-5 text-accent"/>Data Export Webhook</h3>
                <Form {...form}> {/* Use the same form instance for webhook */}
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="webhookUrl"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Attendance Data Webhook URL</FormLabel>
                                <FormControl><Input type="url" placeholder="https://your-service.com/webhook-receiver" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDesc>
                                    If configured, AttendEase will POST attendance data (upon manual trigger from reports page) to this URL. 
                                    This allows you to integrate attendance information into your custom dashboards or external systems. Ensure the endpoint can handle JSON payloads containing student IDs, timestamps, course codes, and status.
                                </FormDesc>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving Webhook...' : 'Save Webhook Configuration'}
                        </Button>
                    </form>
                </Form>
                 <Alert variant="default" className="mt-4 bg-teal-50 border-teal-200 text-teal-700">
                    <Webhook className="h-4 w-4 !text-teal-700" />
                    <AlertTitle>Real-time Webhooks (Planned)</AlertTitle>
                    <AlertDescription>
                        Future enhancements will include options for real-time webhook notifications upon specific attendance events (e.g., student marked present/absent).
                    </AlertDescription>
                </Alert>
            </div>

            <Separator className="my-8"/>

            {/* API Access Section */}
            <div className="space-y-4">
                 <h3 className="text-xl font-semibold flex items-center gap-2"><TerminalSquare className="h-5 w-5 text-primary"/>AttendEase API Access</h3>
                 <CardDescription>
                    AttendEase provides RESTful API endpoints for programmatic access to your institute&apos;s data. 
                    This allows for custom integrations and automation. Authentication is required for API access.
                </CardDescription>
                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
                    <KeyRound className="h-4 w-4 !text-blue-700" />
                    <AlertTitle>API Authentication (OAuth 2.0 / API Keys)</AlertTitle>
                    <AlertDescription>
                        Secure access to the API is managed via OAuth 2.0 or API keys. Institutions can generate and manage their API credentials through a dedicated developer portal (coming soon).
                        <p className="mt-2"><strong>Base URL:</strong> <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code></p>
                        <p className="mt-1 text-xs">Refer to API documentation for available endpoints (e.g., fetching attendance, student data, course info) and authentication methods.</p>
                         <Button variant="outline" size="sm" className="mt-3" onClick={() => toast({title: "Developer Portal", description: "Developer portal with API key management and detailed documentation is under development."})}>
                            Access Developer Portal (Coming Soon)
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>

            <Separator className="my-8"/>

            {/* LMS Integrations Section */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-primary"/>Learning Management System (LMS) Integrations</h3>
                <CardDescription className="mb-4">
                    Connect AttendEase with your existing LMS to streamline data synchronization for student rosters, class schedules, and attendance records. Support for various LMS APIs (e.g., Brightspace Valence) is planned.
                </CardDescription>
                
                <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h4 className="font-semibold">Brightspace by D2L</h4>
                                <p className="text-sm text-muted-foreground">Integrate with your Brightspace (Valence API).</p>
                            </div>
                            <Button onClick={() => handleLmsIntegration('Brightspace')} variant="outline">
                                <LinkIcon className="mr-2 h-4 w-4" /> Configure Brightspace
                            </Button>
                        </div>
                    </Card>
                     <Card className="p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h4 className="font-semibold">Moodle</h4>
                                <p className="text-sm text-muted-foreground">Connect to your Moodle instance.</p>
                            </div>
                            <Button onClick={() => handleLmsIntegration('Moodle')} variant="outline">
                                <LinkIcon className="mr-2 h-4 w-4" /> Configure Moodle
                            </Button>
                        </div>
                    </Card>
                     <Card className="p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h4 className="font-semibold">Canvas by Instructure</h4>
                                <p className="text-sm text-muted-foreground">Link with your Canvas platform.</p>
                            </div>
                            <Button onClick={() => handleLmsIntegration('Canvas')} variant="outline">
                               <LinkIcon className="mr-2 h-4 w-4" /> Configure Canvas
                            </Button>
                        </div>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h4 className="font-semibold">Other LMS Platforms</h4>
                                <p className="text-sm text-muted-foreground">More integrations coming soon.</p>
                            </div>
                             <Button onClick={() => handleLmsIntegration('Other LMS')} variant="outline" disabled>
                                More Coming Soon
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            <Separator className="my-8"/>
            
            {/* SIS Integration Information */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-green-600"/>Student Information System (SIS) Integration</h3>
                <CardDescription>
                    Integrate AttendEase with your central Student Information System for comprehensive data management. Options include Ed-Fi standard support, CSV exports, and potential SFTP batch processing.
                </CardDescription>
                 <Alert variant="default" className="bg-green-50 border-green-200 text-green-700">
                    <DatabaseZap className="h-5 w-5 !text-green-700" />
                    <AlertTitle className="font-semibold !text-green-700">Ed-Fi Standard & Data Exchange</AlertTitle>
                    <AlertDescription className="!text-green-700/90">
                        We aim to support Ed-Fi Alliance data standards for interoperability with SIS platforms.
                         <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                            <li>Automated import/sync of student rosters and course enrollments.</li>
                            <li>Export of attendance data back to your SIS.</li>
                        </ul>
                        <Button variant="outline" size="sm" className="mt-3 text-green-700 border-green-300 hover:bg-green-100" onClick={() => toast({title: "Ed-Fi Integration", description: "Detailed Ed-Fi integration capabilities are under development."})}>
                           Learn More (Coming Soon)
                        </Button>
                    </AlertDescription>
                </Alert>
                <Card className="p-4 bg-muted/30 mt-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4"/>CSV Exports / SFTP Batch Processing</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                        For legacy systems or specific SIS requirements, AttendEase will support CSV data exports of attendance logs. Secure File Transfer Protocol (SFTP) options for batch processing are also planned.
                    </p>
                    <Button variant="outline" onClick={() => toast({title: "Data Export Options", description: "Configuration for CSV exports and SFTP batch processing will be available here."})}>
                        Configure Data Export (Coming Soon)
                    </Button>
                </Card>
                <Card className="p-4 bg-muted/30 mt-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Shuffle className="h-4 w-4"/>ID Mapping</h4>
                    <p className="text-sm text-muted-foreground">
                        Institutions will be able to map their internal student and course identifiers to AttendEase&apos;s schema to ensure data consistency during synchronization with LMS/SIS.
                    </p>
                     <Button variant="outline" className="mt-3" onClick={() => toast({title: "ID Mapping", description: "ID mapping configuration tool is under development."})}>
                        Configure ID Mapping (Coming Soon)
                    </Button>
                </Card>
            </div>

            <Separator className="my-8"/>

            <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-red-600"/>Security & Compliance</h3>
                 <CardDescription>
                    AttendEase is committed to data security and compliance with educational data privacy regulations.
                </CardDescription>
                <Alert variant="destructive" className="bg-red-50 border-red-200 !text-red-700">
                    <AlertTriangle className="h-4 w-4 !text-red-700"/>
                    <AlertTitle className="!text-red-700">Data Security & Privacy</AlertTitle>
                    <AlertDescription className="!text-red-700/90">
                        Sensitive data, including student facial information (via Face++ tokens) and personal identifiers, is handled with care. Firestore security rules and storage encryption are utilized. We are working towards FERPA and GDPR compliance guidelines. For detailed information on data handling practices, please refer to our privacy policy and security documentation (coming soon).
                    </AlertDescription>
                </Alert>
            </div>


        </CardContent>
      </Card>

    </div>
  );
}

