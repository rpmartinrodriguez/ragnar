import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Dumbbell, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Activity, 
  Droplets, 
  Target, 
  Video, 
  X, 
  CheckCircle, 
  Copy, 
  ClipboardPaste, 
  MessageSquare, 
  TrendingUp, 
  Send,
  CalendarDays
} from 'lucide-react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  updateDoc,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { db } from '../firebase';
import ProgressChart from '../components/ProgressChart';

// Evitamos sobrescribir días en los que el alumno ya entrenó, dejó notas o
// informó una ausencia. Reutilizable para pegado individual, rango y plantillas.
function sessionHasProtectedHistory(data = {}) {
  if (data.isFinalized || data.completedAt ||
      String(data.studentNote || '').trim() ||
      String(data.missedReason || '').trim()) return true;
  return Array.isArray(data.exercises) && data.exercises.some(ex =>
    Array.isArray(ex.actualSets) && ex.actualSets.some(set =>
      set && (set.completed === true ||
        String(set.reps ?? '').trim() !== '' ||
        String(set.weight ?? '').trim() !== '')
    )
  );
}

async function ensureSessionIsSafeToPlan(sessionRef) {
  const snapshot = await getDocFromServer(sessionRef);
  if (snapshot.exists() && sessionHasProtectedHistory(snapshot.data())) {
    throw new Error('La fecha ' + sessionRef.id +
      ' ya tiene actividad registrada o una observación del alumno. Por seguridad no se sobrescribió.');
  }
}

