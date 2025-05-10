"use client";

import React from 'react';
import type { AttendanceRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle } from "lucide-react";
import { format } from 'date-fns';

interface AttendanceListProps {
  records: AttendanceRecord[];
  recognizedStudentsForInterval: string[];
}

const AttendanceList: React.FC<AttendanceListProps> = ({ records, recognizedStudentsForInterval }) => {
  const sortedRecords = [...records].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-primary flex items-center">
          <Users className="mr-2 h-5 w-5 text-accent" />
          Attendance Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recognizedStudentsForInterval.length > 0 && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent rounded-md">
            <h3 className="text-sm font-medium text-accent flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 animate-pulse" />
              Recognized in current scan:
            </h3>
            <ul className="list-disc list-inside ml-4 text-sm text-accent">
              {recognizedStudentsForInterval.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <ScrollArea className="h-[200px] sm:h-[250px] md:h-[300px] pr-3">
          {sortedRecords.length === 0 && recognizedStudentsForInterval.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Users className="h-12 w-12 mb-2 text-primary opacity-50" />
              <p>No attendance records yet.</p>
              <p className="text-sm">Recognized students will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record, index) => (
                  <TableRow key={`${record.studentName}-${record.timestamp.toISOString()}-${index}`} className="hover:bg-secondary/50">
                    <TableCell className="font-medium">{record.studentName}</TableCell>
                    <TableCell>{format(record.timestamp, 'Pp')}</TableCell>
                    <TableCell>
                      <Badge variant={record.status === 'present' ? 'default' : 'destructive'} className={record.status === 'present' ? 'bg-accent text-accent-foreground' : ''}>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AttendanceList;
