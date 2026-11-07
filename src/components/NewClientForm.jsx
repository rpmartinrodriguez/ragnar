import React, { useState } from 'react';
import { X, Save, User, Mail, Activity, Dumbbell } from 'lucide-react';

export default function NewClientForm({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    plan: 'Hipertrofia',
    startDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Crear el objeto de cliente nuevo
    const newClient = {
      id: Date.now(), // ID temporal único
      ...formData,
      status: 'active',
      lastCheckin: 'N/A',
      routine: []
    };
    onSave(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="bg-zinc-950 w-full max-w-md rounded-xl border border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.1)] relative overflow-hidden">
        
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <User className="text-yellow-400" size={20} /> Nuevo Atleta
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Campo Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nombre Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input 
                required
                type="text" 
                placeholder="Ej. Juan Pérez"
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-zinc-700"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          </div>

          {/* Campo Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Contacto (Email/Tel)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input 
                type="text" 
                placeholder="contacto@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-zinc-700"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          {/* Fila Doble: Plan y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Plan Inicial</label>
              <div className="relative">
                <Dumbbell className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-9 pr-2 py-3 rounded-lg focus:outline-none focus:border-yellow-400 appearance-none text-sm"
                  value={formData.plan}
                  onChange={(e) => setFormData({...formData, plan: e.target.value})}
                >
                  <option>Hipertrofia</option>
                  <option>Pérdida de Peso</option>
                  <option>Fuerza</option>
                  <option>Funcional</option>
                  <option>Crossfit</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Inicio</label>
              <div className="relative">
                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="date"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-9 pr-2 py-3 rounded-lg focus:outline-none focus:border-yellow-400 text-sm [color-scheme:dark]"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-900 hover:text-white transition-colors uppercase text-xs tracking-wide"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors shadow-[0_0_20px_rgba(250,204,21,0.2)] uppercase text-xs tracking-wide flex justify-center items-center gap-2"
            >
              <Save size={16} /> Guardar Atleta
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}