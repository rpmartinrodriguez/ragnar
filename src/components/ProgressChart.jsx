import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, TrendingUp, Calendar as CalIcon, Dumbbell } from 'lucide-react';

export default function ProgressChart({ clientId }) {
  const [sessions, setSessions] = useState([]);
  const [exercisesList, setExercisesList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar datos
  useEffect(() => {
    if (!clientId) return;
    const q = query(collection(db, 'clients', clientId, 'sessions'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetchedSessions = snap.docs.map(doc => doc.data()).filter(s => s.isFinalized && s.exercises);
      setSessions(fetchedSessions);

      const uniqueEx = new Set();
      fetchedSessions.forEach(sess => {
        sess.exercises.forEach(ex => {
          if (ex.name) uniqueEx.add(ex.name);
        });
      });
      
      const exArray = Array.from(uniqueEx).sort();
      setExercisesList(exArray);
      
      if (exArray.length > 0 && !selectedExercise) {
        setSelectedExercise(exArray[0]); 
      }
      setLoading(false);
    });
    return () => unsub();
  }, [clientId, selectedExercise]);

  // Procesar datos para el gráfico
  useEffect(() => {
    if (!selectedExercise || sessions.length === 0) return;
    const data = [];
    
    sessions.forEach(sess => {
      const exObj = sess.exercises.find(e => e.name === selectedExercise);
      if (exObj && exObj.actualSets) {
        let maxWeight = 0;
        exObj.actualSets.forEach(set => {
          if (set.completed && set.weight) {
            const w = parseFloat(set.weight);
            if (!isNaN(w) && w > maxWeight) maxWeight = w;
          }
        });
        
        if (maxWeight > 0) {
          const [y, m, d] = sess.date.split('-');
          data.push({ date: `${d}/${m}`, peso: maxWeight });
        }
      }
    });
    setChartData(data);
  }, [selectedExercise, sessions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Activity className="animate-spin text-yellow-400" size={32}/>
      </div>
    );
  }

  // Calcular el máximo peso histórico para escalar las barras proporcionalmente
  const absoluteMaxWeight = chartData.length > 0 ? Math.max(...chartData.map(d => d.peso)) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 shadow-xl animate-in fade-in">
      
      {/* TARJETAS DE RESUMEN GLOBAL */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="bg-green-500/10 p-2 rounded-xl text-green-500"><CalIcon size={20}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Días Entrenados</p>
            <p className="text-2xl font-black text-white">{sessions.length}</p>
          </div>
        </div>
        <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="bg-yellow-400/10 p-2 rounded-xl text-yellow-400"><Dumbbell size={20}/></div>
          <div>
            <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Récord Actual</p>
            <p className="text-2xl font-black text-white">{absoluteMaxWeight > 0 ? `${absoluteMaxWeight}kg` : '-'}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400"><TrendingUp size={24}/></div>
        <div>
          <h3 className="text-white font-bold uppercase tracking-widest text-sm">Evolución de Fuerza</h3>
          <p className="text-zinc-500 text-[10px] uppercase font-black mt-1">Peso Máximo Diario por Ejercicio</p>
        </div>
      </div>

      <div className="mb-6">
        <select 
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none font-bold uppercase tracking-wide"
          value={selectedExercise}
          onChange={e => setSelectedExercise(e.target.value)}
        >
          {exercisesList.length === 0 ? <option value="">Sin datos suficientes...</option> : null}
          {exercisesList.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
      </div>

      {/* GRÁFICO DE BARRAS NATIVO (CSS PURO) */}
      <div className="h-48 w-full bg-black/30 rounded-2xl border border-zinc-800 p-4 flex items-end justify-between gap-2 overflow-x-auto custom-scrollbar">
        {chartData.length > 0 ? (
          chartData.map((dataPoint, idx) => {
            // Calculamos la altura de la barra en porcentaje (mínimo 10% para que se vea)
            const heightPercent = Math.max((dataPoint.peso / absoluteMaxWeight) * 100, 10);
            
            return (
              <div key={idx} className="flex flex-col items-center justify-end h-full min-w-[40px] group relative">
                {/* Tooltip Hover */}
                <div className="absolute -top-8 bg-zinc-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {dataPoint.peso} kg
                </div>
                
                {/* Barra */}
                <div 
                  className="w-full bg-yellow-400 hover:bg-yellow-300 rounded-t-sm transition-all duration-500"
                  style={{ height: `${heightPercent}%` }}
                ></div>
                
                {/* Fecha */}
                <span className="text-[9px] font-black text-zinc-500 mt-2">{dataPoint.date}</span>
              </div>
            );
          })
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
            <Activity size={32} className="mb-2 opacity-50"/>
            <p className="text-[10px] uppercase font-black tracking-widest text-center px-4">
              Registra el peso en tus entrenamientos para ver el gráfico.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
