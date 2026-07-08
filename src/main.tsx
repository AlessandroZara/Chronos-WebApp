import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ensurePushSubscription } from './push';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker: abilita offline, installazione PWA e notifiche su mobile.
// Dopo la registrazione, se il permesso notifiche è già concesso, ci
// assicuriamo che esista la subscription Web Push del dispositivo
// (riparte anche quella eventualmente invalidata dal push service).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => ensurePushSubscription())
      .catch(() => {});
  });
}
