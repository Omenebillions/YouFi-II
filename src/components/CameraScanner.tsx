import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (result: { name: string; price?: number; details?: string }) => void;
}

export default function CameraScanner({ isOpen, onClose, onScanComplete }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  const requestCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError') {
         setError('Camera access denied. Please grant permissions in your browser.');
      } else {
         setError('Unable to access camera. Your device might not support it or it is in use.');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen) {
      requestCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, requestCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    setOcrProgress(0);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video stream exactly for high-res capture
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsProcessing(false);
      setError('Internal error: Canvas rendering failed');
      return;
    }
    
    // Draw the current video frame onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // Process using AI backend instead of Tesseract to avoid CORS/CDN issues
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: {
            parts: [
              { text: "Extract the most prominent text from this image which represents the product brand/name. Do not extract pricing." },
              { inlineData: { mimeType: "image/png", data: base64Data } }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                details: { type: "STRING" }
              }
            }
          }
        })
      });

      if (!response.ok) {
        let errMsg = 'Failed to communicate with AI OCR service.';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      let extracted: any = {};
      try {
        extracted = JSON.parse(resData.text);
      } catch (e) {
        console.warn("Could not parse AI JSON", resData.text);
      }

      onScanComplete({
        name: extracted.name || 'Scanned Product',
        details: extracted.details
      });
      
    } catch (err: any) {
      console.error("OCR Failed:", err);
      setError(err.message || "Failed to analyze image. Please try again with better lighting.");
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[9999] bg-black flex flex-col"
        >
           {/* Header */}
           <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
             <div className="text-white">
                <h2 className="text-xl font-bold">Scan Product</h2>
                <p className="text-xs text-white/70">Snap brand name & price</p>
             </div>
             <div className="flex gap-4">
                 <button onClick={toggleCamera} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all">
                   <RefreshCcw size={22} />
                 </button>
                 <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all">
                   <X size={24} />
                 </button>
             </div>
           </div>

           {/* Viewfinder */}
           <div className="flex-1 relative bg-black/90 flex items-center justify-center overflow-hidden">
             {error && !isProcessing ? (
               <div className="p-8 text-center bg-black/50 backdrop-blur-md rounded-2xl m-6 border border-white/10">
                 <p className="text-red-400 font-medium">{error}</p>
                 <button onClick={requestCamera} className="mt-4 bg-white text-black font-bold px-6 py-3 rounded-full text-sm">
                   Retry Camera Access
                 </button>
               </div>
             ) : (
               <>
                 <video 
                   ref={videoRef} 
                   autoPlay 
                   playsInline 
                   muted 
                   className="absolute inset-0 w-full h-full object-cover"
                 />
                 
                 {/* Scanning Overlay Grid/Guides */}
                 <div className="absolute inset-x-8 inset-y-32 border-2 border-white/30 rounded-3xl z-10 pointer-events-none">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-3xl"></div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-3xl"></div>
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-3xl"></div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-3xl"></div>
                 </div>

                 <canvas ref={canvasRef} className="hidden" />
               </>
             )}

             {isProcessing && (
               <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                 <Loader2 size={48} className="animate-spin text-brand-500 mb-4" />
                 <h3 className="text-xl font-bold mb-2">Analyzing Product</h3>
                 <p className="text-sm text-gray-300">Extracting brand text and pricing...</p>
                 <div className="w-48 h-2 bg-gray-800 rounded-full mt-6 overflow-hidden">
                   <div 
                     className="h-full bg-brand-500 transition-all duration-300"
                     style={{ width: `${ocrProgress}%` }}
                   ></div>
                 </div>
                 <span className="text-xs font-bold mt-2 text-brand-400">{ocrProgress}%</span>
               </div>
             )}
           </div>

           {/* Controls */}
           <div className="h-40 bg-black flex items-center justify-center pb-8 p-6 z-10">
              <button 
                onClick={captureAndScan}
                disabled={isProcessing || !!error}
                className="w-20 h-20 rounded-full border-4 border-white/30 p-1 active:scale-90 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
              >
                 <div className="w-full h-full bg-white rounded-full"></div>
              </button>
           </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
