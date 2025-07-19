import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('main.jsx is executing...');

const rootElement = document.getElementById('root');
console.log('Root element found:', rootElement);

if (rootElement) {
  const root = createRoot(rootElement);
  console.log('React root created');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
}
