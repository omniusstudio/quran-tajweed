import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import { startSync } from './ui/sync';
import { startWirdReminder } from './ui/reminder';

// Offline shell (PROMPT.md §8). The service worker would otherwise keep serving the previous
// build until two reloads later; with `immediate` + auto-update the page reloads itself as soon
// as a new build is found, and we look for one when the window regains focus and every 5 minutes.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => void registration.update().catch(() => undefined);
    setInterval(check, 5 * 60 * 1000);
    addEventListener('focus', check);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  },
});

startSync();
startWirdReminder();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
