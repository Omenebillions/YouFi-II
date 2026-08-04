import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { configureMonacoWorkers } from './lib/monaco';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

// Suppress "Failed to fetch" global unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorStr = event.reason ? (event.reason instanceof Error ? event.reason.message : String(event.reason)) : '';
    if (errorStr.includes('Failed to fetch')) {
      event.preventDefault(); // Prevent it from showing up as an error
      console.warn('Suppressed unhandled Failed to fetch error');
    }
  });

  const originalConsoleError = console.error;
  console.error = function (...args) {
    const errorStr = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
    if (errorStr.includes('Failed to fetch')) {
      console.warn('Suppressed console.error Failed to fetch:', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Setup monaco workers
configureMonacoWorkers();

// Register service worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    // Optionally alert the user that a new version is available
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
