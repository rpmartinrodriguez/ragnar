import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, Dumbbell, FolderSync, 
  Settings, Bell, LogOut, Calendar, CreditCard, 
  MessageSquare, Menu, X 
} from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';

export function Sidebar({ activeView, navigateTo, notificationCount = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const auth = getAuth();

  const handleLogout = () => {
    signOut(auth);
    window.location.reload();
  };

  const handleNavClick = (viewId) => {
    navigateTo(viewId);
    setIsOpen(false);
  };

  // --- NUEVO ORDEN DEL MENÚ ---
  const menuItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={20} /> },
    { id: 'notifications', label: 'Notificaciones', icon: <Bell size={20} />, badge: notificationCount },
    { id: 'community', label: 'Salón Ragnar', icon: <MessageSquare size={20} /> },
    { id: 'clients', label: 'Mis Atletas', icon: <Users size={20} /> },
    { id: 'exercises', label: 'Ejercicios', icon: <Dumbbell size={20} /> },
    { id: 'routines', label: 'Rutinas', icon: <FolderSync size={20} /> },
    { id: 'payments', label: 'Cobros', icon: <CreditCard size={20} /> },
    { id: 'calendar', label: 'Agenda', icon: <Calendar size={20} /> },
    { id: 'settings', label: 'Configuraciones', icon: <Settings size={20} /> },
  ];

  return (
    <>
      {/* Botón de Hamburguesa para versión móvil */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-yellow-400 shadow-xl"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay oscuro para fondo en móvil */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/80 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menú Lateral */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* LOGO ORIGINAL RESTAURADO */}
        <div className="p-6 border-b border-zinc-800 flex items-center gap-4 shrink-0">
          <img 
            src="/logo.png" 
            alt="Logo Ragnar" 
            className="w-12 h-12 object-contain"
            onError={(e) => {
              // Fallback por si la imagen no carga
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="hidden w-12 h-12 bg-yellow-400 rounded-xl items-center justify-center text-black font-black text-xl italic">
            R
          </div>
          <div>
            <h1 className="text-white font-black uppercase tracking-tighter leading-none">Ragnar</h1>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Coach Panel</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                activeView === item.id 
                  ? 'bg-yellow-400 text-black' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              
              {item.badge > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeView === item.id ? 'bg-black text-yellow-400' : 'bg-red-500 text-white'
                }`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all font-bold text-sm"
          >
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