export default function ClientDetailView({ client, goBack, exercisesLibrary = [], routines = [] }) {
  // --- ESTADOS DE PESTAÑAS Y NAVEGACIÓN ---
  const [activeTab, setActiveTab] = useState('planificacion'); 
  const [date, setDate] = useState(new Date());
  
  // --- ESTADOS DE LA SESIÓN DEL DÍA ---
  const [dailySession, setDailySession] = useState([]); 
  const [hydrationTarget, setHydrationTarget] = useState('');
  const [cardioTargetMinutes, setCardioTargetMinutes] = useState('');
  const [cardioTargetIntensity, setCardioTargetIntensity] = useState('Baja');
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  const [studentNote, setStudentNote] = useState('');
  const [studentNoteUpdatedAt, setStudentNoteUpdatedAt] = useState(null);
  
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoadError, setSessionLoadError] = useState('');

  // --- ESTADOS DE PORTAPAPELES (COPIAR Y PEGAR) ---
  const [clipboardType, setClipboardType] = useState(null); // 'day' | 'range'
  const [clipboardSingleDay, setClipboardSession] = useState(null);
  const [clipboardRangeData, setClipboardRangeData] = useState([]);
  const [clipboardStartDayOfWeek, setClipboardStartDayOfWeek] = useState(null);

  // --- ESTADOS DE MODALES ---
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);

  // --- ESTADOS DEL MODAL RANGO (SELECCIÓN DUAL EN CALENDARIO) ---
  const [dateRange, setDateRange] = useState([new Date(), new Date()]);

  // --- ESTADOS DE CHAT ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // --- FORMULARIO DE EJERCICIO INDIVIDUAL ---
  const [exForm, setExForm] = useState({
    name: '',
    videoUrl: '',
    plannedSets: [{ reps: '', rir: '2' }] 
  });

  // --- FORMATEO DE FECHAS PARA FIREBASE ---
  const formatDateId = (d) => {
    if (!d) {
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
  };

  const currentDateId = formatDateId(date);

  // Calendario: cargar una vez por alumno, no volver a consultar todo su
  // historial cada vez que elegimos una fecha del calendario.
  useEffect(() => {
    if (!client?.id) return;
    let active=true;
    getDocs(collection(db,'clients',client.id,'sessions'))
      .then(snapshot=>{
        if (!active) return;
        setAllSessionsIds(snapshot.docs
          .filter(d=>Array.isArray(d.data().exercises)&&d.data().exercises.length>0)
          .map(d=>d.id));
      })
      .catch(error=>{
        if(active) setSessionLoadError('No se pudo cargar el calendario: '+(error?.code||'error de conexión'));
      });
    return ()=>{active=false;};
  }, [client?.id]);

  // Rutina del día: suscripción independiente, en tiempo real.
  useEffect(() => {
    if(!client?.id)return;
    setLoading(true);
    setSessionLoadError('');
    const sessionDocRef=doc(db,'clients',client.id,'sessions',currentDateId);
    const unsubDaily=onSnapshot(sessionDocRef,snapshot=>{
      if(snapshot.exists()){
        const data=snapshot.data();
        setDailySession(Array.isArray(data.exercises)?data.exercises:[]);
        setIsSessionFinalized(data.isFinalized||false);
        setStudentNote(String(data.studentNote||''));
        setStudentNoteUpdatedAt(data.studentNoteUpdatedAt||null);
        setHydrationTarget(data.targetHydration||'');
        setCardioTargetMinutes(data.targetCardioMinutes||'');
        setCardioTargetIntensity(data.targetCardioIntensity||'Baja');
      }else{
        setDailySession([]);
        setIsSessionFinalized(false);
        setStudentNote('');
        setStudentNoteUpdatedAt(null);
        setHydrationTarget('');
        setCardioTargetMinutes('');
        setCardioTargetIntensity('Baja');
      }
      setLoading(false);
    },error=>{
      setLoading(false);
      setSessionLoadError('No se pudo cargar esta rutina: '+(error?.code||'revisá tu conexión'));
    });
    return ()=>unsubDaily();
  }, [client?.id, currentDateId]);

  // --- ESCUCHA DE CHAT EN TIEMPO REAL ---
  useEffect(() => {
    if (!client?.id) {
      return;
    }
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      
      if (activeTab === 'mensajes') {
        msgs.forEach(async (msg) => {
          if (msg.sender === 'student' && !msg.read) {
            await updateDoc(doc(db, 'clients', client.id, 'messages', msg.id), { read: true });
          }
        });
      }
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    });
    return () => unsubscribe();
  }, [client, activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      return;
    }
    try {
      await addDoc(collection(db, 'clients', client.id, 'messages'), { 
        text: newMessage, 
        sender: 'trainer', 
        createdAt: new Date(), 
        read: false 
      });
      setNewMessage('');
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setLoading(true);
  };

  // --- OPERACIÓN 1: COPIAR Y PEGAR UN DÍA INDIVIDUAL ---
  const handleCopyDay = () => {
    if (dailySession.length === 0) {
      alert("No hay ejercicios en este día para copiar.");
      return;
    }
    setClipboardType('day');
    setClipboardSession({
      exercises: dailySession,
      hydration: hydrationTarget,
      cardioMin: cardioTargetMinutes,
      cardioInt: cardioTargetIntensity
    });
    alert(`Día copiado (${date.toLocaleDateString()}). Elige otra fecha y haz clic en Pegar.`);
  };

  // --- OPERACIÓN 2: COPIAR UN RANGO COMPLETO (USANDO CALENDARIO DUAL) ---
  const handleCopyRange = async () => {
    if (!dateRange || dateRange.length !== 2) {
      alert("Por favor selecciona un rango de fechas válido.");
      return;
    }
    
    const [start, end] = dateRange;
    
    if (start > end) {
      alert("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }

    try {
      setLoading(true);
      const startId = formatDateId(start);
      const endId = formatDateId(end);

      const querySnapshot = await getDocs(collection(db, 'clients', client.id, 'sessions'));
      
      // Filtramos en memoria todos los días que caen dentro del rango seleccionado
      const filteredDays = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.id >= startId && d.id <= endId && d.exercises && d.exercises.length > 0);

      if (filteredDays.length === 0) {
        alert("No se encontraron entrenamientos planificados en el rango seleccionado.");
        setLoading(false);
        return;
      }

      setClipboardType('range');
      setClipboardRangeData(filteredDays);
      setClipboardStartDayOfWeek(start.getDay()); 

      setIsRangeModalOpen(false);
      alert(`Rango copiado con éxito (${filteredDays.length} días con rutinas encontradas).`);
    } catch (error) {
      console.error(error);
      alert("Error al copiar el rango.");
    } finally {
      setLoading(false);
    }
  };

  // --- COPIA/PEGADO PROTEGIDO: NUNCA BORRAR SESIONES HISTÓRICAS ---
  const handlePasteClipboard = async () => {
    if(!clipboardType || loading) return;

    if(clipboardType === 'day' && clipboardSingleDay) {
      if(!window.confirm('¿Pegar una copia LIMPIA de la rutina en ' +
          date.toLocaleDateString('es-AR') +
          '? Se reemplazará la planificación si todavía no hay actividad registrada.')) return;
      setLoading(true);
      try {
        const targetRef=doc(db,'clients',client.id,'sessions',currentDateId);
        await ensureSessionIsSafeToPlan(targetRef);
        const cleanExercises=clipboardSingleDay.exercises.map(ex=>({
          ...ex, plannedSets:Array.isArray(ex.plannedSets)?ex.plannedSets.map(set=>({...set})):ex.plannedSets,
          actualSets:[]
        }));
        await setDoc(targetRef,{
          date:currentDateId,
          exercises:cleanExercises,
          targetHydration:clipboardSingleDay.hydration||'',
          targetCardioMinutes:clipboardSingleDay.cardioMin||'',
          targetCardioIntensity:clipboardSingleDay.cardioInt||'Baja',
          isFinalized:false
        },{merge:true});
        setAllSessionsIds(prev=>prev.includes(currentDateId)?prev:[...prev,currentDateId]);
        window.alert('La rutina se copió al día seleccionado. No se modificaron sesiones realizadas.');
      }catch(error){
        window.alert('No se pudo pegar la rutina: '+(error?.message||'revisá tu conexión'));
      }finally{setLoading(false);}
      return;
    }

    if(clipboardType==='range' && clipboardRangeData.length) {
      const targetDayOfWeek=date.getDay();
      const pasteStartDate=new Date(date);
      if(targetDayOfWeek!==clipboardStartDayOfWeek) {
        const names=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        if(window.confirm('El bloque comenzaba un '+names[clipboardStartDayOfWeek]+
          '. ¿Querés alinearlo al mismo día de esta semana?')) {
          pasteStartDate.setDate(pasteStartDate.getDate()+
            (clipboardStartDayOfWeek-targetDayOfWeek));
        }
      }
      const source=[...clipboardRangeData].sort((a,b)=>a.id.localeCompare(b.id));
      if(source.length>90){
        window.alert('Por seguridad, copiá bloques de hasta 90 jornadas con ejercicios.');
        return;
      }
      if(!window.confirm('¿Copiar '+source.length+' días de entrenamiento a partir del '+
        pasteStartDate.toLocaleDateString('es-AR')+
        '? La operación se cancela si alguna fecha ya tiene actividad o notas del alumno.')) return;
      setLoading(true);
      try{
        const originalStart=new Date(source[0].id+'T12:00:00');
        const writes=source.map(session=>{
          const original=new Date(session.id+'T12:00:00');
          const offset=Math.round((original-originalStart)/86400000);
          const targetDate=new Date(pasteStartDate);
          targetDate.setDate(targetDate.getDate()+offset);
          const id=formatDateId(targetDate);
          const ref=doc(db,'clients',client.id,'sessions',id);
          return {ref,id, data:{
            date:id,
            exercises:session.exercises.map(ex=>({
              ...ex,
              plannedSets:Array.isArray(ex.plannedSets)?ex.plannedSets.map(set=>({...set})):ex.plannedSets,
              actualSets:[]
            })),
            targetHydration:session.targetHydration||'',
            targetCardioMinutes:session.targetCardioMinutes||'',
            targetCardioIntensity:session.targetCardioIntensity||'Baja',
            isFinalized:false
          }};
        });
        if(new Set(writes.map(w=>w.id)).size!==writes.length){
          throw new Error('Las fechas del bloque se superponen; revisá el rango copiado.');
        }
        // Verificamos todas las fechas ANTES de ejecutar el batch.
        await Promise.all(writes.map(w=>ensureSessionIsSafeToPlan(w.ref)));
        const batch=writeBatch(db);
        writes.forEach(w=>batch.set(w.ref,w.data,{merge:true}));
        await batch.commit();
        setAllSessionsIds(prev=>Array.from(new Set([...prev,...writes.map(w=>w.id)])));
        window.alert('Se copiaron '+writes.length+' días sin sobrescribir historiales de entrenamiento.');
      }catch(error){
        window.alert('No se aplicó el bloque: '+(error?.message||'revisá tu conexión'));
      }finally{setLoading(false);}
    }
  };

  // --- LÓGICA DE ASIGNACIÓN AUTOMÁTICA DE PLANTILLAS PRE-ARMADAS ---
  const handleAssignRoutine = async (routineObj) => {
    if (!window.confirm(`¿Copiar la plantilla "${routineObj.name}" al día ${date.toLocaleDateString()}?`)) {
      return;
    }
    
    try {
      const formattedExercises = routineObj.exercises.map(ex => {
        let safePlannedSets = ex.plannedSets;
        if (!safePlannedSets || !Array.isArray(safePlannedSets) || safePlannedSets.length === 0) {
          const count = Math.max(1, parseInt(ex.sets) || 3);
          safePlannedSets = Array.from({ length: count }).map(() => ({
            reps: String(ex.reps || '10'),
            rir: String(ex.rir || '2')
          }));
        }
        return {
          name: String(ex.name || 'Ejercicio'),
          videoUrl: String(ex.videoUrl || ''),
          sets: String(safePlannedSets.length),
          reps: String(safePlannedSets[0]?.reps || '10'),
          rir: String(safePlannedSets[0]?.rir || '2'),
          plannedSets: safePlannedSets,
          actualSets: [] 
        };
      });

      const targetRef=doc(db,'clients',client.id,'sessions',currentDateId);
      await ensureSessionIsSafeToPlan(targetRef);
      await setDoc(targetRef, {
        date: currentDateId,
        exercises: formattedExercises,
        isFinalized: false
      }, { merge: true });

      if (!allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
    } catch (error) {
      window.alert('No se pudo asignar la plantilla: '+(error?.message||'revisá tu conexión'));
    }
  };

  // --- MANEJO DE SERIES DINÁMICAS ---
  const addSet = () => {
    setExForm(prev => ({
      ...prev,
      plannedSets: [...prev.plannedSets, { reps: '', rir: '2' }]
    }));
  };

  const removeSet = (indexToRemove) => {
    setExForm(prev => ({
      ...prev,
      plannedSets: prev.plannedSets.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const updateSetField = (index, field, value) => {
    const updatedSets = [...exForm.plannedSets];
    updatedSets[index] = { ...updatedSets[index], [field]: value };
    setExForm({ ...exForm, plannedSets: updatedSets });
  };

  // --- ABRIR MODAL DE EJERCICIO ---
  const openExerciseModal = (index = null) => {
    if (index !== null) {
      const ex = dailySession[index];
      let loadedSets = ex.plannedSets;
      if (!loadedSets || !Array.isArray(loadedSets) || loadedSets.length === 0) {
        const fallbackCount = Math.max(1, parseInt(ex.sets) || 1);
        loadedSets = Array.from({ length: fallbackCount }).map(() => ({
          reps: String(ex.reps || ''),
          rir: String(ex.rir || '2')
        }));
      }
      setExForm({ name: ex.name || '', videoUrl: ex.videoUrl || '', plannedSets: loadedSets });
      setEditingExerciseIndex(index);
    } else {
      setExForm({
        name: exercisesLibrary?.length > 0 ? exercisesLibrary[0].name : '',
        videoUrl: exercisesLibrary?.length > 0 ? exercisesLibrary[0].videoUrl : '',
        plannedSets: [{ reps: '', rir: '2' }]
      });
      setEditingExerciseIndex(null);
    }
    setIsExerciseModalOpen(true);
  };

  // --- GUARDAR EJERCICIO INDIVIDUAL ---
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!exForm.name || !exForm.plannedSets || exForm.plannedSets.length === 0) {
      return alert("Completa el nombre del ejercicio.");
    }

    let updatedSession = [...dailySession];

    const exerciseToSave = {
      name: String(exForm.name),
      videoUrl: String(exForm.videoUrl || ''),
      sets: String(exForm.plannedSets.length),
      reps: String(exForm.plannedSets[0]?.reps || ''), 
      rir: String(exForm.plannedSets[0]?.rir || '2'),
      plannedSets: exForm.plannedSets,
      actualSets: editingExerciseIndex !== null ? (updatedSession[editingExerciseIndex].actualSets || []) : []
    };

    if (editingExerciseIndex !== null) {
      updatedSession[editingExerciseIndex] = exerciseToSave;
    } else {
      updatedSession.push(exerciseToSave);
    }

    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId, 
        exercises: updatedSession
      }, { merge: true });
      setIsExerciseModalOpen(false);
      if (updatedSession.length === 1 && !allSessionsIds.includes(currentDateId)) {
        setAllSessionsIds([...allSessionsIds, currentDateId]);
      }
    } catch (error) { 
      console.error(error); 
    }
  };

  // --- ELIMINAR EJERCICIO ---
  const handleDeleteExercise = async (index) => {
    if (!window.confirm('¿Seguro que deseas eliminar este ejercicio?')) {
      return;
    }
    const updatedSession = dailySession.filter((_, i) => i !== index);
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), { exercises: updatedSession }, { merge: true });
      if (updatedSession.length === 0) {
        setAllSessionsIds(allSessionsIds.filter(id => id !== currentDateId));
      }
    } catch (error) { 
      console.error(error); 
    }
  };

  // --- GUARDAR EXTRAS ---
  const handleSaveExtras = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'clients', client.id, 'sessions', currentDateId), {
        date: currentDateId,
        targetHydration: String(hydrationTarget),
        targetCardioMinutes: String(cardioTargetMinutes),
        targetCardioIntensity: String(cardioTargetIntensity)
      }, { merge: true });
      setIsExtrasModalOpen(false);
    } catch (error) { 
      console.error(error); 
    }
  };

  if (!client) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-12">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={goBack} 
            className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-white hover:text-yellow-400 hover:border-yellow-400 transition-colors shadow-lg shrink-0"
          >
            <ChevronLeft size={28}/>
          </button>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
              {client.name || 'Atleta'}
            </h2>
            <p className="text-zinc-500 text-xs font-bold mt-1">{client.email}</p>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex gap-6 mb-8 border-b border-zinc-800/80 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('planificacion')} 
          className={`pb-3 uppercase font-black text-xs tracking-widest transition-colors whitespace-nowrap ${activeTab === 'planificacion' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Planificación
        </button>
        <button 
          onClick={() => setActiveTab('progreso')} 
          className={`pb-3 uppercase font-black text-xs tracking-widest transition-colors whitespace-nowrap ${activeTab === 'progreso' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Progreso
        </button>
        <button 
          onClick={() => setActiveTab('mensajes')} 
          className={`pb-3 uppercase font-black text-xs tracking-widest transition-colors whitespace-nowrap ${activeTab === 'mensajes' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Mensajes
        </button>
      </div>

      {/* VISTA: PLANIFICACIÓN */}
      {activeTab === 'planificacion' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
          
          {/* COLUMNA IZQUIERDA: CALENDARIO */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <CalendarIcon size={20} className="text-yellow-400"/>
                <h3 className="text-lg font-black uppercase tracking-widest text-white italic">
                  Fechas
                </h3>
              </div>
              <Calendar 
                onChange={handleDateChange} 
                value={date} 
                className="react-calendar-custom" 
                tileClassName={({ date: tDate }) => allSessionsIds.includes(formatDateId(tDate)) ? 'has-workout' : null} 
              />
            </div>

            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
              <h3 className="text-white font-bold uppercase text-sm tracking-widest mb-4 flex items-center gap-2">
                <Save size={16} className="text-yellow-400"/> Pegar Plantilla
              </h3>
              {routines && routines.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {routines.map(routine => (
                    <button 
                      key={routine.id}
                      onClick={() => handleAssignRoutine(routine)}
                      className="w-full text-left p-3 bg-black/40 hover:bg-yellow-400/10 border border-zinc-800 hover:border-yellow-400/30 rounded-xl text-sm font-bold text-zinc-300 hover:text-yellow-400 transition-colors uppercase tracking-tight flex justify-between items-center"
                    >
                      {routine.name}
                      <Plus size={16}/>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-xs text-center py-4 font-medium border border-dashed border-zinc-800 rounded-xl">
                  No tienes rutinas pre-armadas creadas.
                </p>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: RUTINA DEL DÍA */}
          <div className="lg:col-span-8">
            <div className="bg-zinc-900/50 rounded-[2rem] border border-zinc-800 p-6 md:p-8 min-h-[600px] flex flex-col shadow-xl relative">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Target className="text-yellow-400" size={24}/> Programación
                  </h3>
                  <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mt-1">
                    {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* AQUÍ ESTÁN LOS BOTONES DE COPIAR JUNTOS */}
                  <button 
                    onClick={() => setIsRangeModalOpen(true)}
                    className="bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-zinc-700 shadow-md"
                    title="Copiar múltiples días"
                  >
                    <CalendarDays size={16}/> Copiar Rango
                  </button>

                  <button 
                    onClick={handleCopyDay}
                    className="bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-zinc-700 shadow-md"
                    title="Copiar Rutina de este día"
                  >
                    <Copy size={16}/> Copiar Día
                  </button>
                  
                  {clipboardType && (
                    <button 
                      onClick={handlePasteClipboard}
                      className="bg-green-500/10 text-green-500 hover:bg-green-500/20 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-green-500/30 shadow-lg animate-pulse"
                      title="Pegar elemento almacenado en Portapapeles"
                    >
                      <ClipboardPaste size={16}/> Pegar {clipboardType === 'range' ? 'Rango' : 'Día'}
                    </button>
                  )}

                  <button 
                    onClick={() => setIsExtrasModalOpen(true)}
                    className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                  >
                    <Droplets size={16}/> Extras
                  </button>

                  <button 
                    onClick={() => openExerciseModal(null)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-lg"
                  >
                    <Plus size={16}/> Ejercicio
                  </button>
                </div>
              </div>

              {isSessionFinalized && (
                <div className="mb-6 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-full text-black"><CheckCircle size={20}/></div>
                  <div>
                    <h4 className="text-green-500 font-black uppercase text-sm tracking-widest">Sesión Finalizada</h4>
                    <p className="text-green-500/70 text-xs font-medium">El alumno ya completó este día.</p>
                  </div>
                </div>
              )}

              {(hydrationTarget || cardioTargetMinutes) && (
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  {hydrationTarget && (
                    <div className="flex-1 bg-black/40 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Droplets size={24}/></div>
                      <div>
                        <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest">Objetivo Hidratación</p>
                        <p className="text-xl font-black text-white">{hydrationTarget} Litros</p>
                      </div>
                    </div>
                  )}
                  {cardioTargetMinutes && (
                    <div className="flex-1 bg-black/40 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
                      <div className="p-3 bg-red-500/10 rounded-xl text-red-400"><Activity size={24}/></div>
                      <div>
                        <p className="text-[10px] text-red-400/60 font-black uppercase tracking-widest">Cardio Extra</p>
                        <p className="text-xl font-black text-white">{cardioTargetMinutes} Min <span className="text-sm text-red-400">({cardioTargetIntensity})</span></p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {studentNote.trim() && (
                <section className="mb-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4 sm:p-5" aria-label="Observación del alumno">
                  <h4 className="text-sm text-yellow-300 font-black uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={18}/> Observación del alumno
                  </h4>
                  <p className="text-zinc-100 text-sm leading-relaxed mt-3 whitespace-pre-wrap break-words">{studentNote}</p>
                  {studentNoteUpdatedAt?.toDate && (
                    <p className="text-xs text-zinc-500 mt-3">Guardada el {studentNoteUpdatedAt.toDate().toLocaleString('es-AR')}</p>
                  )}
                </section>
              )}

              {sessionLoadError && (
                <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
                  {sessionLoadError}
                </p>
              )}

              <div className="space-y-4 flex-1">
                {loading ? (
                  <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-400"></div></div>
                ) : dailySession.length > 0 ? (
                  dailySession.map((ex, idx) => {
                    const safeSets = ex.plannedSets || Array.from({ length: Math.max(1, parseInt(ex.sets) || 1) }).map(() => ({
                      reps: String(ex.reps || ''), rir: String(ex.rir || '')
                    }));

                    return (
                      <div key={idx} className="bg-black/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors group">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4 w-full">
                            <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-xl flex items-center justify-center font-black text-lg border border-yellow-400/20 shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <h4 className="text-white font-black text-lg uppercase tracking-tighter leading-none">{ex.name}</h4>
                                {ex.videoUrl && <Video size={16} className="text-blue-500"/>}
                              </div>
                              <div className="space-y-1.5">
                                {safeSets.map((set, sIdx) => (
                                  <div key={sIdx} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-zinc-500 w-12 shrink-0">Set {sIdx + 1}</span>
                                    <span className="text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700">{set.reps || '-'} Reps</span>
                                    {set.rir && <span className="text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">RIR {set.rir}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => openExerciseModal(idx)} className="p-2 text-zinc-400 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors" title="Editar">
                              <Edit size={16}/>
                            </button>
                            <button onClick={() => handleDeleteExercise(idx)} className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors" title="Eliminar">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-black/30">
                    <Dumbbell size={48} className="text-zinc-800 mb-4"/>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Día Vacío</p>
                    <p className="text-zinc-600 text-xs mt-2 max-w-xs text-center font-medium">Usa los botones superiores para armar la rutina.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* VISTA: PROGRESO */}
      {activeTab === 'progreso' && (
        <div className="animate-in fade-in">
          <ProgressChart clientId={client.id} />
        </div>
      )}

      {/* VISTA: CHAT */}
      {activeTab === 'mensajes' && (
        <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 flex flex-col h-[65vh] shadow-xl overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-3 shrink-0">
            <MessageSquare className="text-yellow-400" size={24}/>
            <h3 className="text-white font-black uppercase tracking-widest text-lg italic">Chat Directo</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                <MessageSquare size={48} className="mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Sin mensajes previos</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'trainer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl text-sm ${msg.sender === 'trainer' ? 'bg-yellow-400 text-black rounded-tr-none' : msg.sender === 'system' ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none font-bold' : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'}`}>
                    {msg.text}
                    <span className="block text-[10px] opacity-60 mt-2 text-right font-bold">
                      {msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950 border-t border-zinc-800 flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="Escribe un mensaje al atleta..." 
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 outline-none text-sm transition-colors" 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)} 
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()} 
              className="bg-yellow-400 disabled:opacity-50 text-black px-6 rounded-xl transition-colors font-black flex items-center justify-center"
            >
              <Send size={20}/>
            </button>
          </form>
        </div>
      )}

      {/* --- MODALES COMPLEMENTARIOS --- */}

      {/* MODAL 1: SELECCIONAR RANGO PARA COPIAR (CALENDARIO DUAL) */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-6">
             <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
               <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                 <CalendarDays className="text-yellow-400" size={20}/> Configurar Bloque
               </h2>
               <button onClick={() => setIsRangeModalOpen(false)} className="text-zinc-500 bg-zinc-900 p-1.5 rounded-full hover:text-white transition-colors"><X size={18}/></button>
             </div>
             
             <div className="space-y-4 flex flex-col items-center">
               <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest self-start">Selecciona fecha de inicio y de fin:</p>
               
               {/* CALENDARIO CON SELECTOR DE RANGO */}
               <Calendar 
                 selectRange={true}
                 onChange={setDateRange} 
                 value={dateRange} 
                 className="react-calendar-custom" 
               />

               {/* MOSTRAR LAS FECHAS ELEGIDAS */}
               {dateRange && dateRange.length === 2 && (
                  <div className="flex gap-4 w-full mt-2">
                    <div className="flex-1 bg-black/40 border border-zinc-800 p-3 rounded-xl text-center">
                      <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Desde</span>
                      <span className="text-sm font-bold text-white">{dateRange[0].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <div className="flex-1 bg-black/40 border border-zinc-800 p-3 rounded-xl text-center">
                      <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Hasta</span>
                      <span className="text-sm font-bold text-white">{dateRange[1].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
               )}
             </div>

             <button 
               onClick={handleCopyRange} 
               className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-yellow-400/10 transition-colors"
             >
               Confirmar y Copiar Rango
             </button>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAR EJERCICIO */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-md rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                {editingExerciseIndex !== null ? 'Editar Ejercicio' : 'Configurar Ejercicio'}
              </h2>
              <button onClick={() => setIsExerciseModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Seleccionar de Biblioteca</label>
                <select 
                  required 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm font-bold uppercase"
                  value={exForm.name}
                  onChange={(e) => {
                    const selected = exercisesLibrary.find(ex => ex.name === e.target.value);
                    setExForm({ ...exForm, name: e.target.value, videoUrl: selected?.videoUrl || '' });
                  }}
                >
                  <option value="" disabled>Elige un ejercicio...</option>
                  {exercisesLibrary?.map(ex => (
                    <option key={ex.id || Math.random()} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Series del Ejercicio</label>
                <div className="space-y-3">
                  {exForm.plannedSets?.map((set, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-zinc-800 animate-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 rounded-lg text-[10px] font-black text-zinc-500 shrink-0">{idx + 1}</div>
                      <input
                        type="text"
                        placeholder="Reps (ej. 10)"
                        required
                        className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white outline-none focus:border-yellow-400 text-xs font-bold text-center"
                        value={set.reps}
                        onChange={e => updateSetField(idx, 'reps', e.target.value)}
                      />
                      <select
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2.5 text-white outline-none focus:border-yellow-400 text-xs font-bold"
                        value={set.rir}
                        onChange={e => updateSetField(idx, 'rir', e.target.value)}
                      >
                        <option value="0">RIR 0 (Fallo)</option>
                        <option value="1">RIR 1</option>
                        <option value="2">RIR 2</option>
                        <option value="3">RIR 3</option>
                        <option value="4">RIR 4</option>
                      </select>
                      <button 
                        type="button" 
                        disabled={exForm.plannedSets.length === 1}
                        onClick={() => removeSet(idx)} 
                        className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addSet} className="w-full mt-3 py-3 border border-dashed border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/5 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-all">
                  <Plus size={16}/> Agregar Serie
                </button>
              </div>
            </div>

            <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex gap-3 shrink-0">
              <button type="button" onClick={() => setIsExerciseModalOpen(false)} className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors">Cancelar</button>
              <button onClick={handleSaveExercise} type="button" className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20">
                {editingExerciseIndex !== null ? 'Guardar Cambios' : 'Agregar a Rutina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXTRAS */}
      {isExtrasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-blue-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-red-500"></div>
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">Objetivos Extra</h2>
              <button onClick={() => setIsExtrasModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveExtras} className="p-6 space-y-6">
              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl">
                <label className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3"><Droplets size={14}/> Meta de Hidratación</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" step="0.1" min="0" max="10" placeholder="Ej: 2.5"
                    className="flex-1 bg-zinc-900 border border-blue-500/30 rounded-xl p-3 text-white outline-none focus:border-blue-400 transition-colors font-black text-lg text-center" 
                    value={hydrationTarget} onChange={e => setHydrationTarget(e.target.value)} 
                  />
                  <span className="text-zinc-400 font-bold uppercase text-xs">Litros</span>
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl">
                <label className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest mb-3"><Activity size={14}/> Meta de Cardio</label>
                <div className="flex items-center gap-3 mb-4">
                  <input 
                    type="number" min="0" max="120" placeholder="Ej: 15"
                    className="flex-1 bg-zinc-900 border border-red-500/30 rounded-xl p-3 text-white outline-none focus:border-red-400 transition-colors font-black text-lg text-center" 
                    value={cardioTargetMinutes} onChange={e => setCardioTargetMinutes(e.target.value)} 
                  />
                  <span className="text-zinc-400 font-bold uppercase text-xs">Minutos</span>
                </div>
                <div className="flex gap-2">
                  {['Baja', 'Media', 'Alta'].map(level => (
                    <button
                      key={level} type="button" onClick={() => setCardioTargetIntensity(level)}
                      className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border ${cardioTargetIntensity === level ? 'bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-red-400 hover:border-red-500/30'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button type="submit" className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-white/10">Guardar Objetivos</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
