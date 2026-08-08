import { useState, useEffect, useCallback } from 'react';

export interface PWAState {
  isInstalled: boolean;
  platform: 'ios' | 'android' | 'desktop_mac' | 'desktop_windows' | 'desktop_other';
  deviceType: 'mobile' | 'desktop';
  browser: 'chrome' | 'safari' | 'edge' | 'firefox' | 'other';
  canInstallPrompt: boolean;
  isTWA: boolean;
  isInIframe: boolean;
}

export function usePWA() {
  const [pwaState, setPwaState] = useState<PWAState>(() => {
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    return {
      isInstalled: false,
      platform: 'desktop_other',
      deviceType: 'desktop',
      browser: 'other',
      canInstallPrompt: false,
      isTWA: false,
      isInIframe: inIframe,
    };
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(false);

  // Synchronous status checks
  const checkInstalledStatus = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;

    // 1. Media query checks
    const isStandaloneMQ = window.matchMedia('(display-mode: standalone)').matches;
    const isMinimalUIMQ = window.matchMedia('(display-mode: minimal-ui)').matches;
    const isFullscreenMQ = window.matchMedia('(display-mode: fullscreen)').matches;
    const isWindowControlsMQ = window.matchMedia('(display-mode: window-controls-overlay)').matches;

    // 2. iOS standalone check
    const isIOSStandalone = (window.navigator as any).standalone === true;

    // 3. Android TWA (Trusted Web Activity) check via referrer
    const isTWAReferrer = document.referrer.startsWith('android-app://');

    // 4. URL param override
    const hasPWAParam = window.location.search.includes('display=standalone') || 
                         window.location.search.includes('utm_source=homescreen') ||
                         window.location.search.includes('source=pwa');

    return isStandaloneMQ || isMinimalUIMQ || isFullscreenMQ || isWindowControlsMQ || isIOSStandalone || isTWAReferrer || hasPWAParam;
  }, []);

  // Async status check (includes navigator.getInstalledRelatedApps API)
  const checkInstalledStatusAsync = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    if (checkInstalledStatus()) return true;

    if ('getInstalledRelatedApps' in navigator) {
      try {
        const relatedApps = await (navigator as any).getInstalledRelatedApps();
        if (relatedApps && relatedApps.length > 0) {
          return true;
        }
      } catch (err) {
        // Ignored if API is restricted
      }
    }
    return false;
  }, [checkInstalledStatus]);

  // Detect platform and browser details
  const detectEnvironment = useCallback(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent.toLowerCase();
    
    // Platform detection
    let platform: PWAState['platform'] = 'desktop_other';
    let deviceType: PWAState['deviceType'] = 'desktop';

    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
    const isWindows = /windows/.test(ua);

    if (isIOS) {
      platform = 'ios';
      deviceType = 'mobile';
    } else if (isAndroid) {
      platform = 'android';
      deviceType = 'mobile';
    } else if (isMac) {
      platform = 'desktop_mac';
      deviceType = 'desktop';
    } else if (isWindows) {
      platform = 'desktop_windows';
      deviceType = 'desktop';
    }

    // Browser detection
    let browser: PWAState['browser'] = 'other';
    if (/edg\//.test(ua)) {
      browser = 'edge';
    } else if (/chrome|crios/.test(ua) && !/edg\//.test(ua)) {
      browser = 'chrome';
    } else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) {
      browser = 'safari';
    } else if (/firefox|fxios/.test(ua)) {
      browser = 'firefox';
    }

    const isInstalled = checkInstalledStatus();
    const isTWA = document.referrer.startsWith('android-app://');
    const isInIframe = window.self !== window.top;

    // Check localStorage dismissal
    const dismissedAt = localStorage.getItem('youfi_pwa_dismissed');
    const dismissed = dismissedAt ? (Date.now() - parseInt(dismissedAt, 10)) < (7 * 24 * 60 * 60 * 1000) : false;
    setIsPromptDismissed(dismissed);

    setPwaState(prev => ({
      ...prev,
      isInstalled,
      platform,
      deviceType,
      browser,
      isTWA,
      isInIframe,
    }));

    // Trigger async related apps check
    checkInstalledStatusAsync().then(installed => {
      if (installed) {
        setPwaState(prev => ({ ...prev, isInstalled: true }));
      }
    });
  }, [checkInstalledStatus, checkInstalledStatusAsync]);

  useEffect(() => {
    detectEnvironment();

    // Check if early window.deferredPWAInstallPrompt exists
    const earlyPrompt = (window as any).deferredPWAInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
      setPwaState(prev => ({ ...prev, canInstallPrompt: true }));
    }

    // Constant status checking:
    // 1. Listen to media query changes
    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleMQChange = (e: MediaQueryListEvent) => {
      setPwaState(prev => ({ ...prev, isInstalled: e.matches }));
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleMQChange);
    } else {
      mediaQueryList.addListener(handleMQChange);
    }

    // 2. Listen for 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
      setPwaState(prev => ({ ...prev, canInstallPrompt: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listen for 'appinstalled'
    const handleAppInstalled = () => {
      setPwaState(prev => ({ ...prev, isInstalled: true, canInstallPrompt: false }));
      setDeferredPrompt(null);
      (window as any).deferredPWAInstallPrompt = null;
      localStorage.removeItem('youfi_pwa_dismissed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 4. Periodically verify installed status (every 2.5s) & on focus
    const intervalId = setInterval(async () => {
      const installed = await checkInstalledStatusAsync();
      setPwaState(prev => {
        if (prev.isInstalled !== installed) {
          return { ...prev, isInstalled: installed };
        }
        return prev;
      });
    }, 2500);

    const handleFocus = async () => {
      const installed = await checkInstalledStatusAsync();
      setPwaState(prev => ({ ...prev, isInstalled: installed }));
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMQChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(intervalId);
    };
  }, [detectEnvironment, checkInstalledStatusAsync]);

  // Method to trigger native install prompt or handle iframe redirection
  const promptInstall = useCallback(async (): Promise<{ success: boolean; outcome: 'accepted' | 'dismissed' | 'opened_new_tab' | 'manual_instructions' }> => {
    // If inside an iframe (like AI Studio preview), opening full window allows native browser install prompt to trigger
    if (typeof window !== 'undefined' && window.self !== window.top) {
      window.open(window.location.href, '_blank');
      return { success: true, outcome: 'opened_new_tab' };
    }

    const promptEvent = deferredPrompt || (window as any).deferredPWAInstallPrompt;
    if (!promptEvent) {
      return { success: false, outcome: 'manual_instructions' };
    }

    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      setDeferredPrompt(null);
      (window as any).deferredPWAInstallPrompt = null;
      setPwaState(prev => ({ ...prev, canInstallPrompt: false }));
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setPwaState(prev => ({ ...prev, isInstalled: true }));
        return { success: true, outcome: 'accepted' };
      } else {
        return { success: false, outcome: 'dismissed' };
      }
    } catch (err) {
      console.error('PWA install prompt error:', err);
      return { success: false, outcome: 'manual_instructions' };
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem('youfi_pwa_dismissed', Date.now().toString());
    setIsPromptDismissed(true);
  }, []);

  const resetDismissal = useCallback(() => {
    localStorage.removeItem('youfi_pwa_dismissed');
    setIsPromptDismissed(false);
  }, []);

  return {
    ...pwaState,
    deferredPrompt,
    isPromptDismissed,
    promptInstall,
    dismissPrompt,
    resetDismissal,
    checkInstalledStatus,
    checkInstalledStatusAsync,
  };
}
