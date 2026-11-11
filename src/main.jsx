import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppearanceProvider } from './context/AppearanceContext.jsx';
import './index.css'; // Importante: Aquí cargamos los estilos de Tailwind
import './appearance.css'; // Paletas y microinteracciones, después de Tailwind
import './coachExperience.css'; // Sistema visual del coach, aislado de la lógica

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>
);
