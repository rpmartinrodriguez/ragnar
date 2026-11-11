import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppearanceProvider } from './context/AppearanceContext.jsx';
import './index.css'; // Importante: Aquí cargamos los estilos de Tailwind

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>
);
