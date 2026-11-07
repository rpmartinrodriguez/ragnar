import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  Layout, 
  TrendingUp, 
  ChevronRight, 
  DollarSign, 
  X, 
  CheckCircle, 
  Clock, 
  Calendar as CalendarIcon,
  Bell
} from 'lucide-react';
import { 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function DashboardView({ clients, settings, navigateTo }) {
  // --- ESTADOS ---
  const [loadingIncome, setLoadingIncome] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [paidClientsDetail, setPaidClientsDetail] = useState([]);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // Conteo de clientes
  const activeClientsCount = clients.filter((c) => c.active !== false).length;

  // --- EFECTO PARA TRAER INGRESOS REALES DEL MES ACTUAL ---
  // (Esta función se reinicia a $0 automáticamente el día 1 de cada mes)
  useEffect(() => {
    const fetchRealIncome = async () => {
      setLoadingIncome(true);
      let total = 0;
      let details = [];
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      try {
        for (const client of clients) {
          
          const paymentsRef = collection(db, 'clients', client.id, 'payments');
          const snap = await getDocs(paymentsRef);
          
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            
            if (data.status === 'paid' && data.paidAt) {
              
              const paidDate = data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt);
              
              // Filtro exacto: Solo suma los pagos hechos en el mes actual
              if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
                const amount = parseFloat(data.amount || 0);
                total += amount;
                
                details.push({
                  id: docSnap.id,
                  period: docSnap.id,
                  amount: amount,
                  paidAt: paidDate,
                  clientName: data.clientName || client.name 
                });
              }
            }
          });
        }

        details.sort((a, b) => b.paidAt - a.paidAt);

        setMonthlyIncome(total);
        setPaidClientsDetail(details);
        
      } catch (error) { 
        console.error("Error al buscar ingresos:", error); 
      } finally {
        setLoadingIncome(false);
      }
    };

    if (clients) {
      fetchRealIncome();
    }
  }, [clients]);

  // --- FORMATEADOR DE MONEDA ---
  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER PRINCIPAL CON CAMPANITA RESTAURADA */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <TrendingUp className="text-yellow-400" size={32}/> Panel Principal
          </h2>
          <p className="text-zinc-500 text-sm font-bold mt-1">
            Control total de tu centro de entrenamiento.
          </p>
        </div>
        
        {/* BOTÓN DE NOTIFICACIONES */}
        <button 
          onClick={() => navigateTo('notifications')} 
          className="relative p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-yellow-400 hover:border-yellow-400/50 transition-all shadow-xl group"
          title="Ver Notificaciones"
        >
          <Bell size={24} className="group-hover:animate-pulse"/>
        </button>
      </div>

      {/* GRID DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* TARJETA 1: ATLETAS */}
        <div 
          onClick={() => navigateTo('clients')} 
          className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl cursor-pointer group hover:border-yellow-400/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl">
              <Users size={28}/>
            </div>
            <ChevronRight size={24} className="text-zinc-700 group-hover:text-yellow-400 transition-all"/>
          </div>
          <h3 className="text-5xl font-black text-white tracking-tighter mb-1 relative z-10">
            {activeClientsCount}
          </h3>
          <p className="text-xs text-zinc-500 font-black uppercase tracking-widest relative z-10">
            Atletas Activos
          </p>
        </div>

        {/* TARJETA 2: INGRESOS REALES */}
        <div 
          onClick={() => setIsIncomeModalOpen(true)} 
          className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl cursor-pointer group hover:border-green-500/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-4 bg-green-500/10 text-green-500 rounded-2xl">
              <DollarSign size={28}/>
            </div>
            <ChevronRight size={24} className="text-zinc-700 group-hover:text-green-500 transition-all"/>
          </div>
          <div className="relative z-10">
            {loadingIncome ? (
              <div className="h-12 flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-yellow-400"></div>
              </div>
            ) : (
              <h3 className="text-4xl font-black text-white tracking-tighter mb-1 truncate">
                {formatMoney(monthlyIncome)}
              </h3>
            )}
            <p className="text-xs text-zinc-500 font-black uppercase tracking-widest">
              Caja del Mes
            </p>
          </div>
        </div>

        {/* TARJETA 3: GESTIÓN DE COBROS */}
        <div 
          onClick={() => navigateTo('payments')} 
          className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl cursor-pointer group hover:border-orange-500/50 hover:bg-zinc-800 transition-all relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl">
              <CreditCard size={28}/>
            </div>
            <ChevronRight size={24} className="text-zinc-700 group-hover:text-orange-500 transition-all"/>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tighter mb-2 mt-2 relative z-10">
            Cobros
          </h3>
          <p className="text-xs text-zinc-500 font-black uppercase tracking-widest relative z-10">
            Gestionar deudas
          </p>
        </div>
      </div>

      {/* ACCIONES RÁPIDAS */}
      <div>
        <h3 className="text-white font-bold uppercase text-sm tracking-widest mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <button 
            onClick={() => navigateTo('routines')}
            className="flex items-center gap-4 p-5 bg-black/40 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors text-left group"
          >
            <div className="p-3 bg-zinc-900 group-hover:bg-yellow-400/10 group-hover:text-yellow-400 text-zinc-500 rounded-xl transition-colors">
              <Layout size={20}/>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-0.5">Crear Plantilla</h4>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Arma nuevas rutinas base</p>
            </div>
          </button>

          <button 
            onClick={() => navigateTo('calendar')}
            className="flex items-center gap-4 p-5 bg-black/40 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors text-left group"
          >
            <div className="p-3 bg-zinc-900 group-hover:bg-yellow-400/10 group-hover:text-yellow-400 text-zinc-500 rounded-xl transition-colors">
              <CalendarIcon size={20}/>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-0.5">Ver Agenda Global</h4>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Planificación de todos</p>
            </div>
          </button>

        </div>
      </div>

      {/* --- MODAL DETALLE DE INGRESOS --- */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2.5rem] border border-green-500/30 shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>

            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                  <DollarSign className="text-green-500" size={20}/> Ingresos
                </h2>
                <p className="text-green-500 font-black text-2xl tracking-tighter mt-1">
                  {formatMoney(monthlyIncome)}
                </p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
                  Mes en curso
                </p>
              </div>
              <button 
                onClick={() => setIsIncomeModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {paidClientsDetail.length > 0 ? (
                paidClientsDetail.map((pay, i) => {
                  
                  const dateString = pay.paidAt.toLocaleDateString('es-ES', { 
                    day: '2-digit', 
                    month: 'short' 
                  });

                  return (
                    <div 
                      key={i} 
                      className="p-4 bg-black/40 rounded-2xl flex justify-between items-center border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-green-500/10 text-green-500 rounded-xl shrink-0">
                           <CheckCircle size={16}/>
                         </div>
                         <div>
                           <p className="text-white font-black uppercase text-sm leading-none truncate max-w-[140px]">
                             {pay.clientName}
                           </p>
                           <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-1.5">
                             Periodo: {pay.period} | {dateString}
                           </p>
                         </div>
                      </div>
                      
                      <span className="text-green-400 font-black text-sm shrink-0">
                        {pay.amount > 0 ? formatMoney(pay.amount) : 'Sin Precio'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-black/30">
                  <DollarSign size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                    No hay cobros registrados en este mes.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
               <button 
                  onClick={() => {
                    setIsIncomeModalOpen(false);
                    navigateTo('payments');
                  }} 
                  className="w-full py-4 text-black font-black uppercase tracking-widest text-xs bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors shadow-lg shadow-yellow-400/20"
                >
                  Ir al Panel de Cobros
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
