import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Assume standalone to prevent flash

  useEffect(() => {
    // Check if the app is already installed/running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore
      const isIOSStandalone = window.navigator.standalone === true;
      const isStandalone = isStandaloneMedia || isIOSStandalone;
      setIsStandalone(isStandalone);
      return isStandalone;
    };

    if (checkStandalone()) {
      return; // Already installed, do nothing
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt (Android / Desktop Chrome / Samsung Internet)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // If it hasn't been dismissed recently, show our custom prompt
      const hasDismissed = localStorage.getItem('youfi_pwa_dismissed');
      if (!hasDismissed || Date.now() - parseInt(hasDismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('App was installed');
      setIsStandalone(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Show prompt for iOS if not standalone (since iOS doesn't have beforeinstallprompt)
    if (isIOSDevice && !checkStandalone()) {
       const hasDismissed = localStorage.getItem('youfi_pwa_dismissed');
       if (!hasDismissed || Date.now() - parseInt(hasDismissed) > 7 * 24 * 60 * 60 * 1000) {
         // Add a small delay so it doesn't instantly pop up
         setTimeout(() => {
           setShowPrompt(true);
         }, 3000);
       }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, throw it away
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('youfi_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
        >
          <div className="p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-inner shrink-0 text-white font-bold text-xl">
                  Y
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">Install YouFi App</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Add to your home screen for quick offline access.</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            {isIOS ? (
              <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col gap-2">
                <p className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">To install on iOS:</p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>1. Tap the</span> <Share size={14} className="text-blue-500 inline" /> <span>icon below</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>2. Select</span> <span className="font-bold bg-white px-2 py-0.5 rounded border shadow-sm flex items-center gap-1">Add to Home Screen <PlusSquare size={12} className="inline text-gray-400" /></span>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleInstallClick}
                className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Download size={18} />
                Install App
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
