import React, { useState, useEffect } from 'react';
import { 
  Layout, Plus, Trash2, Dumbbell, Save, ChevronRight, X, Video 
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function RoutinesView({ exercisesLibrary }) {
  const [routines, setRoutines] = useState([]);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  
  // --- ESTADOS DEL MODAL DE EJERCICIO (NUEVA ESTRUCTURA DINÁMICA) ---
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [newExData, setNewExData] = useState({ 
    name: '', 
    videoUrl: '', 
    plannedSets: [{ reps: '', rir: '2' }] 
  });

  // Colores para la escala RIR vieja (por si hay rutinas legacy)
  const rirColors = ['bg-[#ffe4c4]', 'bg-[#fcd34d]', 'bg-[#fbbf24]', 'bg-[#f97316]', 'bg-[#ef4444]', 'bg-[#b91c1c]'];

  // --- ESCUCHA DE RUTINAS GLOBALES ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // --- CREAR NUEVA PLANTILLA ---
  const handleCreateRoutine = async (e) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    try {
      await addDoc(collection(db, 'routines'), { 
        name: newRoutineName, 
        exercises: [], 
        createdAt: new Date() 
      });
      setNewRoutineName('');
      setIsCreating(false);
    } catch (error) { 
      console.error(error); 
    }
  };

  // --- ELIMINAR PLANTILLA ---
  const handleDeleteRoutine = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar esta plantilla por completo?')) {
      try {
        await deleteDoc(doc(db, 'routines', id));
        if (selectedRoutine?.id === id) setSelectedRoutine(null);
      } catch (error) {
        console.error(error);
      }
    }
  };

  // --- ABRIR MODAL PARA AGREGAR EJERCICIO ---
  const handleOpenAddModal = () => {
    setNewExData({
      name: exercisesLibrary?.length > 0 ? exercisesLibrary[0].name : '',
      videoUrl: exercisesLibrary?.length > 0 ? exercisesLibrary[0].videoUrl : '',
      plannedSets: [{ reps: '', rir: '2' }]
    });
    setIsAddingEx(true);
  };

  const handleSelectExercise = (e) => {
    const name = e.target.value;
    const found = exercisesLibrary.find(ex => ex.name === name);
    setNewExData({ ...newExData, name, videoUrl: found?.videoUrl || '' });
  };

  // --- MANEJO DE SERIES DINÁMICAS DENTRO DEL MODAL ---
  const addSet = () => {
    setNewExData(prev => ({
      ...prev,
      plannedSets: [...prev.plannedSets, { reps: '', rir: '2' }]
    }));
  };

  const removeSet = (indexToRemove) => {
    setNewExData(prev => ({
      ...prev,
      plannedSets: prev.plannedSets.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const updateSetField = (index, field, value) => {
    const updatedSets = [...newExData.plannedSets];
    updatedSets[index] = { ...updatedSets[index], [field]: value };
    setNewExData({ ...newExData, plannedSets: updatedSets });
  };

  // --- GUARDAR EJERCICIO EN LA PLANTILLA ---
  const handleSaveExerciseToRoutine = async (e) => {
    e.preventDefault();
    
    if (!newExData.name || !selectedRoutine || newExData.plannedSets.length === 0) {
      alert("Por favor selecciona un ejercicio y configura al menos una serie.");
      return;
    }
    
    // Adaptamos al nuevo formato universal
    const exerciseToSave = {
      id: Date.now(),
      name: String(newExData.name),
      videoUrl: String(newExData.videoUrl || ''),
      sets: String(newExData.plannedSets.length),
      reps: String(newExData.plannedSets[0]?.reps || ''),
      rir: String(newExData.plannedSets[0]?.rir || '2'),
      plannedSets: newExData.plannedSets
    };

    const updatedExercises = [...(selectedRoutine.exercises || []), exerciseToSave];
    
    try {
      await setDoc(doc(db, 'routines', selectedRoutine.id), { exercises: updatedExercises }, { merge: true });
      setSelectedRoutine({ ...selectedRoutine, exercises: updatedExercises });
      setIsAddingEx(false);
      setNewExData({ name: '', videoUrl: '', plannedSets: [{ reps: '', rir: '2' }] });
    } catch (error) { 
      console.error(error); 
    }
  };

  // --- REMOVER EJERCICIO DE LA PLANTILLA ---
  const handleRemoveExerciseFromRoutine = async (index) => {
    if (!window.confirm('¿Quitar este ejercicio de la plantilla?')) return;
    const updatedExercises = selectedRoutine.exercises.filter((_, i) => i !== index);
    try {
      await setDoc(doc(db, 'routines', selectedRoutine.id), { exercises: updatedExercises }, { merge: true });
      setSelectedRoutine({ ...selectedRoutine, exercises: updatedExercises });
    } catch (error) { 
      console.error(error); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Layout className="text-yellow-400" size={28}/> Plantillas
          </h2>
          <p className="text-zinc-500 text-sm">Crea rutinas prearmadas para asignar rápido a tus alumnos.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)} 
          className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)] flex items-center gap-2 shrink-0"
        >
          <Plus size={18}/> Nueva Plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: LISTA DE PLANTILLAS */}
        <div className="lg:col-span-1 space-y-3">
          {routines.map(routine => (
            <div 
              key={routine.id} 
              onClick={() => setSelectedRoutine(routine)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center group ${selectedRoutine?.id === routine.id ? 'bg-zinc-800 border-yellow-400 shadow-lg' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${selectedRoutine?.id === routine.id ? 'bg-yellow-400/10 text-yellow-400' : 'bg-black text-zinc-500 group-hover:text-yellow-400'}`}>
                  <Layout size={20}/>
                </div>
                <div>
                  <h3 className={`font-bold uppercase text-sm transition-colors ${selectedRoutine?.id === routine.id ? 'text-yellow-400' : 'text-white'}`}>
                    {routine.name}
                  </h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">
                    {routine.exercises?.length || 0} Ejercicios
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoutine(routine.id); }} 
                  className="text-zinc-600 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-zinc-800"
                  title="Eliminar Plantilla"
                >
                  <Trash2 size={16}/>
                </button>
                <ChevronRight size={18} className="text-zinc-600 group-hover:text-yellow-400 transition-colors"/>
              </div>
            </div>
          ))}
          {routines.length === 0 && (
            <div className="text-center py-10 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">No hay plantillas creadas</p>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: DETALLE DE PLANTILLA SELECCIONADA */}
        <div className="lg:col-span-2">
          {selectedRoutine ? (
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-xl flex flex-col h-[70vh]">
              
              <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{selectedRoutine.name}</h3>
                  <p className="text-[10px] text-yellow-400 uppercase font-black tracking-widest mt-1">Configuración Global</p>
                </div>
                <button 
                  onClick={handleOpenAddModal} 
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-colors shadow-lg"
                >
                  <Plus size={16}/> Agregar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {selectedRoutine.exercises && selectedRoutine.exercises.length > 0 ? (
                  selectedRoutine.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-black p-5 rounded-2xl border border-zinc-800 flex flex-col group transition-colors hover:border-zinc-700">
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <span className="bg-yellow-400/10 text-yellow-400 font-black w-10 h-10 rounded-xl flex items-center justify-center border border-yellow-400/20 shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-white text-lg leading-none uppercase tracking-tighter">{ex.name}</h4>
                              {ex.videoUrl && <Video size={16} className="text-blue-500"/>}
                            </div>
                            
                            {/* RENDERIZADO DE SERIES DINÁMICAS O VIEJAS */}
                            <div className="mt-3 space-y-1.5">
                              {ex.plannedSets ? (
                                ex.plannedSets.map((set, sIdx) => (
                                  <div key={sIdx} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-zinc-600 w-12 shrink-0">Set {sIdx + 1}:</span>
                                    <span className="text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700">{set.reps} Reps</span>
                                    <span className="text-yellow-400 bg-yellow-400/5 px-2 py-1 rounded border border-yellow-400/20">RIR {set.rir}</span>
                                  </div>
                                ))
                              ) : (
                                /* Fallback para rutinas viejas sin formato de plannedSets */
                                <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-widest">
                                  <span className="text-white">{ex.sets}</span> Sets x <span className="text-white">{ex.reps}</span> Reps
                                  {ex.rir && <span className="ml-2 text-yellow-400">RIR {ex.rir}</span>}
                                </p>
                              )}
                            </div>

                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveExerciseFromRoutine(idx)} 
                          className="text-zinc-600 hover:text-red-500 p-2 transition-colors opacity-100 lg:opacity-0 group-hover:opacity-100"
                          title="Quitar de la plantilla"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>

                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-700">
                    <Dumbbell size={64} className="mb-4 opacity-20"/>
                    <p className="text-sm font-black uppercase tracking-widest opacity-50">Plantilla Vacía</p>
                    <p className="text-[10px] uppercase font-bold mt-2 opacity-40">Haz clic en Agregar Ejercicio</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800 h-[70vh] flex flex-col items-center justify-center text-zinc-600">
              <Layout size={64} className="mb-4 opacity-20"/>
              <p className="font-black uppercase tracking-widest text-sm text-zinc-500">Selecciona una plantilla para editarla</p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL CREAR NUEVA RUTINA --- */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between bg-zinc-900/50">
              <h2 className="font-black text-white uppercase italic text-xl tracking-tighter">Nueva Plantilla</h2>
              <button onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-white transition-colors bg-zinc-800 p-1.5 rounded-full"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleCreateRoutine} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre identificador</label>
                <input 
                  type="text" 
                  autoFocus 
                  required 
                  placeholder="Ej. Pecho - Hipertrofia Día 1" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={newRoutineName} 
                  onChange={e => setNewRoutineName(e.target.value)} 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg hover:bg-yellow-300 transition-colors shadow-yellow-400/20"
              >
                Crear Plantilla
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL AGREGAR EJERCICIO A RUTINA (FORMATO SERIES DINÁMICAS) --- */}
      {isAddingEx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
              <h2 className="font-black text-white uppercase italic text-xl tracking-tighter">Configurar Ejercicio</h2>
              <button onClick={() => setIsAddingEx(false)} className="text-zinc-500 hover:text-white transition-colors bg-zinc-800 p-1.5 rounded-full"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveExerciseToRoutine} className="flex flex-col flex-1 overflow-hidden">
              
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* SELECTOR DE EJERCICIO */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Seleccionar de Biblioteca</label>
                  <select 
                    required 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none font-bold uppercase transition-colors" 
                    value={newExData.name} 
                    onChange={handleSelectExercise}
                  >
                    <option value="" disabled>Elegir ejercicio...</option>
                    {exercisesLibrary?.map(ex => (
                      <option key={ex.id || Math.random()} value={ex.name}>{ex.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* CREADOR DE SERIES */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Configurar Series</label>
                  
                  <div className="space-y-3">
                    {newExData.plannedSets.map((set, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-zinc-800 animate-in slide-in-from-bottom-2">
                        
                        <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 rounded-lg text-[10px] font-black text-zinc-500 shrink-0">
                          {idx + 1}
                        </div>

                        <input 
                          type="text" 
                          placeholder="Reps (ej: 10)" 
                          required
                          className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center font-bold text-xs outline-none focus:border-yellow-400" 
                          value={set.reps} 
                          onChange={e => updateSetField(idx, 'reps', e.target.value)} 
                        />
                        
                        <select 
                          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold text-xs outline-none focus:border-yellow-400" 
                          value={set.rir} 
                          onChange={e => updateSetField(idx, 'rir', e.target.value)}
                        >
                          {[0,1,2,3,4].map(v => (
                            <option key={v} value={v}>RIR {v}</option>
                          ))}
                        </select>
                        
                        <button 
                          type="button"
                          onClick={() => removeSet(idx)} 
                          disabled={newExData.plannedSets.length === 1} 
                          className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button"
                    onClick={addSet} 
                    className="w-full py-3 mt-3 border border-dashed border-zinc-700 text-zinc-500 hover:border-yellow-400 hover:text-yellow-400 hover:bg-yellow-400/5 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 rounded-xl transition-all"
                  >
                    <Plus size={14}/> Añadir Serie
                  </button>
                </div>

              </div>
              
              {/* BOTONES DE GUARDADO */}
              <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsAddingEx(false)} 
                  className="flex-1 py-4 text-zinc-500 font-bold uppercase text-xs bg-black rounded-xl border border-zinc-800 transition-colors hover:bg-zinc-900"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-yellow-400 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-yellow-400/20 hover:bg-yellow-300 transition-colors"
                >
                  Guardar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
