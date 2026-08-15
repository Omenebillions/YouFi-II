import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare, Monitor, Smartphone, ExternalLink, CheckCircle2 } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export default function PWAInstallPrompt() {
  const {
    isInstalled,
    deviceType,
    platform,
    browser,
    isInIframe,
    isPromptDismissed,
    promptInstall,
    dismissPrompt,
  } = usePWA();

  const [showHelperInfo, setShowHelperInfo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // If already running as an installed PWA / TWA or user dismissed the prompt, do not show float prompt
  if (isInstalled || isPromptDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    const result = await promptInstall();
    if (result.outcome === 'opened_new_tab') {
      setStatusMessage('Opening YouFi in a new tab for 1-click native installation...');
      setShowHelperInfo(true);
    } else if (result.outcome === 'accepted') {
      setStatusMessage('Installation accepted! Launching app mode...');
    } else if (result.outcome === 'manual_instructions' || !result.success) {
      setShowHelperInfo(true);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-[420px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-emerald-100/80 z-50 overflow-hidden"
      >
        <div className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 p-1.5 shrink-0 shadow-sm overflow-hidden flex items-center justify-center">
                <img 
                  src="/logo.jpeg" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
                  alt="YouFi Logo" 
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-gray-900 text-sm tracking-tight">Install YouFi App</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    {deviceType === 'mobile' ? 'Mobile PWA/TWA' : 'Desktop App'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium leading-tight mt-0.5">
                  Fast offline access, instant notifications & full screen mode.
                </p>
              </div>
            </div>
            <button
              onClick={dismissPrompt}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {statusMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Primary Action: Direct Install Button */}
          <button
            onClick={handleInstallClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all text-sm cursor-pointer"
          >
            {isInIframe ? <ExternalLink size={18} /> : <Download size={18} />}
            <span>{isInIframe ? 'Open & Install YouFi App' : 'Install YouFi App Now'}</span>
          </button>

          {/* Helper info fallback if native popup was suppressed by browser or on iOS */}
          {(showHelperInfo || platform === 'ios') && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-100 flex flex-col gap-2 text-xs text-gray-700"
            >
              {platform === 'ios' ? (
                <>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Smartphone size={12} className="text-emerald-600" />
                    <span>iOS Safari Installation:</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700">1.</span>
                    <span>Tap Share <Share size={14} className="text-emerald-600 inline shrink-0" /> at bottom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700">2.</span>
                    <span>Select <strong className="bg-white border px-1.5 py-0.5 rounded-md text-[11px] border-emerald-200">Add to Home Screen <PlusSquare size={13} className="inline text-emerald-600" /></strong></span>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <Monitor size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-700 leading-snug">
                    If browser didn't pop up the dialog automatically, look at your browser address bar top right and click <b>Install YouFi (⊕)</b>.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
