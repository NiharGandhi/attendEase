
"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Users, ShieldCheck, BarChartBig, ArrowRight, LogIn } from 'lucide-react';

const features = [
  {
    icon: <CheckSquare className="h-10 w-10 text-accent" />,
    title: 'Automated Attendance',
    description: 'Effortlessly track student attendance using cutting-edge facial recognition technology.',
  },
  {
    icon: <Users className="h-10 w-10 text-accent" />,
    title: 'Institute & User Management',
    description: 'Easily register your institute, manage employees, classrooms, and student data in one place.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-accent" />,
    title: 'Secure & Reliable',
    description: 'Built with security in mind, ensuring data privacy and accurate attendance records.',
  },
  {
    icon: <BarChartBig className="h-10 w-10 text-accent" />,
    title: 'Scalable Solution',
    description: 'Designed to scale from small departments to large university campuses with ease.',
  },
];

export default function LandingPage() {
  const [currentYear, setCurrentYear] = React.useState<number | null>(null);

  React.useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <header className="py-4 px-6 shadow-sm bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" passHref>
            <h1 className="text-2xl font-bold text-primary cursor-pointer">AttendEase</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" passHref>
              <Button variant="ghost">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
            <Link href="/register" passHref>
              <Button variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground border-accent hover:border-accent/90">
                Register Institute
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-16 md:py-24 bg-secondary/50">
          <div className="container mx-auto px-6 text-center">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="md:text-left">
                <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
                  AttendEase: Smart Attendance, Simplified.
                </h2>
                <p className="text-lg md:text-xl text-foreground mb-8">
                  Leverage the power of facial recognition for seamless university attendance tracking. Register your institute and transform your attendance management.
                </p>
                <Link href="/register" passHref>
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src="https://picsum.photos/600/400"
                  alt="Smart attendance system illustration"
                  fill
                  style={{objectFit:"cover"}}
                  data-ai-hint="classroom technology"
                  priority
                />
                 <div className="absolute inset-0 bg-primary/30 mix-blend-multiply"></div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            <h3 className="text-3xl font-bold text-primary text-center mb-12">
              Why Choose AttendEase?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
                  <CardHeader className="items-center text-center">
                    {feature.icon}
                    <CardTitle className="mt-4 text-xl text-primary">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; {currentYear !== null ? currentYear : 'Loading...'} AttendEase. All rights reserved.</p>
          <p className="text-sm opacity-80 mt-1">Revolutionizing attendance with smart technology.</p>
        </div>
      </footer>
    </div>
  );
}
