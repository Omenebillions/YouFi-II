import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { configureMonacoWorkers } from './lib/monaco';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

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
