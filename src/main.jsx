import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.scss';
import App from './App.jsx';

// "ResizeObserver loop completed with undelivered notifications" — browser
// ki apni benign/informational warning hai (spec authors khud kehte hain
// yeh real error nahi hai), Accounts Canvas ke resizable window nodes
// (@xyflow/react + NodeResizer) isko trigger karte hain. Sirf event ko
// yahan se "suppress" karna kaafi nahi — Vite ka apna error-listener humse
// PEHLE register ho chuka hota hai, is liye race nahi jeeta ja sakta. Asal
// fix: ResizeObserver ke callback ko ek animation-frame se wrap karna, jo
// is loop-condition ko banne hi nahi deta (yeh iss exact issue ke liye
// widely-used standard workaround hai, koi asal bug nahi chupaya ja raha).
if (typeof window.ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => callback(entries, observer));
      });
    }
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
