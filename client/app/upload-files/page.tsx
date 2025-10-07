'use client';

import React, { useState } from 'react';
import { Database, Calendar as CalendarIcon, PanelLeftOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DatePicker } from '@/components/ui/date-picker';
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { UploadInterface } from '@/components/UploadInterface';
import { ERDDAPDataTable } from '@/components/erddap-pulls-table/data-table';
import { columns as erddapColumns, ERDDAPPull } from '@/components/erddap-pulls-table/columns';
import { SessionSidebar } from '@/components/SessionSidebar';
import { useRouter } from 'next/navigation';

interface ERDDAPFormData {
  startDate: Date | undefined;
  endDate: Date | undefined;
  labels: string[];
}

const LABELS = [
  "argo_core",
  "argo_bgc",
  "argo_trajectory",
  "argo_gridded_mld",
  "sea_surface_temperature",
  "sea_surface_salinity",
  "sea_level_altimetry",
  "chlorophyll_a",
  "surface_winds",
  "significant_wave_height",
  "surface_currents",
  "bathymetry",
  "hycom_model",
  "godas_reanalysis",
  "ecco_reanalysis"
];

export default function UploadFilesPage() {
  const [isERDDAPModalOpen, setIsERDDAPModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erddapPulls, setErddapPulls] = useState<ERDDAPPull[]>([]);
  const [formData, setFormData] = useState<ERDDAPFormData>({
    startDate: undefined,
    endDate: undefined,
    labels: []
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate || formData.labels.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select start date, end date, and at least one label.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    const pullId = `erddap-${Date.now()}`;

    // Create new ERDDAP pull entry
    const newPull: ERDDAPPull = {
      id: pullId,
      startDate: formData.startDate.toISOString(),
      endDate: formData.endDate.toISOString(),
      labels: [...formData.labels],
      status: 'processing',
      progress: 0,
      requestedAt: new Date(),
      estimatedSize: 'Calculating...'
    };

    setErddapPulls(prev => [newPull, ...prev]);
    setIsERDDAPModalOpen(false);

    toast({
      title: "ERDDAP Import Started 🌊",
      description: `Importing data from ${format(formData.startDate, 'MMM dd, yyyy')} to ${format(formData.endDate, 'MMM dd, yyyy')}`,
    });

    // Simulate 1-minute progress
    simulateErddapProgress(pullId);

    // Reset form
    setFormData({
      startDate: undefined,
      endDate: undefined,
      labels: []
    });
    setIsLoading(false);
  };

  const simulateErddapProgress = (pullId: string) => {
    let progress = 0;
    const startTime = Date.now();
    const duration = 60000; // 1 minute

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      progress = Math.min((elapsed / duration) * 100, 100);

      setErddapPulls(prev => prev.map(pull =>
        pull.id === pullId
          ? {
              ...pull,
              progress,
              estimatedSize: progress > 30 ? `~${Math.round(15 + progress * 0.5)}MB` : 'Calculating...'
            }
          : pull
      ));

      if (progress >= 100) {
        clearInterval(interval);
        setErddapPulls(prev => prev.map(pull =>
          pull.id === pullId
            ? { ...pull, status: 'completed', progress: 100, estimatedSize: '47.2 MB' }
            : pull
        ));

        toast({
          title: "ERDDAP Import Completed! ✅",
          description: "Your oceanographic data is ready for analysis.",
        });
      }
    }, 500); // Update every 500ms for smooth progress
  };

  const handleFilesUploaded = (files: File[]) => {
    console.log('Files uploaded:', files);
    // Handle the uploaded files here - could send to API, process, etc.
  };

  const handleSessionSelect = (sessionId: string) => {
    router.push(`/?session=${sessionId}`);
  };

  const handleNewChat = () => {
    router.push('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 overflow-hidden bg-white border-r border-gray-200`}>
          <SessionSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onSessionSelect={handleSessionSelect}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Sidebar Toggle Button */}
          {!isSidebarOpen && (
            <PanelLeftOpen
              onClick={() => setIsSidebarOpen(true)}
              className="fixed top-4 left-4 z-20 h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
            />
          )}

          {/* Top Bar with Title */}
          <div className="ml-8 sticky top-0 z-10 px-8 py-4 bg-white">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Upload Files</h1>
                <p className="text-gray-600 text-sm">Connect to data sources and upload oceanographic data files</p>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-4xl mx-auto">
              {/* ERDDAP Import Card - Top Priority */}
              <div className="mb-12">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow max-w-2xl mx-auto">
                  <div className="flex items-center mb-6">
                    <div className="p-4 bg-blue-100 rounded-lg">
                      <Database className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-semibold text-gray-900">Import from ERDDAP</h3>
                      <p className="text-gray-600 mt-1">
                        Access NOAA's ERDDAP service for oceanographic datasets including Argo float data
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsERDDAPModalOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Import from ERDDAP'}
                  </Button>
                </div>
              </div>

              {/* Upload Interface - Secondary */}
              <div className="mb-12">
                <UploadInterface
                  onFilesUploaded={handleFilesUploaded}
                  maxFileSize={500}
                  className="w-full"
                />
              </div>

              {/* ERDDAP Data Pulls section */}
              {erddapPulls.length > 0 && (
                <div className="mt-12">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">ERDDAP Data Pulls</h2>
                  <ERDDAPDataTable columns={erddapColumns} data={erddapPulls} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ERDDAP Import Modal */}
      <Modal
        isOpen={isERDDAPModalOpen}
        onClose={() => !isLoading && setIsERDDAPModalOpen(false)}
        title="Import from ERDDAP"
        className="w-[90vw] h-auto max-w-2xl max-h-[90vh]"
      >
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
          {/* Date Range Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <DatePicker
                date={formData.startDate}
                onSelect={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                placeholder="Pick start date"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DatePicker
                date={formData.endDate}
                onSelect={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                placeholder="Pick end date"
                disabled={(date) => formData.startDate ? date < formData.startDate : false}
                className="w-full"
              />
            </div>
          </div>

          {/* Labels Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Labels
            </label>
            <MultiSelect
              options={LABELS}
              selected={formData.labels}
              onChange={(labels) => setFormData(prev => ({ ...prev, labels }))}
              placeholder="Select data types..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Select multiple oceanographic data types to include in your import
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsERDDAPModalOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Import Data'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}