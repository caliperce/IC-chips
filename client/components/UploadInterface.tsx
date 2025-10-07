'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/upload-history-table/data-table';
import { columns, UploadHistoryItem } from '@/components/upload-history-table/columns';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UploadInterfaceProps {
  onFilesUploaded?: (files: File[]) => void;
  maxFileSize?: number; // in MB
  className?: string;
}

const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/x-netcdf': ['.nc', '.netcdf'],
  'application/parquet': ['.parquet'],
  'application/octet-stream': ['.parquet', '.nc', '.netcdf'] // fallback for binary formats
};

const ACCEPTED_EXTENSIONS = ['.csv', '.nc', '.netcdf', '.parquet'];

export function UploadInterface({
  onFilesUploaded,
  maxFileSize = 500, // 500MB default
  className
}: UploadInterfaceProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([
    {
      id: 'sample-1',
      fileName: 'argo_indian_ocean_temperature_2024.nc',
      fileType: 'nc',
      fileSize: 42850000, // ~42.8 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 25, 14, 30, 0) // Dec 25, 2024, 2:30 PM
    },
    {
      id: 'sample-2',
      fileName: 'indian_ocean_salinity_profiles_2023.csv',
      fileType: 'csv',
      fileSize: 8750000, // ~8.75 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 25, 13, 15, 0) // Dec 25, 2024, 1:15 PM
    },
    {
      id: 'sample-3',
      fileName: 'argo_float_3901234_profiles.nc',
      fileType: 'nc',
      fileSize: 15600000, // ~15.6 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 24, 16, 45, 0) // Dec 24, 2024, 4:45 PM
    },
    {
      id: 'sample-4',
      fileName: 'temperature_depth_analysis_2024.csv',
      fileType: 'csv',
      fileSize: 3200000, // ~3.2 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 24, 10, 20, 0) // Dec 24, 2024, 10:20 AM
    },
    {
      id: 'sample-5',
      fileName: 'argo_bgc_oxygen_measurements.nc',
      fileType: 'nc',
      fileSize: 28900000, // ~28.9 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 23, 11, 30, 0) // Dec 23, 2024, 11:30 AM
    },
    {
      id: 'sample-6',
      fileName: 'indian_ocean_monthly_climatology.csv',
      fileType: 'csv',
      fileSize: 12400000, // ~12.4 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 23, 9, 15, 0) // Dec 23, 2024, 9:15 AM
    },
    {
      id: 'sample-7',
      fileName: 'argo_pressure_temperature_2021_2024.nc',
      fileType: 'nc',
      fileSize: 67200000, // ~67.2 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 22, 15, 0, 0) // Dec 22, 2024, 3:00 PM
    },
    {
      id: 'sample-8',
      fileName: 'surface_mixed_layer_depths.csv',
      fileType: 'csv',
      fileSize: 5800000, // ~5.8 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 22, 12, 45, 0) // Dec 22, 2024, 12:45 PM
    },
    {
      id: 'sample-9',
      fileName: 'argo_trajectory_float_locations.nc',
      fileType: 'nc',
      fileSize: 9300000, // ~9.3 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 21, 14, 10, 0) // Dec 21, 2024, 2:10 PM
    },
    {
      id: 'sample-10',
      fileName: 'quality_control_flags_analysis.csv',
      fileType: 'csv',
      fileSize: 2100000, // ~2.1 MB
      status: 'completed',
      progress: 100,
      uploadedAt: new Date(2024, 11, 21, 8, 30, 0) // Dec 21, 2024, 8:30 AM
    }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return `File type not supported. Please upload CSV, NetCDF (.nc), or Parquet files.`;
    }

    return null;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      const fileId = `${file.name}-${Date.now()}-${Math.random()}`;

      if (error) {
        // Add file with error status
        setUploadedFiles(prev => [...prev, {
          id: fileId,
          file,
          status: 'error',
          progress: 0,
          error
        }]);
      } else {
        validFiles.push(file);
        const uploadDate = new Date();

        // Add file to upload files list
        setUploadedFiles(prev => [...prev, {
          id: fileId,
          file,
          status: 'uploading',
          progress: 0
        }]);

        // Add file to upload history
        const fileExtension = file.name.split('.').pop() || 'unknown';
        setUploadHistory(prev => [{
          id: fileId,
          fileName: file.name,
          fileType: fileExtension,
          fileSize: file.size,
          status: 'uploading',
          progress: 0,
          uploadedAt: uploadDate
        }, ...prev]);

        // Show upload start toast
        toast({
          title: "Upload Started 📤",
          description: `Uploading ${file.name}...`,
        });

        // Simulate upload process
        simulateUpload(fileId, file);
      }
    });

    if (validFiles.length > 0 && onFilesUploaded) {
      onFilesUploaded(validFiles);
    }
  }, [maxFileSize, onFilesUploaded]);

  const simulateUpload = (fileId: string, file: File) => {
    let progress = 0;
    const startTime = Date.now();
    const duration = 5000; // 5 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      progress = Math.min((elapsed / duration) * 100, 100);

      // Update upload files progress
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, progress }
          : f
      ));

      // Update upload history progress
      setUploadHistory(prev => prev.map(item =>
        item.id === fileId
          ? { ...item, progress }
          : item
      ));

      if (progress >= 100) {
        clearInterval(interval);

        // Update upload files status
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'success', progress: 100 }
            : f
        ));

        // Update upload history status
        setUploadHistory(prev => prev.map(item =>
          item.id === fileId
            ? { ...item, status: 'completed', progress: 100 }
            : item
        ));

        // Show success toast
        toast({
          title: "Upload Completed! 🎉",
          description: `${file.name} has been uploaded successfully.`,
        });
      }
    }, 50); // More frequent updates for smoother animation
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadHistory(prev => prev.filter(f => f.id !== fileId));
  };

  const openFileBrowser = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.endsWith('.csv')) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    if (name.endsWith('.nc') || name.endsWith('.netcdf')) return <File className="h-5 w-5 text-blue-600" />;
    if (name.endsWith('.parquet')) return <File className="h-5 w-5 text-purple-600" />;
    return <File className="h-5 w-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300  hover:bg-gray-100"
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={cn(
            "p-4 rounded-full transition-colors",
            isDragOver ? "bg-blue-100" : "bg-white"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragOver ? "text-blue-600" : "text-gray-600"
            )} />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {isDragOver ? "Drop your files here" : "Upload Data Files"}
            </h3>
            <p className="text-gray-600">
              Drag and drop your files here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports CSV, NetCDF (.nc), and Parquet files up to {maxFileSize}MB each
            </p>
          </div>

          <Button
            onClick={openFileBrowser}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
          >
            Browse Files
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Upload History Table */}
      {uploadHistory.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900">Upload History</h4>
          <DataTable columns={columns} data={uploadHistory} />
        </div>
      )}
    </div>
  );
}