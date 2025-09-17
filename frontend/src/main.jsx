import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 🔍 DEBUGGING: Interceptar localStorage para encontrar qué borra el token
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;
const originalClear = localStorage.clear;

localStorage.setItem = function(key, value) {
  console.trace(`🔵 localStorage.setItem('${key}', '${value.substring(0, 20)}...')`);
  return originalSetItem.apply(this, arguments);
};

localStorage.removeItem = function(key) {
  console.trace(`🔴 localStorage.removeItem('${key}')`);
  return originalRemoveItem.apply(this, arguments);
};

localStorage.clear = function() {
  console.trace(`💥 localStorage.clear()`);
  return originalClear.apply(this, arguments);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)