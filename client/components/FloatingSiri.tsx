'use client';

import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import { X, Monitor, MonitorOff } from 'lucide-react';
import siriAnimation from '../utils/Siri.json';

interface FloatingSiriProps {
  className?: string;
}

const FloatingSiri: React.FC<FloatingSiriProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenShareDialog, setShowScreenShareDialog] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showStopButton, setShowStopButton] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [particlePositions, setParticlePositions] = useState<Array<{top: number, left: number}>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize particle positions on client side only
  useEffect(() => {
    const positions = Array.from({ length: 6 }, () => ({
      top: 20 + Math.random() * 60,
      left: 20 + Math.random() * 60
    }));
    setParticlePositions(positions);
  }, []);

  // Show the component after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts for pulsing effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K (start pulsing)
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setIsPulsing(true);
      }
      // Check for Ctrl+L (stop pulsing)
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        setIsPulsing(false);
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle screen sharing
  const startScreenShare = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      setStream(mediaStream);
      setIsScreenSharing(true);
      setShowStopButton(true);
      setShowScreenShareDialog(false);
      
      // Handle when user stops sharing via browser controls
      mediaStream.getVideoTracks()[0].onended = () => {
        // Don't call stopScreenShare here - just clean up the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setIsScreenSharing(false);
        // Keep showStopButton true so user can still see the button
      };
      
    } catch (error) {
      console.error('Error starting screen share:', error);
      setShowScreenShareDialog(false);
    }
  };

  const stopScreenShare = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScreenSharing(false);
    setShowStopButton(false);
  };

  const handleSiriClick = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      setShowScreenShareDialog(true);
    }
  };

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: siriAnimation,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice'
    }
  };

  return (
    <>
      {/* Custom CSS for Siri Pulse Animation */}
      <style jsx>{`
        @keyframes siriPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>

      {/* Screen Share Dialog */}
      {showScreenShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Start Screen Sharing</h3>
              <button
                onClick={() => setShowScreenShareDialog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Allow screen sharing to enable AI assistance with your current screen content.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScreenShareDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startScreenShare}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Monitor size={16} />
                Start Sharing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Screen Share Button - Top Right */}
      {showStopButton && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={stopScreenShare}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition-colors"
          >
            <MonitorOff size={16} />
            Stop Sharing
          </button>
        </div>
      )}

      {/* Floating Siri Component */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-in-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`relative cursor-pointer transition-all duration-300 ${
            isHovered ? 'scale-110' : 'scale-100'
          } ${isScreenSharing ? 'ring-4 ring-green-400 ring-opacity-50' : ''} ${
            isPulsing ? 'animate-pulse' : ''
          }`}
          onClick={handleSiriClick}
          style={{
            animation: isPulsing ? 'siriPulse 0.8s ease-in-out infinite' : undefined,
          }}
        >
          {/* Floating background circle */}
          <div className={`absolute inset-0 rounded-full shadow-lg blur-sm scale-150 transition-all duration-300 ${
            isPulsing 
              ? 'opacity-40 scale-200' 
              : 'opacity-20 scale-150'
          } ${
            isScreenSharing 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : isPulsing
                ? 'bg-gradient-to-r from-orange-500 to-yellow-600'
                : 'bg-gradient-to-r from-blue-500 to-purple-600'
          }`}></div>
          
          {/* Main animation container */}
          <div className={`relative w-16 h-16 rounded-full shadow-xl flex items-center justify-center overflow-hidden transition-colors ${
            isScreenSharing 
              ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
              : isPulsing
                ? 'bg-gradient-to-br from-orange-500 to-yellow-600'
                : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }`}>
            {/* Lottie Animation */}
            <div className="w-12 h-12">
              <Lottie
                animationData={siriAnimation}
                loop={true}
                autoplay={true}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>
          </div>

          {/* Floating particles effect */}
          <div className="absolute inset-0 pointer-events-none">
            {particlePositions.length > 0 && particlePositions.map((position, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 rounded-full opacity-60 animate-ping ${
                  isScreenSharing
                    ? 'bg-green-300'
                    : isPulsing
                      ? 'bg-orange-300'
                      : 'bg-white'
                }`}
                style={{
                  top: `${position.top}%`,
                  left: `${position.left}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: isPulsing ? '1s' : '2s'
                }}
              />
            ))}
          </div>

          {/* Pulse ring effect */}
          <div className={`absolute inset-0 rounded-full border-2 opacity-30 animate-ping ${
            isScreenSharing 
              ? 'border-green-400' 
              : isPulsing 
                ? 'border-orange-400' 
                : 'border-blue-400'
          }`}></div>
          <div className={`absolute inset-0 rounded-full border opacity-20 animate-pulse ${
            isScreenSharing 
              ? 'border-emerald-400' 
              : isPulsing 
                ? 'border-yellow-400' 
                : 'border-purple-400'
          }`}></div>
        </div>

        {/* Tooltip */}
        <div
          className={`absolute bottom-full right-0 mb-2 px-3 py-2 text-white text-sm rounded-lg shadow-lg transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          } pointer-events-none ${
            isScreenSharing ? 'bg-green-800' : isPulsing ? 'bg-orange-800' : 'bg-gray-800'
          }`}
        >
          <div className="relative">
            {isPulsing 
              ? 'AI is Speaking...' 
              : isScreenSharing 
                ? 'Stop Screen Sharing' 
                : 'Start Screen Sharing'
            }
            <div className={`absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${
              isScreenSharing ? 'border-t-green-800' : isPulsing ? 'border-t-orange-800' : 'border-t-gray-800'
            }`}></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FloatingSiri;
