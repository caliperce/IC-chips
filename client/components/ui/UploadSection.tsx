'use client';

import React from 'react';
import { ImageIcon, UploadIcon, XIcon } from 'lucide-react';
import { Button } from './button';

import type { FileWithPreview } from '@/hooks/use-file-upload';

interface UploadSectionProps {
  files: FileWithPreview[];
  isDragging: boolean;
  maxFiles: number;
  maxSizeMB: number;
  onDragEnter: (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  onRemoveFile: (id: string) => void;
  onOpenFileDialog: () => void;
  getInputProps: () => any;
  className?: string;
}

export function UploadSection({
  files,
  isDragging,
  maxFiles,
  maxSizeMB,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRemoveFile,
  onOpenFileDialog,
  getInputProps,
  className = '',
}: UploadSectionProps) {
  return (
    <div className={`bg-[#111728] rounded-2xl p-8 border-2 border-dashed border-gray-600 ${className}`}>
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        data-dragging={isDragging || undefined}
        className="relative data-[dragging=true]:bg-gray-700/20 transition-colors"
      >
        <input {...getInputProps()} className="sr-only" aria-label="Upload chip image" />

        {files.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">
                Uploaded Files ({files.length}/{maxFiles})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenFileDialog}
                disabled={files.length >= maxFiles}
                className="text-gray-300 border-gray-600 hover:bg-gray-700"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Add more
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {files.map((file) => (
                <div key={file.id} className="relative aspect-square rounded-lg border border-gray-600 bg-gray-800/50 overflow-hidden">
                  <img
                    src={file.preview}
                    alt={file.file instanceof File ? file.file.name : file.file.name}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    onClick={() => onRemoveFile(file.id)}
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full border-2 border-gray-700 bg-red-600 hover:bg-red-700 shadow-lg"
                    aria-label="Remove image"
                  >
                    <XIcon className="h-3 w-3 text-white" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700/50 border border-gray-600">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-base font-medium text-gray-200">Upload Chip Image</h3>
            <p className="mb-1 text-sm text-gray-400">Drag and drop or click to upload a file</p>
            <p className="text-xs text-gray-500 mb-6">PNG or JPG (max. {maxSizeMB}MB per file)</p>
            <Button
              onClick={onOpenFileDialog}
              className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white"
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}