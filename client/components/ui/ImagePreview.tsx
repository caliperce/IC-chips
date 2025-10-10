'use client';

import React from 'react';

interface ImagePreviewProps {
  images: string[];
  className?: string;
}

export function ImagePreview({ images, className = '' }: ImagePreviewProps) {
  return (
    <div className={`bg-[#111728] rounded-2xl p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Uploaded Images</h3>
      <div className="border-2 border-dashed border-gray-600 rounded-xl p-6">
        <div className={`grid gap-4 ${images.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="relative w-full aspect-square bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
                <img
                  src={image}
                  alt={`Uploaded chip ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}