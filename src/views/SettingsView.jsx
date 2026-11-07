import React, { useState, useEffect } from 'react';
import { Save, CreditCard, Plus, Trash2, Tag, DollarSign, Wallet, Check } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function SettingsView() {
  // Estados de los datos
  const [alias, setAlias] = useState('');
  const [plans, setPlans] = useState([]);
  
  // Estados del formulario de nuevo plan
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  // Estados de la interfaz
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cargar configuración actual desde Firebase
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAlias(data.alias || '');
          setPlans(data.plans || []);
        }
      } catch (error) {
        console.error("Error cargando configuración:", error);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  // Agregar un plan a la lista local (aún no se guarda en Firebase hasta presionar "Guardar Todo")
  const handleAddPlan = (e) => {
    e.preventDefault();
    if (!newPlanName || !newPlanPrice) return;
    
    const newPlan = {
      id: Date.now().toString(),
      name: newPlanName,
      price: newPlanPrice,
      description: newPlanDesc
    };
    
    setPlans([...plans, newPlan]);
    setNewPlanName('');
    setNewPlanPrice('');
    setNewPlanDesc('');
  };

  const handleRemovePlan = (id) => {
    setPlans(plans.filter(p => p.id !== id));
  };

  // Guardar todo en Firebase
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        alias,
        plans,
        updatedAt: new Date()
      }, { merge: true });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000); // El check verde desaparece a los 3 seg
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar la configuración");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Configuración</h2>
          <p className="text-zinc-500 text-sm">Gestiona tus métodos de cobro y planes de entrenamiento.</p>
        </div>
        
        <button 
          onClick={handleSaveAll}
          disabled={saving}
          className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
            saved 
              ? 'bg-green-500 text-black shadow-green-500/20' 
              : 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-yellow-400/20'
          } disabled:opacity-50`}
        >
          {saving ? 'Guardando...' : saved ? <><Check size={20}/> ¡Guardado!</> : <><Save size={20}/> Guardar Cambios</>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* SECCIÓN 1: MERCADO PAGO */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                <Wallet size={24}/>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase">Datos de Cobro</h3>
                <p className="text-zinc-500 text-xs mt-1">Donde tus alumnos enviarán el dinero.</p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Alias / CVU (Mercado Pago)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input 
                    type="text" 
                    className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-white focus:border-yellow-400 focus:outline-none transition-colors placeholder:text-zinc-700"
                    placeholder="ej. mi.alias.mp / 00000031..."
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">Tus alumnos verán este dato en su perfil para poder transferirte.</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: PLANES Y PRECIOS */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-green-500/20 p-3 rounded-xl text-green-400">
                <Tag size={24}/>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase">Planes y Precios</h3>
                <p className="text-zinc-500 text-xs mt-1">Crea los paquetes que ofreces.</p>
              </div>
            </div>

            {/* Formulario Crear Plan */}
            <form onSubmit={handleAddPlan} className="bg-black/50 border border-zinc-800 p-4 rounded-xl mb-6 space-y-3 relative z-10">
              <input 
                type="text" 
                required
                placeholder="Nombre (ej. Rutina Personalizada)" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white text-sm focus:border-yellow-400 outline-none"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
              />
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="text" 
                  required
                  placeholder="Precio (ej. 15.000)" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm focus:border-yellow-400 outline-none"
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(e.target.value)}
                />
              </div>
              <textarea 
                placeholder="Breve descripción (opcional)" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white text-sm focus:border-yellow-400 outline-none resize-none"
                rows="2"
                value={newPlanDesc}
                onChange={(e) => setNewPlanDesc(e.target.value)}
              ></textarea>
              <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors border border-zinc-700 flex items-center justify-center gap-2">
                <Plus size={16}/> Añadir Plan
              </button>
            </form>

            {/* Lista de Planes */}
            <div className="space-y-3 relative z-10">
              {plans.length === 0 ? (
                <p className="text-center text-zinc-600 text-sm py-4 border border-dashed border-zinc-800 rounded-xl">No has creado ningún plan.</p>
              ) : (
                plans.map(plan => (
                  <div key={plan.id} className="bg-black border border-zinc-800 rounded-xl p-4 flex justify-between items-center group hover:border-yellow-400/50 transition-colors">
                    <div>
                      <h4 className="font-bold text-white leading-none">{plan.name}</h4>
                      <p className="text-green-400 font-black text-sm mt-1">${plan.price}</p>
                      {plan.description && <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{plan.description}</p>}
                    </div>
                    <button 
                      onClick={() => handleRemovePlan(plan.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
