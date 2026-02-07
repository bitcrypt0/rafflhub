import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import App from './App.jsx'
import { supabaseService } from './services/supabaseService'

// Suppress Sentry initialization errors from third-party libraries
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('Invalid Sentry Dsn') || message.includes('Sentry')) {
    // Suppress Sentry-related errors
    return;
  }
  originalConsoleError.apply(console, args);
};

console.log('main.jsx is executing...');

// Initialize Supabase service before app renders
console.log('🚀 Initializing Supabase service...');
const supabaseInitialized = supabaseService.initialize();
console.log('Supabase initialized:', supabaseInitialized);

const rootElement = document.getElementById('root');
console.log('Root element found:', rootElement);

if (rootElement) {
  const root = createRoot(rootElement);
  console.log('React root created');
  root.render(
    // Temporarily disable StrictMode for debugging
    // <StrictMode>
      <App />
    // </StrictMode>,
  );
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
}
