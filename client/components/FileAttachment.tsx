'use client';

import React, { useState } from 'react';
import { Download, ExternalLink, FileText, Globe, Image } from 'lucide-react';
import { Attachment } from '@/types';
import { getFileIcon } from '@/utils/formatters';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

interface FileAttachmentProps {
  attachment: Attachment;
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isImage = attachment.type === 'image' || 
    attachment.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/);
  
  const isWebpage = attachment.type === 'webpage' ||
    (attachment.filename.toLowerCase().endsWith('.html') && !attachment.filename.toLowerCase().endsWith('.csv'));

  const isDownloadable = ['code', 'data', 'document', 'script', 'config'].includes(attachment.type) ||
    attachment.filename.toLowerCase().endsWith('.csv') ||
    attachment.filename.toLowerCase().endsWith('.nc');

  const handleClick = () => {
    // Force CSV and NetCDF files to download, never open in iframe
    if (attachment.filename.toLowerCase().endsWith('.csv') ||
        attachment.filename.toLowerCase().endsWith('.nc')) {
      handleDownload();
    } else if (isWebpage || isImage) {
      setIsModalOpen(true);
    } else if (isDownloadable) {
      handleDownload();
    } else {
      window.open(attachment.url, '_blank');
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPreviewIcon = () => {
    if (isImage) return <Image className="h-4 w-4" />;
    if (isWebpage) return <Globe className="h-4 w-4" />;
    if (isDownloadable) return <FileText className="h-4 w-4" />;
    return <ExternalLink className="h-4 w-4" />;
  };

  const renderPreview = () => {
    if (isImage) {
      return (
        <img 
          src={attachment.url} 
          alt={attachment.filename}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            // Fallback to icon if image fails to load
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
      );
    }
    
    if (isWebpage) {
      // Check if it's a map/temperature visualization based on filename
      const isTemperatureMap = attachment.filename.toLowerCase().includes('temperature') || 
                              attachment.filename.toLowerCase().includes('temp') ||
                              attachment.filename.toLowerCase().includes('hotspot') ||
                              attachment.filename.toLowerCase().includes('map');
      
      if (isTemperatureMap) {
        return (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-yellow-600 rounded-lg relative overflow-hidden">
            {/* Temperature map visualization */}
            <div className="absolute inset-0 p-1">
              {/* Hot spots */}
              <div className="absolute top-1 left-2 w-2 h-2 bg-red-700 rounded-full opacity-90 animate-pulse"></div>
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-80"></div>
              <div className="absolute bottom-2 left-1 w-1.5 h-1.5 bg-orange-500 rounded-full opacity-70"></div>
              <div className="absolute bottom-1 right-3 w-2.5 h-2.5 bg-red-800 rounded-full opacity-95 animate-pulse"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-200 rounded-full opacity-85"></div>
              <div className="absolute top-3 left-1/3 w-1 h-1 bg-red-600 rounded-full opacity-75"></div>
              <div className="absolute bottom-1/3 right-1 w-1 h-1 bg-orange-600 rounded-full opacity-60"></div>
            </div>
            <div className="absolute bottom-0.5 left-1 right-1 text-center">
              <span className="text-white text-[6px] font-bold bg-black/30 px-1 py-0.5 rounded-sm">🌡️ MAP</span>
            </div>
          </div>
        );
      }
      
      // Generic webpage visualization
      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="h-4 w-4 text-white opacity-90" />
          </div>
          <div className="absolute bottom-0.5 left-1 right-1 text-center">
            <span className="text-white text-[6px] font-bold bg-black/30 px-1 py-0.5 rounded-sm">📊 VIZ</span>
          </div>
        </div>
      );
    }
    
    if (attachment.type === 'data') {
      // Special visualization for NetCDF files
      if (attachment.filename.toLowerCase().endsWith('.nc')) {
        return (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 via-teal-500 to-cyan-400 rounded-lg relative overflow-hidden">
            {/* Ocean data visualization with animated dots */}
            <div className="absolute inset-0 p-1">
              {/* Animated ocean data points */}
              <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-cyan-200 rounded-full opacity-90 animate-pulse"></div>
              <div className="absolute top-2 right-2 w-1 h-1 bg-blue-200 rounded-full opacity-80 animate-bounce delay-100"></div>
              <div className="absolute bottom-2 left-1 w-1 h-1 bg-teal-200 rounded-full opacity-70 animate-pulse delay-200"></div>
              <div className="absolute bottom-1 right-3 w-2 h-2 bg-blue-300 rounded-full opacity-95 animate-bounce delay-300"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-300 rounded-full opacity-85 animate-pulse delay-150"></div>
              <div className="absolute top-3 left-1/3 w-1 h-1 bg-teal-300 rounded-full opacity-75 animate-bounce delay-400"></div>
              <div className="absolute bottom-1/3 right-1 w-1 h-1 bg-blue-400 rounded-full opacity-60 animate-pulse delay-500"></div>
            </div>
            <div className="absolute bottom-0.5 left-1 right-1 text-center">
              <span className="text-white text-[6px] font-bold bg-black/30 px-1 py-0.5 rounded-sm">🌊 NetCDF</span>
            </div>
          </div>
        );
      }

      // Special visualization for DuckDB query CSV files
      if (attachment.filename.toLowerCase().includes('duckdb') && attachment.filename.toLowerCase().endsWith('.csv')) {
        return (
          <div className="w-full h-full bg-gradient-to-br from-purple-600 via-indigo-500 to-blue-500 rounded-lg relative overflow-hidden">
            {/* SQL query visualization with animated elements */}
            <div className="absolute inset-0 p-1">
              {/* Animated SQL query symbols */}
              <div className="absolute top-1 left-1 text-white text-[8px] opacity-90 animate-pulse">SELECT</div>
              <div className="absolute top-2 right-1 text-blue-200 text-[6px] opacity-80 animate-bounce delay-100">FROM</div>
              <div className="absolute bottom-2 left-1 text-purple-200 text-[6px] opacity-70 animate-pulse delay-200">WHERE</div>
              <div className="absolute bottom-1 right-2 text-indigo-200 text-[6px] opacity-95 animate-bounce delay-300">ORDER BY</div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-yellow-300 rounded-full opacity-85 animate-pulse delay-150"></div>
            </div>
            <div className="absolute bottom-0.5 left-1 right-1 text-center">
              <span className="text-white text-[6px] font-bold bg-black/30 px-1 py-0.5 rounded-sm">🦆 DuckDB</span>
            </div>
          </div>
        );
      }

      // Generic data visualization
      return (
        <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
          <div className="text-white text-center">
            <div className="flex space-x-0.5 mb-1 justify-center">
              <div className="w-1 h-2 bg-white rounded-full"></div>
              <div className="w-1 h-3 bg-white rounded-full"></div>
              <div className="w-1 h-1.5 bg-white rounded-full"></div>
              <div className="w-1 h-4 bg-white rounded-full"></div>
            </div>
            <span className="text-[6px] font-bold">DATA</span>
          </div>
        </div>
      );
    }
    
    // Default fallback with icon
    return (
      <div className="w-full h-full bg-gradient-to-br from-amber-300 to-orange-400 rounded-lg flex items-center justify-center">
        <span className="text-2xl">{getFileIcon(attachment.type)}</span>
      </div>
    );
  };

  return (
    <>
      <div 
        onClick={handleClick}
        className="inline-flex items-center gap-3 p-3 bg-gradient-to-r from-amber-600/90 to-orange-500/90 hover:from-amber-500/95 hover:to-orange-400/95 border border-amber-400/60 rounded-xl cursor-pointer transition-all duration-200 group max-w-sm backdrop-blur-sm hover:border-orange-300/70 hover:shadow-lg hover:shadow-amber-500/30"
      >
        <div className="flex-shrink-0 w-12 h-8 overflow-hidden relative">
          {renderPreview()}
          {/* Fallback icon container (hidden by default) */}
          <div className="w-full h-full flex items-center justify-center absolute inset-0 bg-gradient-to-br from-amber-300 to-orange-400 rounded-lg" style={{display: 'none'}}>
            <span className="text-xl">{getFileIcon(attachment.type)}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate group-hover:text-yellow-100 transition-colors drop-shadow-sm">
            {attachment.filename}
          </div>
          <div className="text-xs text-yellow-200 capitalize font-medium tracking-wide drop-shadow-sm">
            {attachment.type}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-white group-hover:text-yellow-100 transition-colors drop-shadow-sm">
            {getPreviewIcon()}
          </div>
          {isDownloadable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              disabled={isLoading}
              className="p-1 h-6 w-6"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isWebpage ? attachment.filename : ""}
        className={isWebpage ? "max-w-6xl" : "max-w-4xl"}
      >
        <div className={isWebpage ? "p-6" : "p-0"}>
          {isWebpage && (
            <div className="relative">
              <iframe
                src={attachment.url}
                className="w-full h-[80vh] border-0 rounded-xl bg-gray-50"
                title={attachment.filename}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(attachment.url, '_blank')}
                className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white border-gray-300 shadow-lg"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isImage && (
            <div className="flex items-center justify-center bg-black/90 rounded-lg">
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}