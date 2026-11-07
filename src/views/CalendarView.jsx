import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar as CalendarIcon, Dumbbell, User, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CalendarView({ clients }) {
  const [date, setDate] = useState(new Date());
  const [daySessions, setDaySessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Formateador de fecha a YYYY-MM-DD
  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchAgenda = async () => {
      setLoading(true);
      const dateId = formatDateId(date);
      const sessionsFound = [];

      try {
        // Buscamos si los clientes activos tienen una rutina asignada para este día exacto
        const promises = clients.map(async (client) => {
          const sessionRef = doc(db, 'clients', client.id, 'sessions', dateId);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const data = sessionSnap.data();
            // Solo lo agregamos si tiene ejercicios asignados
            if (data.exercises && data.exercises.length > 0) {
              sessionsFound.push({
                clientId: client.id,
                clientName: client.name,
                clientPlan: client.plan,
                ...data
              });
            }
          }
        });

        await Promise.all(promises);
        setDaySessions(sessionsFound);
      } catch (error) {
        console.error("Error cargando la agenda del día:", error);
      } finally {
        setLoading(false);
      }
    };

    if (clients.length > 0) {
      fetchAgenda();
    } else {
      setDaySessions([]);
      setLoading(false);
    }
  }, [date, clients]);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Agenda General</h2>
          <p className="text-zinc-500 text-sm font-medium">
            Revisa quiénes entrenan y qué rutinas tienen asignadas cada día.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl sticky top-4">
            <h3 className="text-white font-bold uppercase mb-6 text-xs tracking-widest flex items-center gap-2">
              <CalendarIcon size={18} className="text-yellow-400"/> Seleccionar Fecha
            </h3>
            <Calendar 
              onChange={setDate} 
              value={date} 
              className="react-calendar-custom" 
            />
          </div>
        </div>

        {/* COLUMNA DERECHA: LISTA DE ATLETAS DEL DÍA */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 flex flex-col min-h-[500px] shadow-xl overflow-hidden">
            
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mt-1">
                {daySessions.length} {daySessions.length === 1 ? 'Atleta programado' : 'Atletas programados'}
              </p>
            </div>

            <div className="flex-1 p-6 space-y-4 bg-zinc-950/20">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400"></div>
                </div>
              ) : daySessions.length > 0 ? (
                daySessions.map((session, idx) => (
                  <div key={idx} className="bg-black p-5 rounded-2xl border border-zinc-800 hover:border-yellow-400/50 transition-all shadow-md">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-900 text-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl border border-zinc-800 shrink-0">
                          {session.clientName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-black text-white text-lg uppercase tracking-tight">{session.clientName}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-1">
                              {/* Aquí estaba el Dumbbell que faltaba importar */}
                              <Dumbbell size={12} className="text-yellow-400"/> {session.clientPlan || 'Plan Base'}
                            </span>
                            <span>•</span>
                            <span>{session.exercises.length} Ejercicios</span>
                          </div>
                        </div>
                      </div>

                      {/* ESTADO DE LA SESIÓN */}
                      <div className="flex items-center sm:justify-end shrink-0">
                        {session.isFinalized ? (
                          <div className="bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">Completado</span>
                          </div>
                        ) : session.missedReason ? (
                          <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-500" />
                            <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">Falta</span>
                          </div>
                        ) : (
                          <div className="bg-zinc-800/50 border border-zinc-700 px-3 py-2 rounded-xl flex items-center gap-2">
                            <Clock size={16} className="text-zinc-400" />
                            <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Pendiente</span>
                          </div>
                        )}
                      </div>
                      
                    </div>

                    {/* Previsualización rápida de los ejercicios */}
                    <div className="mt-4 pt-4 border-t border-zinc-800/50">
                      <p className="text-xs text-zinc-400 font-medium truncate">
                        <span className="font-bold text-white">Rutina:</span> {session.exercises.map(ex => ex.name).join(', ')}
                      </p>
                    </div>

                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                    <User size={32} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">
                    Sin actividad programada
                  </p>
                  <p className="text-zinc-600 text-xs font-medium mt-2 max-w-[250px]">
                    No hay atletas con rutinas asignadas para esta fecha.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
