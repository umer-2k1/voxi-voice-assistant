import '@fontsource-variable/hanken-grotesk/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@/styles/global.scss';
import '@/styles/global.css';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import App from './app';

const container = document.querySelector('#root');
const root = createRoot(container as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
