import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit, Video, Dumbbell, X, PlayCircle } from 'lucide-react';

export default function ExercisesView({ 
  exercises = [], 
  onAddExercise, 
  onUpdateExercise, 
  onDeleteExercise 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    videoUrl: ''
  });

  // Aseguramos que sea un array válido y lo ordenamos alfabéticamente de la A a la Z
  const safeExercises = Array.isArray(exercises) 
    ? [...exercises].sort((a, b) => (a.name || '').localeCompare(b.name || '')) 
    : [];

  // Filtrado por buscador a prueba de errores
  const filteredExercises = safeExercises.filter(ex => {
    if (!ex || !ex.name) return false;
    return String(ex.name).toLowerCase().includes(searchTerm.toLowerCase());
  });

  // --- MANEJO DEL MODAL ---
  const openAddModal = () => {
    setEditingExercise(null);
    setFormData({ name: '', videoUrl: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: String(exercise.name || ''),
      videoUrl: String(exercise.videoUrl || '')
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || String(formData.name).trim() === '') return;

    const dataToSave = {
      name: String(formData.name),
      videoUrl: String(formData.videoUrl)
    };

    if (editingExercise) {
      if (typeof onUpdateExercise === 'function') {
        onUpdateExercise({ ...editingExercise, ...dataToSave });
      }
    } else {
      if (typeof onAddExercise === 'function') {
        onAddExercise(dataToSave);
      }
    }
    
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Dumbbell className="text-yellow-400" size={28}/>
            Biblioteca Global
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Gestiona tu base de datos de ejercicios y videos.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-zinc-500" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar ejercicio..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-yellow-400 text-sm transition-colors" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shrink-0"
          >
            <Plus size={18}/> <span className="hidden sm:inline">Nuevo Ejercicio</span>
          </button>
        </div>
      </div>

      {/* LISTA VERTICAL DE EJERCICIOS (ESTILO FILAS) */}
      <div className="space-y-2">
        {filteredExercises.length > 0 ? (
          filteredExercises.map((ex, idx) => (
            <div 
              key={ex.id || idx} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-900 hover:border-yellow-400/30 transition-all group"
            >
              
              {/* IZQUIERDA: ICONO Y NOMBRE */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 bg-zinc-950 text-zinc-500 border border-zinc-800 rounded-lg flex items-center justify-center shrink-0 group-hover:text-yellow-400 group-hover:border-yellow-400/30 transition-colors">
                  <Dumbbell size={18} />
                </div>
                <h3 className="text-white font-bold text-sm md:text-base uppercase tracking-tight">
                  {ex.name}
                </h3>
              </div>

              {/* DERECHA: BOTONES DE ACCIÓN (EN COLUMNAS) */}
              <div className="flex items-center justify-end gap-2 border-t sm:border-t-0 border-zinc-800/50 pt-3 sm:pt-0 w-full sm:w-auto shrink-0">
                
                {/* Botón de Video */}
                {ex.videoUrl ? (
                  <a 
                    href={ex.videoUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors mr-2" 
                    title="Ver video explicativo"
                  >
                    <PlayCircle size={16}/> <span className="hidden sm:inline">Ver Video</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800/50 text-zinc-600 rounded-lg text-[10px] font-black uppercase tracking-widest mr-2 cursor-not-allowed" title="Sin video asignado">
                    <Video size={16} className="opacity-50"/> <span className="hidden sm:inline opacity-50">Sin Video</span>
                  </span>
                )}
                
                {/* Botón Editar */}
                <button 
                  onClick={() => openEditModal(ex)} 
                  className="p-2.5 bg-zinc-950 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 border border-zinc-800 hover:border-blue-500/30 rounded-lg transition-colors" 
                  title="Editar Nombre o Video"
                >
                  <Edit size={16}/>
                </button>
                
                {/* Botón Eliminar */}
                <button 
                  onClick={() => typeof onDeleteExercise === 'function' && onDeleteExercise(ex.id)} 
                  className="p-2.5 bg-zinc-950 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 border border-zinc-800 hover:border-red-500/30 rounded-lg transition-colors" 
                  title="Eliminar de la biblioteca"
                >
                  <Trash2 size={16}/>
                </button>

              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <Dumbbell size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
              {searchTerm ? 'No se encontraron ejercicios con ese nombre' : 'La biblioteca está vacía'}
            </p>
          </div>
        )}
      </div>

      {/* --- MODAL CREAR / EDITAR EJERCICIO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                {editingExercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                type="button"
                className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  Nombre del Ejercicio
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Press de Banca con Mancuernas"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  Link del Video Explicativo (Opcional)
                </label>
                <input 
                  type="url" 
                  placeholder="https://youtube.com/..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" 
                  value={formData.videoUrl} 
                  onChange={e => setFormData({...formData, videoUrl: e.target.value})} 
                />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20"
                >
                  {editingExercise ? 'Guardar Cambios' : 'Crear Ejercicio'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
