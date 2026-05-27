import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNativeBridge } from '../hooks/useNativeBridge';

interface PremiumContextType {
  isPremium: boolean;
  loading: boolean;
  refreshPremiumStatus: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPremium: bridgeIsPremium, refreshPremiumStatus: bridgeRefresh } = useNativeBridge();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshPremiumStatus = async () => {
    try {
      const status = await bridgeRefresh();
      setIsPremium(status);
      return status;
    } catch {
      return isPremium;
    }
  };

  useEffect(() => {
    setIsPremium(bridgeIsPremium);
    setLoading(false);
  }, [bridgeIsPremium]);

  return (
    <PremiumContext.Provider value={{ isPremium, loading, refreshPremiumStatus }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};
