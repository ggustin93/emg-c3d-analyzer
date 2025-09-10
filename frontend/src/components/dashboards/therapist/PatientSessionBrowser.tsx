import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import { 
  FileIcon,
  CalendarIcon,
  ActivityLogIcon,
  EyeOpenIcon,
  ClockIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import SupabaseStorageService from '@/services/supabaseStorage';
import { useAuth } from '@/contexts/AuthContext';
import { TherapySessionsService, TherapySession } from '@/services/therapySessionsService';
import { logger, LogCategory } from '@/services/logger';
import { 
  C3DFile,
  resolvePatientId,
  resolveSessionDate,
  formatSessionDateTime
} from '@/services/C3DFileDataResolver';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from 'react-router-dom';

// Get bucket name from environment variable or use default
const BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';

interface PatientSessionBrowserProps {
  patientCode: string;
  onFileSelect?: (filename: string, uploadDate?: string) => void;
}

const PatientSessionBrowser: React.FC<PatientSessionBrowserProps> = ({
  patientCode,
  onFileSelect
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Core states
  const [files, setFiles] = useState<C3DFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session data state
  const [sessionData, setSessionData] = useState<Record<string, TherapySession>>({});

  // Load C3D files for this patient
  useEffect(() => {
    const loadPatientFiles = async () => {
      if (!user) {
        logger.logToTable('PatientSessionBrowser', 'No authenticated user', LogCategory.Auth);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        // Get all C3D files
        const fileList = await SupabaseStorageService.listC3DFiles(BUCKET_NAME);
        
        // Filter files for this patient
        const patientFiles = fileList.filter(file => {
          const patientId = resolvePatientId(file.name, file.metadata || {});
          return patientId === patientCode;
        });

        setFiles(patientFiles);
        
        // Load session data for these files
        const sessionService = new TherapySessionsService();
        const sessions: Record<string, TherapySession> = {};
        
        for (const file of patientFiles) {
          try {
            const session = await sessionService.getSessionByFileName(file.name);
            if (session) {
              sessions[file.name] = session;
            }
          } catch (err) {
            logger.logToTable('PatientSessionBrowser', `Failed to load session for ${file.name}`, LogCategory.Error, err);
          }
        }
        
        setSessionData(sessions);
      } catch (err) {
        logger.logToTable('PatientSessionBrowser', 'Failed to load patient files', LogCategory.Error, err);
        setError('Failed to load session files. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatientFiles();
  }, [user, patientCode]);

  // Sort files by date (newest first)
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const dateA = resolveSessionDate(a.name, a.metadata || {});
      const dateB = resolveSessionDate(b.name, b.metadata || {});
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [files]);

  const handleViewFile = (file: C3DFile) => {
    if (onFileSelect) {
      onFileSelect(file.name, file.created_at);
    } else {
      // Navigate to analysis view with the file
      navigate(`/analysis?file=${encodeURIComponent(file.name)}`);
    }
  };

  const getSessionStatus = (session?: TherapySession) => {
    if (!session) return { icon: <AlertCircleIcon className="h-4 w-4" />, text: 'Not Processed', variant: 'outline' as const };
    
    if (session.processing_status === 'completed') {
      return { icon: <CheckCircleIcon className="h-4 w-4" />, text: 'Completed', variant: 'success' as const };
    } else if (session.processing_status === 'processing') {
      return { icon: <ClockIcon className="h-4 w-4" />, text: 'Processing', variant: 'warning' as const };
    } else {
      return { icon: <XCircleIcon className="h-4 w-4" />, text: 'Failed', variant: 'destructive' as const };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center">
            <Spinner />
            <p className="mt-4 text-sm text-muted-foreground">Loading session files...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertCircleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedFiles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <FileIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h4>
            <p className="text-sm text-gray-500">
              No C3D files have been uploaded for patient {patientCode} yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session Date</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Contractions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiles.map((file) => {
                const session = sessionData[file.name];
                const status = getSessionStatus(session);
                const sessionDate = resolveSessionDate(file.name, file.metadata || {});
                
                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {sessionDate ? formatSessionDateTime(sessionDate) : 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        {status.icon}
                        {status.text}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session?.overall_performance_score ? (
                        <div className="flex items-center gap-2">
                          <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {Math.round(session.overall_performance_score)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session?.total_contractions ? (
                        <span className="text-sm">
                          {session.total_contractions}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewFile(file)}
                      >
                        <EyeOpenIcon className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientSessionBrowser;