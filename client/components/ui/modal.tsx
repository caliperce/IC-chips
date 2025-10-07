'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay 
          className="fixed inset-0 z-50" 
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]",
            "bg-white rounded-2xl shadow-2xl border border-gray-200",
            "w-[90vw] h-[90vh] max-w-6xl max-h-[90vh]",
            "overflow-hidden",
            className
          )}
        >
          {/* Always include DialogTitle for accessibility */}
          {title ? (
            <Dialog.Title className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              {title}
              <Dialog.Close
                className="ml-auto p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600 hover:text-gray-800"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </Dialog.Title>
          ) : (
            <>
              <VisuallyHidden.Root>
                <Dialog.Title>Modal Content</Dialog.Title>
              </VisuallyHidden.Root>
              <div className="absolute top-2 right-4 z-10">
                <Dialog.Close
                  className="p-2 hover:bg-gray-200 rounded-lg hover:text-gray-800"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
            </>
          )}
          <div className="flex-1 overflow-y-auto overflow-x-visible bg-white">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}