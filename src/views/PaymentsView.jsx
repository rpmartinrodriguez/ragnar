import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CreditCard, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar as CalendarIcon, 
  User, 
  RefreshCcw, 
  History, 
  X, 
  CalendarDays,
  BarChart3
} from 'lucide-react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function PaymentsView({ clients, settings }) {
  // --- ESTADOS PRINCIPALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [allDebts, setAllDebts] = useState({});

  // --- ESTADOS DEL HISTORIAL INDIVIDUAL ---
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- ESTADOS DEL HISTORIAL GLOBAL (ADMIN) ---
  const [globalHistoryModalOpen, setGlobalHistoryModalOpen] = useState(false);
  const [globalHistoryData, setGlobalHistoryData] = useState([]);
  const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false);

  // --- FORMATEADOR DE MONEDA ---
  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  // --- LÓGICA DE CÁLCULO DE CICLOS, DEUDA Y ADELANTOS ---
  const calculateClientDebt = async (client) => {
    if (!client.startDate) {
      return null;
    }

    const today = new Date();
    const startParts = client.startDate.split('-'); // Formato: YYYY-MM-DD
    const startYear = parseInt(startParts[0]);
    const startMonth = parseInt(startParts[1]);
    const startDay = parseInt(startParts[2]);

    const cycles = [];
    const limitDate = new Date();
    
    if (today.getDate() < startDay) {
        limitDate.setMonth(limitDate.getMonth() - 1);
    }

    let tempDate = new Date(startYear, startMonth - 1, 1);
    let todayComparison = new Date(limitDate.getFullYear(), limitDate.getMonth(), 1);

    while (tempDate <= todayComparison) {
      const yearStr = tempDate.getFullYear();
      const monthStr = String(tempDate.getMonth() + 1).padStart(2, '0');
      cycles.push(`${yearStr}-${monthStr}`);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    const paymentsRef = collection(db, 'clients', client.id, 'payments');
    const paymentsSnap = await getDocs(paymentsRef);
    
    const paidPeriods = paymentsSnap.docs
      .filter((d) => d.data().status === 'paid')
      .map((d) => d.id);

    const pendingCycles = cycles.filter((c) => !paidPeriods.includes(c));

    let planCost = 0;
    if (settings && settings.plans) {
      const assignedPlan = settings.plans.find((p) => p.name === client.plan);
      if (assignedPlan) {
        planCost = parseFloat(assignedPlan.price);
      }
    }

    // Cálculo del próximo mes adelantado
    while (paidPeriods.includes(`${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`)) {
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
    const advanceCycleId = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      pendingCycles: pendingCycles,
      advanceCycle: advanceCycleId,
      planCost: planCost,
      startDay: startDay,
      totalDebt: pendingCycles.length * planCost,
      isUpToDate: pendingCycles.length === 0
    };
  };

  // --- EFECTO PARA CARGAR TODAS LAS DEUDAS ---
  useEffect(() => {
    const fetchAllDebts = async () => {
      setLoading(true);
      const debts = {};
      
      for (const client of clients) {
        if (client.active === false) {
          continue;
        }
        
        const res = await calculateClientDebt(client);
        if (res) {
          debts[client.id] = res;
        }
      }
      
      setAllDebts(debts);
      setLoading(false);
    };

    if (clients && clients.length > 0) {
      fetchAllDebts();
    } else {
      setLoading(false);
    }
  }, [clients, settings]);

  // --- FORMATEADOR DE PERIODOS ---
  const formatPeriodName = (periodId) => {
    if (!periodId) return '';
    const [year, month] = periodId.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };

  // --- MARCAR UN MES COMO PAGADO ---
  const handleMarkAsPaid = async (client, periodId, isAdvance = false) => {
    const debtInfo = allDebts[client.id];
    
    if (!debtInfo) {
      return;
    }

    const typeMsg = isAdvance ? 'por ADELANTADO' : 'pendiente';
    const confirmMessage = `¿Registrar pago ${typeMsg} de ${formatPeriodName(periodId)} por $${debtInfo.planCost}?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await setDoc(doc(db, 'clients', client.id, 'payments', periodId), {
        status: 'paid',
        amount: debtInfo.planCost,
        planName: client.plan || 'Sin Plan',
        paidAt: new Date(),
        clientName: client.name 
      });
      
      setAllDebts((prev) => {
        const currentClientInfo = prev[client.id];
        
        if (isAdvance) {
          const [year, month] = periodId.split('-');
          const nextAdvanceDate = new Date(parseInt(year), parseInt(month), 1); 
          const nextAdvanceId = `${nextAdvanceDate.getFullYear()}-${String(nextAdvanceDate.getMonth() + 1).padStart(2, '0')}`;
          
          return {
            ...prev,
            [client.id]: {
              ...currentClientInfo,
              advanceCycle: nextAdvanceId
            }
          };
        } else {
          const newPending = currentClientInfo.pendingCycles.filter((c) => c !== periodId);
          return {
            ...prev,
            [client.id]: {
              ...currentClientInfo,
              pendingCycles: newPending,
              isUpToDate: newPending.length === 0
            }
          };
        }
      });

    } catch (error) { 
      console.error("Error al marcar pago:", error); 
    }
  };

  // --- ABRIR HISTORIAL INDIVIDUAL ---
  const handleOpenHistory = async (client) => {
    setHistoryClient(client);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    
    try {
      const snap = await getDocs(collection(db, 'clients', client.id, 'payments'));
      const docs = snap.docs.map((d) => {
        return { id: d.id, ...d.data() };
      });
      
      docs.sort((a, b) => b.id.localeCompare(a.id));
      setHistoryData(docs);
    } catch (error) { 
      console.error("Error cargando historial:", error); 
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- ABRIR HISTORIAL GLOBAL DE INGRESOS (ADMINISTRADOR) ---
  const handleOpenGlobalHistory = async () => {
    setGlobalHistoryModalOpen(true);
    setLoadingGlobalHistory(true);
    
    try {
      const historyMap = {};
      
      // Escaneamos a todos los clientes (activos o no, ya que es historial contable)
      for (const client of clients) {
        const snap = await getDocs(collection(db, 'clients', client.id, 'payments'));
        
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Solo contamos lo efectivamente pagado
          if (data.status === 'paid' && data.paidAt) {
            const d = data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt);
            // Agrupamos por Año-Mes (El mes en que ENTRÓ la plata, no el ciclo)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const amount = parseFloat(data.amount || 0);
            
            historyMap[key] = (historyMap[key] || 0) + amount;
          }
        });
      }
      
      // Transformamos el objeto a un array para renderizar
      const formattedHistory = Object.keys(historyMap).map(key => {
        const [year, month] = key.split('-');
        const dateObj = new Date(year, parseInt(month) - 1);
        return {
          id: key,
          label: dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
          amount: historyMap[key]
        };
      });

      // Ordenar del más reciente al más antiguo
      formattedHistory.sort((a, b) => b.id.localeCompare(a.id));
      setGlobalHistoryData(formattedHistory);
      
    } catch (error) {
      console.error("Error generando balance global:", error);
    } finally {
      setLoadingGlobalHistory(false);
    }
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredClients = clients.filter((c) => {
    if (c.active === false) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    return c.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
           <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
             <CreditCard className="text-yellow-400" size={28}/> Gestión de Cobros
           </h2>
           <p className="text-zinc-500 text-sm font-medium mt-1">
             Sincronizado con fecha de alta y planes asignados.
           </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* BOTÓN DE HISTORIAL GLOBAL */}
          <button 
            onClick={handleOpenGlobalHistory} 
            className="bg-zinc-900 border border-zinc-800 text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/30 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <BarChart3 size={18}/> Balance Global
          </button>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-3.5 text-zinc-500" size={18}/>
            <input 
              type="text" 
              placeholder="Buscar atleta..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm font-bold transition-colors" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {filteredClients.map((client) => {
            const info = allDebts[client.id];
            
            if (!info) {
              return null; 
            }

            return (
              <div 
                key={client.id} 
                className={`bg-zinc-900 border rounded-[2rem] p-6 transition-all shadow-xl flex flex-col h-full ${!info.isUpToDate ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-zinc-800 hover:border-zinc-700'}`}
              >
                
                {/* Cabecera de la Tarjeta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${!info.isUpToDate ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      <User size={24}/>
                    </div>
                    <div className="truncate pr-2">
                      <h3 className="font-black text-lg text-white uppercase leading-tight truncate max-w-[120px]">
                        {client.name}
                      </h3>
                      <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest truncate">
                        Plan: {client.plan || 'No asignado'}
                      </p>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0 ${info.isUpToDate ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'}`}>
                    {info.isUpToDate ? 'Al Día' : 'Con Deuda'}
                  </span>
                </div>

                {/* Alerta de Plan sin Precio */}
                {info.planCost === 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-2 mb-3">
                    <p className="text-orange-400 text-[9px] font-black uppercase text-center tracking-widest">
                      ⚠️ El plan asignado vale $0
                    </p>
                  </div>
                )}

                {/* Cuerpo de la Tarjeta: Pendientes o Pago Adelantado */}
                <div className="bg-black/40 rounded-2xl p-4 mb-4 border border-zinc-800/50 flex-1 flex flex-col">
                   
                   {!info.isUpToDate ? (
                     <>
                       <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3">
                         Meses Pendientes:
                       </p>
                       <div className="space-y-2">
                         {info.pendingCycles.map((cycle) => (
                           <div key={cycle} className="flex justify-between items-center bg-zinc-900/50 p-2 pl-3 rounded-xl border border-zinc-800">
                              <span className="text-white font-bold text-xs uppercase capitalize-first">
                                {formatPeriodName(cycle)}
                              </span>
                              <button 
                                onClick={() => handleMarkAsPaid(client, cycle, false)} 
                                className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-yellow-300 transition-colors shadow-md"
                              >
                                Cobrar {info.planCost > 0 ? `$${info.planCost}` : ''}
                              </button>
                           </div>
                         ))}
                       </div>
                     </>
                   ) : (
                     <div className="flex flex-col h-full justify-center">
                       <div className="text-center mb-4 mt-2">
                         <CheckCircle size={24} className="mx-auto text-green-500 mb-2"/>
                         <p className="text-green-500 text-xs font-bold uppercase tracking-widest">
                           Sin deudas
                         </p>
                       </div>
                       
                       {/* SECCIÓN PAGO ADELANTADO */}
                       <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 flex justify-between items-center mt-auto">
                          <div>
                            <p className="text-[9px] text-yellow-400/70 font-black uppercase tracking-widest mb-0.5">Adelantar Mes</p>
                            <span className="text-yellow-400 font-bold text-xs uppercase capitalize-first">
                              {formatPeriodName(info.advanceCycle)}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleMarkAsPaid(client, info.advanceCycle, true)} 
                            className="bg-yellow-400 text-black px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
                          >
                            Cobrar {info.planCost > 0 ? `$${info.planCost}` : ''}
                          </button>
                       </div>
                     </div>
                   )}
                </div>

                {/* Botón de Historial Individual */}
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleOpenHistory(client)} 
                    className="flex-1 py-3 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <History size={14}/> Detalle Alumno
                  </button>
                </div>

              </div>
            );
          })}
          
          {filteredClients.length === 0 && (
             <div className="col-span-full py-20 text-center bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
               <CreditCard size={48} className="mx-auto mb-4 text-zinc-600 opacity-50"/>
               <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
                 No hay atletas para mostrar
               </p>
             </div>
          )}
        </div>
      )}

      {/* --- MODAL DE HISTORIAL GLOBAL (NUEVO) --- */}
      {globalHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2.5rem] border border-zinc-800 shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-600"></div>

            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                  <BarChart3 className="text-yellow-400" size={20}/> Balance Global
                </h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
                  Ingresos totales por mes calendario
                </p>
              </div>
              <button 
                onClick={() => setGlobalHistoryModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {loadingGlobalHistory ? (
                <div className="flex justify-center py-10">
                  <RefreshCcw className="animate-spin text-yellow-400" size={32}/>
                </div>
              ) : globalHistoryData.length > 0 ? (
                globalHistoryData.map((record) => (
                  <div 
                    key={record.id} 
                    className="p-4 rounded-2xl border bg-black/40 border-zinc-800 flex justify-between items-center hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-400/10 text-yellow-400 rounded-xl">
                        <CalendarIcon size={18}/>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm uppercase capitalize-first">
                          {record.label}
                        </p>
                      </div>
                    </div>
                    <span className="text-green-400 font-black text-lg">
                      {formatMoney(record.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-black/30">
                  <BarChart3 size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                    Sin registros financieros
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
               <button 
                  onClick={() => setGlobalHistoryModalOpen(false)} 
                  className="w-full py-4 text-black font-black uppercase tracking-widest text-xs bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors shadow-lg shadow-yellow-400/20"
                >
                  Cerrar Reporte
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE HISTORIAL INDIVIDUAL --- */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2.5rem] border border-zinc-800 shadow-2xl flex flex-col max-h-[80vh]">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                  Historial de Pagos
                </h2>
                <p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  {historyClient?.name}
                </p>
              </div>
              <button 
                onClick={() => setHistoryModalOpen(false)} 
                className="text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <RefreshCcw className="animate-spin text-yellow-400" size={32}/>
                </div>
              ) : historyData.length > 0 ? (
                historyData.map((record) => {
                  
                  let dateString = "Sin fecha";
                  if (record.paidAt?.toDate) {
                    dateString = record.paidAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                  } else if (record.paidAt) {
                    dateString = new Date(record.paidAt).toLocaleDateString('es-ES');
                  }

                  return (
                    <div 
                      key={record.id} 
                      className="p-4 rounded-2xl border bg-black/40 border-zinc-800 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-white font-black text-sm uppercase capitalize-first">
                          {formatPeriodName(record.id)}
                        </p>
                        <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-1">
                          Pagado el: {dateString}
                        </p>
                      </div>
                      <span className="text-green-500 font-black text-sm">
                        ${record.amount}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <History size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                    Sin registros previos
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950 shrink-0">
               <button 
                  onClick={() => setHistoryModalOpen(false)} 
                  className="w-full py-4 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-xs bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
