import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare, Monitor, Smartphone, CheckCircle2, ExternalLink } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import logo from '../assets/images/youfi_app_logo_1779452869088.png';

export default function PWAInstallPrompt() {
  const {
    isInstalled,
    deviceType,
    platform,
    browser,
    canInstallPrompt,
    isPromptDismissed,
    promptInstall,
    dismissPrompt,
  } = usePWA();

  // If already running as an installed PWA / TWA or user dismissed the prompt, do not show float prompt
  if (isInstalled || isPromptDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-[400px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-emerald-100/80 z-50 overflow-hidden"
      >
        <div className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 p-1.5 shrink-0 shadow-sm overflow-hidden flex items-center justify-center">
                <img 
                  src={logo} 
                  alt="YouFi Logo" 
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    // Fallback to /logo.png if asset failed
                    (e.target as HTMLImageElement).src = '/logo.png';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-gray-900 text-sm tracking-tight">Install YouFi App</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    {deviceType === 'mobile' ? 'Mobile App' : 'Desktop App'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium leading-tight mt-0.5">
                  Fast offline access, instant notifications & full screen mode.
                </p>
              </div>
            </div>
            <button
              onClick={dismissPrompt}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conditional Guidance based on OS & Browser */}
          {canInstallPrompt ? (
            <button
              onClick={promptInstall}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all text-sm"
            >
              <Download size={18} />
              <span>Install YouFi Now</span>
            </button>
          ) : platform === 'ios' ? (
            <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-100/80 flex flex-col gap-2">
              <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                <Smartphone size={12} className="text-emerald-600" />
                <span>To install on iOS (Safari):</span>
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="font-bold text-emerald-700">1.</span>
                <span>Tap Share</span>
                <Share size={14} className="text-emerald-600 inline shrink-0" />
                <span>in Safari bottom bar</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="font-bold text-emerald-700">2.</span>
                <span>Tap</span>
                <span className="font-bold bg-white px-2 py-0.5 rounded-lg border border-emerald-200 shadow-2xs text-gray-800 flex items-center gap-1 text-[11px]">
                  Add to Home Screen <PlusSquare size={13} className="inline text-emerald-600" />
                </span>
              </div>
            </div>
          ) : platform === 'desktop_mac' && browser === 'safari' ? (
            <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-100/80 flex flex-col gap-2">
              <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                <Monitor size={12} className="text-emerald-600" />
                <span>To install on macOS Safari:</span>
              </p>
              <p className="text-xs text-gray-700">
                Click <span className="font-bold text-gray-900">File</span> in Mac menu bar &rarr; Select <span className="font-bold text-emerald-700">Add to Dock</span>.
              </p>
            </div>
          ) : deviceType === 'desktop' ? (
            <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-100/80 flex flex-col gap-1.5">
              <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                <Monitor size={12} className="text-emerald-600" />
                <span>Desktop Browser Installation:</span>
              </p>
              <p className="text-xs text-gray-700 leading-snug">
                Click the <span className="font-bold text-emerald-700">Install App (⊕ or 💻)</span> icon inside your browser address bar at top right.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-100/80 flex flex-col gap-1.5">
              <p className="text-xs text-gray-700 leading-snug">
                Open browser menu (&vellip;) and choose <span className="font-bold text-emerald-700">Install app</span> or <span className="font-bold text-emerald-700">Add to Home screen</span>.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
