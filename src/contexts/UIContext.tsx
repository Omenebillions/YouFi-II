import React, { createContext, useContext, useState, useEffect } from 'react';

interface UIContextType {
  isModalOpen: boolean;
  setModalOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextType>({
  isModalOpen: false,
  setModalOpen: () => {},
});

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <UIContext.Provider value={{ isModalOpen, setModalOpen: setIsModalOpen }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
