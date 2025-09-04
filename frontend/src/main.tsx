import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TooltipProvider } from './components/ui/tooltip';

// Initialize enhanced logging system with console interception and file logging
import './services/logger';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={100}>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
); 