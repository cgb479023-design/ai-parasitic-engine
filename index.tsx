import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LocalizationProvider } from './src/contexts/LocalizationContext';
import { ClosedLoopInitializer } from './src/components/ClosedLoopInitializer';
import { debugBridge } from './src/core/DebugBridge';

// Initialize Debug Bridge
debugBridge.integrate();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Service initialization callback
const handleServicesReady = (status: any) => {
  console.log('✅ [index.tsx] Closed-loop services ready:', status);
};

root.render(
  <React.StrictMode>
    <ClosedLoopInitializer onReady={handleServicesReady}>
      <LocalizationProvider>
        <App />
      </LocalizationProvider>
    </ClosedLoopInitializer>
  </React.StrictMode>
);