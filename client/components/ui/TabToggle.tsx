'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TabToggleProps {
  options: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function TabToggle({ options, activeTab, onTabChange, className = '' }: TabToggleProps) {
  return (
    <div className={`inline-flex items-center gap-2 bg-[#1a1f3a] rounded-lg p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onTabChange(option)}
          className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === option
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          {activeTab === option && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-[#5b8def] rounded-md"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10">{option}</span>
        </button>
      ))}
    </div>
  );
}
