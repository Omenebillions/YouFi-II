import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Unregister any stale Service Workers in development or iframe to prevent preview caching/intercept issues
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV || window.self !== window.top) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


