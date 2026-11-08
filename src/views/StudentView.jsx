import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Dumbbell, 
  CheckCircle, 
  User, 
  Menu, 
  X, 
  LogOut, 
  MessageSquare, 
  Send, 
  AlertTriangle, 
  Trophy, 
  CreditCard, 
  ExternalLink, 
  ChevronRight, 
  Video, 
  Bell, 
  Users, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  Timer, 
  Clock,
  Droplets, 
  Activity, 
  Share2, 
  Flame, 
  Award, 
  Medal
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  collection, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  updateDoc, 
  getDocs,
  runTransaction, serverTimestamp
} from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase';
import CommunityView from './CommunityView';
import ProgressChart from '../components/ProgressChart';
import WeeklyRecap from '../components/WeeklyRecap';
import WorkoutShareCard from '../components/WorkoutShareCard';
import {weeklyInsights,isFridayFinalSession} from '../utils/trainingInsights';
import StudentChangePassword from '../components/StudentChangePassword';
import StudentFirstAccessModal from '../components/StudentFirstAccessModal';
import StudentWorkoutNote from '../components/StudentWorkoutNote';
import ConnectionBanner from '../components/ConnectionBanner';
import StudentAlertsPanel from '../components/StudentAlertsPanel';
import { studentAlertRequest, studentForegroundListener } from '../utils/studentPush';
import { getUpcomingRenewal, ymdInArgentina } from '../utils/billingCycle';
import { notifyCoachAboutStudentEvent } from '../utils/ragnarPush';

// --- BASE DE DATOS DE MEDALLAS ---
const MEDALS_DB = {
  'primer_paso': { 
    id: 'primer_paso', 
    name: 'Primer Paso', 
    desc: 'Completaste tu primer entrenamiento.', 
    icon: '🏆', 
    color: 'from-yellow-400 to-yellow-600', 
    shadow: 'shadow-yellow-400/30' 
  },
  'racha_3': { 
    id: 'racha_3', 
    name: 'Guerrero', 
    desc: 'Racha de 3 días seguidos.', 
    icon: '🔥', 
    color: 'from-orange-400 to-orange-600', 
    shadow: 'shadow-orange-400/30' 
  },
  'racha_7': { 
    id: 'racha_7', 
    name: 'Espartano', 
    desc: 'Racha de 7 días seguidos.', 
    icon: '⚔️', 
    color: 'from-red-500 to-red-700', 
    shadow: 'shadow-red-500/30' 
  },
  'aquaman': { 
    id: 'aquaman', 
    name: 'Aquaman', 
    desc: 'Registraste hidratación exitosa.', 
    icon: '💧', 
    color: 'from-blue-400 to-blue-600', 
    shadow: 'shadow-blue-400/30' 
  },
  'cardio_king': { 
    id: 'cardio_king', 
    name: 'Pulmones de Acero', 
    desc: 'Registraste cardio extra.', 
    icon: '❤️‍🔥', 
    color: 'from-pink-400 to-pink-600', 
    shadow: 'shadow-pink-400/30' 
  }
};

export default function StudentView({ clientId }) {
  // --- ESTADOS GLOBALES ---
  const [client, setClient] = useState(null);
  const [trainerSettings, setTrainerSettings] = useState({ alias: '', plans: [] });
  const [date, setDate] = useState(new Date());
  const [dailySession, setDailySession] = useState([]);
  const [isSessionFinalized, setIsSessionFinalized] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [perceivedEffort, setPerceivedEffort] = useState('6');
  const [recordedEffort,setRecordedEffort] = useState(null);
  const [workoutStartedAt,setWorkoutStartedAt] = useState(null);
  const [recordedDuration,setRecordedDuration] = useState(null);
  const [elapsedMinutes,setElapsedMinutes] = useState(null);
  const [clockBusy,setClockBusy] = useState(false);
  const [clockError,setClockError] = useState('');
  const [weeklySummary,setWeeklySummary] = useState(null);
  const [showWeeklySummary,setShowWeeklySummary] = useState(false);
  const finalizingRef = useRef(false);
  const [allSessionsIds, setAllSessionsIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE COMPLEMENTOS Y SOBRECARGA ---
  const [hydration, setHydration] = useState('');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioIntensity, setCardioIntensity] = useState('Baja');
  const [exerciseHistory, setExerciseHistory] = useState({});

  // --- ESTADOS DE PAGO ---
  const [hasPaidMonth, setHasPaidMonth] = useState(true); 
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // --- ESTADOS DE INTERFAZ Y GAMIFICACIÓN ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState(() =>
    new URLSearchParams(window.location.search).get('view')==='student-alerts'?'alerts':'home'
  );
  const currentViewRef=useRef(currentView);
  useEffect(()=>{currentViewRef.current=currentView;},[currentView]);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [studentUnreadCount, setStudentUnreadCount] = useState(0);
  const [studentAlertsRevision,setStudentAlertsRevision] = useState(0);
  const [studentToast, setStudentToast] = useState(null);
  const [renewalPaid, setRenewalPaid] = useState(null); 
  const [showShareModal, setShowShareModal] = useState(false);
  const [newMedalAlert, setNewMedalAlert] = useState(null);

  // --- ESTADOS DE CHAT ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // --- ESTADOS DE FALTAS ---
  const [missedWorkout, setMissedWorkout] = useState(null);
  const [missedReason, setMissedReason] = useState('');

  // --- ESTADOS DEL CRONÓMETRO ---
  const [restTime, setRestTime] = useState(90); 
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const rirColors = ['bg-[#ffe4c4]', 'bg-[#fcd34d]', 'bg-[#fbbf24]', 'bg-[#f97316]', 'bg-[#ef4444]', 'bg-[#b91c1c]'];

  const auth = getAuth();
  
  const formatDateId = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Las cuentas nuevas y los restablecimientos recientes requieren cambio obligatorio.
  // Compatibilidad con cuentas activadas antes de que existiera este indicador:
  // la primera activación sin una marca posterior de cambio también se considera temporal.
  const temporaryPasswordRequired = Boolean(client &&
    (client.passwordChangeRequired === true ||
      (client.passwordChangeRequired !== false &&
       (client.accountActivatedAt || client.authPasswordResetAt) &&
       !client.passwordChangedAt)));
  const currentDateId = formatDateId(date);
  const todayYmd=ymdInArgentina();
  const upcomingRenewal=getUpcomingRenewal(client?.startDate,todayYmd);

  // El inicio es útil incluso cuando el alumno todavía no tiene rutina hoy.
  useEffect(()=>{
    if(!clientId)return;
    const ref=doc(db,'clients',clientId,'sessions',todayYmd);
    return onSnapshot(ref,snap=>{
      const data=snap.exists()?snap.data():null;
      setTodayWorkout(data && Array.isArray(data.exercises)&&data.exercises.length
        ? {count:data.exercises.length,finalized:data.isFinalized===true,
            sets:data.exercises.reduce((acc,ex)=>acc+
              (Array.isArray(ex.plannedSets)?ex.plannedSets.length:
                Math.max(1,parseInt(ex.sets)||1)),0)}
        : null);
    },()=>setTodayWorkout(null));
  },[clientId,todayYmd]);

  useEffect(()=>{
    if(!clientId||!upcomingRenewal||upcomingRenewal.daysUntil>3){
      setRenewalPaid(null);return;
    }
    return onSnapshot(doc(db,'clients',clientId,'payments',upcomingRenewal.periodId),
      snap=>setRenewalPaid(snap.exists()&&snap.data().status==='paid'),
      ()=>setRenewalPaid(null));
  },[clientId,upcomingRenewal?.periodId,upcomingRenewal?.daysUntil]);

  useEffect(()=>{
    if(!clientId||!client?.studentUserId)return;
    // Verificación autorizada del servidor: evita avisar de períodos ya abonados.
    void studentAlertRequest('check-renewal',clientId).catch(()=>{});
    let disposed=false,unsubscribe=()=>{};
    const updateCount=()=>{
      void studentAlertRequest('list',clientId)
        .then(r=>{if(!disposed)setStudentUnreadCount((r.notifications||[]).filter(n=>!n.read).length);})
        .catch(()=>{});
    };
    updateCount();
    const onVisible=()=>{if(!document.hidden)updateCount();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',updateCount);
    studentForegroundListener(alert=>{
      if(disposed)return;
      const view=currentViewRef.current;
      const section=alert.type==='coach_message'&&view==='chat'?'chat':
        alert.type==='routine_updated'&&['calendar','workout'].includes(view)?'calendar':
        alert.type==='renewal'&&view==='profile'?'profile':null;
      if(section){
        // El aviso ya se atendió porque el alumno está mirando esa sección.
        void studentAlertRequest('mark-section',clientId,{section})
          .then(updateCount).catch(updateCount);
        setStudentToast(null);
      }else{
        updateCount();
        setStudentToast(alert);
      }
      setStudentAlertsRevision(value=>value+1);
    }).then(off=>{if(disposed)off();else unsubscribe=off;}).catch(()=>{});
    return ()=>{
      disposed=true;unsubscribe();
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('focus',updateCount);
    };
  },[clientId,client?.studentUserId]);

  // Al acceder al contenido asociado a un aviso, todos los de esa categoría
  // pasan a leídos: no hay que tocar cada notificación del mismo chat.
  useEffect(()=>{
    if(!client?.id)return;
    const section=currentView==='chat'?'chat':
      (currentView==='calendar'||currentView==='workout')&&hasPaidMonth?'calendar':
      currentView==='profile'?'profile':null;
    if(!section)return;
    let active=true;
    void studentAlertRequest('mark-section',clientId,{section})
      .then(()=>studentAlertRequest('list',clientId))
      .then(result=>{
        if(active){
          setStudentUnreadCount((result.notifications||[]).filter(n=>!n.read).length);
          setStudentAlertsRevision(x=>x+1);
        }
      })
      .catch(error=>console.warn('No se pudo sincronizar la campanita:',error?.message||error));
    return()=>{active=false;};
  },[clientId,client?.id,currentView,hasPaidMonth]);

  // --- EFECTO 1: CARGA DE DATOS Y LÓGICA DE DÍAS DE GRACIA (SINC RONIZADA CON COACH) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        let clientData = null;
        
        if (docSnap.exists()) {
          clientData = docSnap.data();
          setClient({ 
            id: docSnap.id, 
            currentStreak: 0,
            medals: [],
            ...clientData 
          });
          
          if (clientData.preferredRestTime) {
            setRestTime(clientData.preferredRestTime);
          }
        }

        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          setTrainerSettings(settingsSnap.data());
        }

        // LÓGICA DE GUILLOTINA MATEMÁTICAMENTE EXACTA AL COACH
        if (clientData?.startDate) {
          const today = new Date();
          const startDay = new Date(clientData.startDate + 'T12:00:00Z').getUTCDate(); 
          let cycleYear = today.getFullYear();
          let cycleMonth = today.getMonth() + 1;

          // Para meses cortos, el día 31 vence el último día válido del mes.
          const currentDueDay=Math.min(startDay,new Date(today.getFullYear(),today.getMonth()+1,0).getDate());
          if (today.getDate() < currentDueDay) {
            cycleMonth -= 1;
            if (cycleMonth === 0) {
              cycleMonth = 12;
              cycleYear -= 1;
            }
          }

          const periodId = `${cycleYear}-${String(cycleMonth).padStart(2, '0')}`;
          
          const paymentRef = doc(db, 'clients', clientId, 'payments', periodId);
          const paymentSnap = await getDoc(paymentRef);
          let isPaid = paymentSnap.exists() && paymentSnap.data().status === 'paid';

          if (!isPaid) {
            // Fecha límite: Día de cobro de ESTE ciclo + días de gracia
            const validDay=Math.min(startDay,new Date(cycleYear,cycleMonth,0).getDate());
            const deadline = new Date(cycleYear, cycleMonth - 1, validDay);
            const grace = parseInt(clientData.graceDays || 0);
            deadline.setDate(deadline.getDate() + grace); 
            deadline.setHours(23, 59, 59, 999);

            // Si todavía NO se pasó la fecha límite, lo dejamos pasar (en gracia)
            if (today <= deadline) {
              isPaid = true;
            }
          }

          setHasPaidMonth(isPaid);

          if (!isPaid) {
            setCurrentView('profile');
            setShowPaymentModal(true);
          }
        } else {
          // Si no tiene fecha configurada, no lo bloqueamos
          setHasPaidMonth(true);
        }

      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    };
    
    if (clientId) {
      fetchData();
    }
  }, [clientId]);

  // Sincronizar en tiempo real los pagos: cuando el coach registra una cuota,
  // el alumno recupera acceso sin tener que reinstalar ni borrar la PWA.
  useEffect(()=>{
    if(!client?.id||!client.startDate)return;
    const parts=String(client.startDate).split('-');
    const startDay=Number(parts[2]);
    if(!startDay||startDay>31)return;
    const now=new Date();
    let year=now.getFullYear(),month=now.getMonth();
    const monthDay=Math.min(startDay,new Date(year,month+1,0).getDate());
    if(now.getDate()<monthDay){
      month--;
      if(month<0){month=11;year--;}
    }
    const periodId=[year,String(month+1).padStart(2,'0')].join('-');
    const dueDay=Math.min(startDay,new Date(year,month+1,0).getDate());
    const deadline=new Date(year,month,dueDay);
    deadline.setDate(deadline.getDate()+Math.max(0,Number(client.graceDays)||0));
    deadline.setHours(23,59,59,999);
    const ref=doc(db,'clients',client.id,'payments',periodId);
    return onSnapshot(ref,snapshot=>{
      const paid=snapshot.exists()&&snapshot.data().status==='paid';
      const allowed=paid||new Date()<=deadline;
      setHasPaidMonth(allowed);
      if(allowed)setShowPaymentModal(false);
    },error=>console.warn('No se pudo actualizar el estado de cuota:',error?.code||error));
  },[client?.id,client?.startDate,client?.graceDays]);

  // --- EFECTO 2: CONTROL DE SESIONES PENDIENTES ---
  useEffect(() => {
    if (!client) return;
    
    const checkYesterday = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yId = formatDateId(yesterday);
      
      const docRef = doc(db, 'clients', client.id, 'sessions', yId);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (!data.isFinalized && !data.missedReason && data.exercises && data.exercises.length > 0) {
          setMissedWorkout({ 
            id: yId, 
            date: yesterday, 
            name: data.exercises[0]?.name || 'Entrenamiento' 
          });
        }
      }
    };
    
    checkYesterday();
  }, [client]);

  // --- EFECTO 3: PLANIFICACIÓN DEL ALUMNO EN TIEMPO REAL ---
  // La lista de días se escucha UNA sola vez por alumno. Cambiar de fecha no
  // vuelve a descargar todo el calendario, solo la sesión seleccionada.
  useEffect(()=>{
    if(!client?.id||!hasPaidMonth)return;
    const ref=collection(db,'clients',client.id,'sessions');
    return onSnapshot(ref,snapshot=>{
      setAllSessionsIds(snapshot.docs
        .filter(d=>Array.isArray(d.data().exercises)&&d.data().exercises.length>0)
        .map(d=>d.id));
    },error=>console.warn('Calendario de alumno:',error?.code||error));
  },[client?.id,hasPaidMonth]);

  useEffect(()=>{
    if(!client?.id||!hasPaidMonth)return;
    const ref=doc(db,'clients',client.id,'sessions',currentDateId);
    return onSnapshot(ref,snapshot=>{
      if(snapshot.exists()){
        const data=snapshot.data();
        setDailySession(Array.isArray(data.exercises)?data.exercises:[]);
        setIsSessionFinalized(data.isFinalized===true);
        setRecordedEffort(data.perceivedEffort??null);
        setPerceivedEffort(String(data.perceivedEffort??'6'));
        setWorkoutStartedAt(data.workoutStartedAt?.toDate?.()||null);
        setRecordedDuration(data.workoutDurationMinutes??null);
        setHydration(data.hydration||'');
        setCardioMinutes(data.cardioMinutes||'');
        setCardioIntensity(data.cardioIntensity||'Baja');
      }else{
        setDailySession([]);
        setIsSessionFinalized(false);
        setRecordedEffort(null);
        setPerceivedEffort('6');
        setWorkoutStartedAt(null);
        setRecordedDuration(null);
        setHydration('');
        setCardioMinutes('');
        setCardioIntensity('Baja');
      }
    },error=>console.warn('Rutina seleccionada:',error?.code||error));
  },[client?.id,currentDateId,hasPaidMonth]);

  // El cronómetro no mide descansos por separado: marca inicio de la sesión.
  // No se estima tiempo de sesiones en las que nunca se inició la medición.
  useEffect(()=>{
    if(!workoutStartedAt||isSessionFinalized){setElapsedMinutes(null);return;}
    const tick=()=>setElapsedMinutes(Math.max(0,Math.floor((Date.now()-workoutStartedAt.getTime())/60000)));
    tick();const id=setInterval(tick,15000);return()=>clearInterval(id);
  },[workoutStartedAt,isSessionFinalized]);

  const startWorkoutClock=async(targetId=currentDateId)=>{
    if(clockBusy||targetId!==todayYmd){return;}
    setClockBusy(true);setClockError('');
    try{
      const ref=doc(db,'clients',clientId,'sessions',targetId);
      await runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists()||!Array.isArray(snap.data().exercises)||!snap.data().exercises.length)
          throw new Error('Este día todavía no tiene ejercicios asignados.');
        if(snap.data().isFinalized)throw new Error('El entrenamiento ya está finalizado.');
        if(!snap.data().workoutStartedAt)tx.update(ref,{workoutStartedAt:serverTimestamp()});
      });
    }catch(error){setClockError(error?.message||'No se pudo iniciar el cronómetro.');}
    finally{setClockBusy(false);}
  };

  // --- EFECTO 4: HISTORIAL DE SOBRECARGA PROGRESIVA ---
  useEffect(() => {
    if (!client?.id || !hasPaidMonth) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'clients', client.id, 'sessions'),
          orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        const historyMap = {};

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.date === currentDateId || !data.isFinalized) return;

          if (data.exercises) {
            data.exercises.forEach(ex => {
              if (ex.name && !historyMap[ex.name]) {
                historyMap[ex.name] = {
                  date: data.date,
                  actualSets: ex.actualSets || []
                };
              }
            });
          }
        });
        
        setExerciseHistory(historyMap);
      } catch (error) {
        console.error("Error cargando historial de sobrecarga progresiva:", error);
      }
    };

    fetchHistory();
  }, [client, currentDateId, hasPaidMonth]);

  // --- EFECTO 5: CHAT EN TIEMPO REAL ---
  useEffect(() => {
    if (!client) return;
    
    const q = query(collection(db, 'clients', client.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setUnreadCount(msgs.filter(m => m.sender === 'trainer' && !m.read).length);
      
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    });
    
    return () => unsubscribe();
  }, [client]);

  useEffect(() => {
    if (currentView === 'chat' && unreadCount > 0 && client) {
      messages.forEach(async (msg) => {
        if (msg.sender === 'trainer' && !msg.read) {
          await updateDoc(doc(db, 'clients', client.id, 'messages', msg.id), { read: true });
        }
      });
    }
  }, [currentView, messages, unreadCount, client]);

  // --- FUNCIONES DEL CRONÓMETRO ---
  const playTimerSound = () => {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) {
      console.error("Error reproduciendo sonido", e);
    }
  };

  const startTimer = (seconds) => {
    const endTimestamp = Date.now() + seconds * 1000;
    setTimerEndTime(endTimestamp);
    setTimeLeft(seconds);
  };

  useEffect(() => {
    if (!timerEndTime) return;

    const interval = setInterval(() => {
      const current = Date.now();
      const remaining = Math.round((timerEndTime - current) / 1000);

      if (remaining <= 0) {
        clearInterval(interval);
        setTimerEndTime(null);
        setTimeLeft(0);
        playTimerSound();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEndTime]);

  const updatePreferredRest = async (val) => {
    const newRest = parseInt(val) || 0;
    setRestTime(newRest);
    try {
      await updateDoc(doc(db, 'clients', clientId), { preferredRestTime: newRest });
    } catch (e) { 
      console.error(e); 
    }
  };

  // --- FUNCIONES GENERALES ---
  const handleDateChange = (newDate) => {
    if (!hasPaidMonth) {
      setShowPaymentModal(true);
    } else {
      setDate(newDate);
      setCurrentView('workout'); 
    }
  };

  const submitMissedWorkout = async (e) => {
    e.preventDefault();
    if (!missedWorkout || !missedReason.trim()) return;

    try {
      // Si faltó injustificadamente, rompe la racha
      await updateDoc(doc(db, 'clients', client.id), { currentStreak: 0 });
      setClient(prev => ({ ...prev, currentStreak: 0 }));

      await updateDoc(doc(db, 'clients', client.id, 'sessions', missedWorkout.id), { 
        missedReason: missedReason,
        missedReasonAt: new Date()
      });
      
      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'missed_workout', 
        clientId: client.id, 
        clientName: client.name, 
        date: missedWorkout.id, 
        reason: missedReason, 
        read: false, 
        createdAt: new Date()
      });
      
      await addDoc(collection(db, 'clients', client.id, 'messages'), {
        text: `Sistema: No pude entrenar ayer (${missedWorkout.date.toLocaleDateString()}). Motivo: ${missedReason}`, 
        sender: 'system', 
        createdAt: new Date(), 
        read: false
      });
      
      // El alumno ya guardó su ausencia: push es un efecto secundario, no altera datos.
      void notifyCoachAboutStudentEvent('missed_workout', client.id, missedWorkout.id);
      setMissedWorkout(null);
      setMissedReason('');
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleGoToPay = () => { 
    window.open(`https://www.mercadopago.com.ar/`, '_blank'); 
  };

  const handleUpdateSessionDetails = async (field, value) => {
    if (isSessionFinalized || !hasPaidMonth) return;

    if (field === 'hydration') setHydration(value);
    if (field === 'cardioMinutes') setCardioMinutes(value);
    if (field === 'cardioIntensity') setCardioIntensity(value);

    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), {
        [field]: value
      }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateSet = async (exerciseIndex, setIndex, field, value) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    
    const updatedSession = [...dailySession];
    const exercise = updatedSession[exerciseIndex];
    
    if (!exercise.actualSets) {
      exercise.actualSets = [];
    }
    
    if (!exercise.actualSets[setIndex]) {
      exercise.actualSets[setIndex] = { reps: '', weight: '', completed: false };
    }
    
    exercise.actualSets[setIndex][field] = value;
    
    try {
      await setDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), { 
        date: currentDateId, 
        exercises: updatedSession 
      }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    if (isSessionFinalized || !hasPaidMonth) return;
    
    const currentStatus = dailySession[exerciseIndex].actualSets?.[setIndex]?.completed || false;
    handleUpdateSet(exerciseIndex, setIndex, 'completed', !currentStatus);
    
    if (!currentStatus && restTime > 0) {
      startTimer(restTime);
    }
  };

  // --- MAGIA GAMIFICACIÓN: FINALIZAR SESIÓN Y EVALUAR MEDALLAS ---
  const handleFinishWorkout = async () => {
    if (isSessionFinalized || finalizingRef.current) return;
    if (!window.confirm('¿Confirmás que terminaste el entrenamiento de hoy?')) return;

    finalizingRef.current = true;
    setIsFinishing(true);
    try {
      const durationFromClock=workoutStartedAt?
        Math.ceil((Date.now()-workoutStartedAt.getTime())/60000):null;
      const validDuration=durationFromClock>=1&&durationFromClock<=720?durationFromClock:null;
      const savedRpe=Math.max(1,Math.min(10,parseInt(perceivedEffort,10)||6));
      await updateDoc(doc(db, 'clients', clientId, 'sessions', currentDateId), {
        isFinalized:true,
        completedAt:new Date(),
        perceivedEffort:savedRpe,
        ...(validDuration!==null?{workoutDurationMinutes:validDuration}:{})
      });
      setRecordedDuration(validDuration);
      setRecordedEffort(savedRpe);

      // LÓGICA DE RACHAS (STREAKS)
      const lastDateStr = client.lastWorkoutDate || null;
      let newStreak = client.currentStreak || 0;

      if (lastDateStr !== currentDateId) {
         if (lastDateStr) {
            const lastDate = new Date(lastDateStr + 'T12:00:00Z');
            const todayObj = new Date(currentDateId + 'T12:00:00Z');
            const diffTime = Math.abs(todayObj - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak += 1;
            } else {
                newStreak = 1;
            }
         } else {
            newStreak = 1;
         }
      }

      // LÓGICA DE MEDALLAS
      let earnedMedals = client.medals ? [...client.medals] : [];
      let newMedalsUnlocked = [];

      if (!earnedMedals.includes('primer_paso')) { 
        earnedMedals.push('primer_paso'); 
        newMedalsUnlocked.push('primer_paso'); 
      }
      
      if (newStreak >= 3 && !earnedMedals.includes('racha_3')) { 
        earnedMedals.push('racha_3'); 
        newMedalsUnlocked.push('racha_3'); 
      }
      
      if (newStreak >= 7 && !earnedMedals.includes('racha_7')) { 
        earnedMedals.push('racha_7'); 
        newMedalsUnlocked.push('racha_7'); 
      }
      
      if (hydration && parseFloat(hydration) > 0 && !earnedMedals.includes('aquaman')) { 
        earnedMedals.push('aquaman'); 
        newMedalsUnlocked.push('aquaman'); 
      }
      
      if (cardioMinutes && parseInt(cardioMinutes) > 0 && !earnedMedals.includes('cardio_king')) { 
        earnedMedals.push('cardio_king'); 
        newMedalsUnlocked.push('cardio_king'); 
      }

      await updateDoc(doc(db, 'clients', clientId), {
          lastWorkoutDate: currentDateId,
          currentStreak: newStreak,
          medals: earnedMedals
      });
      
      setClient(prev => ({
        ...prev,
        lastWorkoutDate: currentDateId,
        currentStreak: newStreak,
        medals: earnedMedals
      }));

      await addDoc(collection(db, 'trainerNotifications'), {
        type: 'workout_completed', 
        clientId: client.id, 
        clientName: client.name, 
        date: currentDateId, 
        read: false, 
        createdAt: new Date(), 
        performance: "Entrenamiento completado"
      });
      
      await addDoc(collection(db, 'communityFeed'), {
        type: 'workout_completed', 
        userId: clientId, 
        userName: client.name, 
        workoutName: date.toLocaleDateString('es-ES', { weekday: 'long' }), 
        createdAt: new Date(), 
        reactions: { fire: [], power: [] }
      });

      // Solo tras guardar sesión enviamos un aviso externo. Un error de push
      // no modifica el resultado del entrenamiento.
      void notifyCoachAboutStudentEvent('workout_completed', clientId, currentDateId);
      setIsSessionFinalized(true);
      setTimerEndTime(null);

      let recap=null;
      if(currentDateId===todayYmd && isFridayFinalSession(currentDateId,allSessionsIds)){
        try{
          const history=await getDocs(collection(db,'clients',clientId,'sessions'));
          recap=weeklyInsights(history.docs.map(d=>({id:d.id,...d.data()})),currentDateId);
          if(recap)setWeeklySummary(recap);
        }catch(error){
          console.warn('Entrenamiento guardado; resumen semanal no disponible:',error?.message||error);
        }
      }

      if(newMedalsUnlocked.length>0){
        setNewMedalAlert(MEDALS_DB[newMedalsUnlocked[0]]);
      }else if(recap){
        setShowWeeklySummary(true);
      }else{
        setShowShareModal(true);
      }

    } catch (error) {
      console.error(error);
      alert('No se pudo terminar la sesión. Revisá tu conexión e intentá nuevamente.');
    } finally {
      finalizingRef.current = false;
      setIsFinishing(false);
    }
  };

  const handleShareStory = async () => {
    let totalCompletedSets = 0;
    dailySession.forEach(ex => {
      if (ex.actualSets) {
        totalCompletedSets += ex.actualSets.filter(s => s.completed).length;
      }
    });

    const shareData = {
      title: '¡Entrenamiento Completado!',
      text: `🐺 RAGNAR TRAINING\n\nHoy destruí mi rutina: ${date.toLocaleDateString('es-ES', { weekday: 'long' })}\n\n🏋️‍♂️ Ejercicios: ${dailySession.length}\n🔥 Series Completadas: ${totalCompletedSets}\n🔥 Racha Actual: ${client.currentStreak || 1} Días\n\n¡Súmate al equipo! 🐺💪`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error al compartir:', err);
      }
    } else {
      alert("Tu dispositivo no soporta compartir directamente. ¡Toma una captura de pantalla a la tarjeta!");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const savedMessage = await addDoc(collection(db, 'clients', client.id, 'messages'), {
        text: newMessage,
        sender: 'student',
        createdAt: new Date(),
        read: false
      });
      void notifyCoachAboutStudentEvent('student_message', client.id, savedMessage.id);
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => { 
    await signOut(auth); 
    window.location.reload(); 
  };

  const getTotalSets = () => {
    return dailySession.reduce((acc, ex) => {
      return acc + (ex.plannedSets ? ex.plannedSets.length : parseInt(ex.sets || 0));
    }, 0);
  };
  
  const getEstimatedTime = () => getTotalSets() * 3;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="ragnar-student-shell min-h-[100dvh] w-full max-w-full min-w-0 bg-zinc-950 text-white font-sans flex flex-col relative overflow-x-hidden">
        <ConnectionBanner/>
        {temporaryPasswordRequired && (
          <StudentFirstAccessModal clientId={clientId}
            onCompleted={() => setClient(previous => previous ? ({
              ...previous,
              passwordChangeRequired: false,
              passwordChangedAt: new Date()
            }) : previous)}/>
        )}

      
      {studentToast && (
        <div role="status" aria-live="polite" className="fixed left-4 right-4 bottom-24 z-[130] sm:max-w-md sm:left-auto sm:right-4 bg-zinc-900 border border-yellow-400/50 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
          <Bell size={22} className="text-yellow-400 shrink-0"/>
          <button type="button" className="flex-1 min-w-0 text-left"
            onClick={()=>{setStudentToast(null);setCurrentView('alerts');}}>
            <span className="block text-white font-black text-sm">{studentToast.title}</span>
            <span className="block text-zinc-300 text-xs mt-1">{studentToast.body}</span>
            <span className="block text-yellow-300 text-xs mt-2 font-black">Abrir avisos</span>
          </button>
          <button type="button" onClick={()=>setStudentToast(null)}
            className="text-zinc-400 p-1" aria-label="Cerrar aviso"><X size={17}/></button>
        </div>
      )}

      {/* MODAL DE NUEVA MEDALLA DESBLOQUEADA (CELEBRACIÓN) */}
      {newMedalAlert && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500">
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${newMedalAlert.color} flex items-center justify-center text-6xl shadow-2xl mb-6 border-4 border-black ring-4 ring-yellow-400/50 animate-bounce`}>
            {newMedalAlert.icon}
          </div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white text-center mb-2">
            ¡Medalla Desbloqueada!
          </h2>
          <p className="text-yellow-400 font-black text-xl uppercase tracking-widest text-center mb-2">
            {newMedalAlert.name}
          </p>
          <p className="text-zinc-400 text-sm text-center max-w-xs mb-8">
            {newMedalAlert.desc}
          </p>
          
          <button 
            onClick={() => { 
              setNewMedalAlert(null);
              if(weeklySummary)setShowWeeklySummary(true);
              else setShowShareModal(true); 
            }}
            className="bg-yellow-400 text-black font-black px-8 py-4 rounded-2xl uppercase tracking-widest active:scale-95 transition-transform"
          >
            Continuar
          </button>
        </div>
      )}

      {/* MODAL STRAVA COMPARTIR */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in zoom-in-95 duration-300">
          
          <div className="text-center mb-6">
            <h2 className="text-white font-black text-2xl uppercase tracking-widest italic flex items-center justify-center gap-2">
              <Trophy className="text-yellow-400" size={28}/>
              ¡Misión Cumplida!
            </h2>
            <p className="text-zinc-400 text-sm mt-2">
              Toma una captura (Screenshot) o compártelo.
            </p>
          </div>

          <div id="ragnar-story-card" className="w-full max-w-[340px] aspect-[9/16] bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between p-8">
             
             <div className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-400/10 blur-3xl rounded-full pointer-events-none"></div>
             <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yellow-400/5 blur-3xl rounded-full pointer-events-none"></div>

             <div className="flex flex-col items-center z-10">
               <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-black font-black text-3xl italic shadow-lg mb-4">
                 R
               </div>
               <span className="font-black tracking-[0.3em] uppercase text-xs text-zinc-400">
                 Ragnar Training
               </span>
             </div>

             <div className="z-10 w-full">
               <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none mb-1 text-center">
                 {date.toLocaleDateString('es-ES', { weekday: 'long' })}
               </h3>
               <p className="text-yellow-400 font-bold text-[10px] uppercase tracking-[0.2em] text-center mb-8">
                 {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
               </p>

               <div className="space-y-4">
                 <div className="flex justify-center items-center bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 p-3 rounded-2xl mb-2 gap-2">
                   <Flame className="text-orange-500" size={20}/>
                   <span className="text-sm font-black text-orange-400 uppercase tracking-widest">
                     Racha: {client?.currentStreak || 1} Días
                   </span>
                 </div>

                 <div className="flex justify-between items-center bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                   <div className="flex items-center gap-3">
                     <Clock size={20} className="text-yellow-400"/>
                     <span className="text-xs font-black uppercase text-zinc-400 tracking-widest">Tiempo Aprox.</span>
                   </div>
                   <span className="text-lg font-black text-white">{getEstimatedTime()} Min</span>
                 </div>
                 
                 <div className="flex justify-between items-center bg-black/40 border border-zinc-800/50 p-4 rounded-2xl">
                   <div className="flex items-center gap-3">
                     <Dumbbell size={20} className="text-yellow-400"/>
                     <span className="text-xs font-black uppercase text-zinc-400 tracking-widest">Ejercicios</span>
                   </div>
                   <span className="text-lg font-black text-white">{dailySession.length}</span>
                 </div>
               </div>
             </div>

             <div className="z-10 text-center border-t border-zinc-800/50 pt-6">
               <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">
                 Atleta Oficial
               </p>
               <p className="text-xl font-black uppercase text-white tracking-tight">
                 {client?.name}
               </p>
             </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 w-full max-w-[340px]">
            <button 
              onClick={handleShareStory} 
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.3)] active:scale-95 transition-transform"
            >
              <Share2 size={20}/> Compartir 
            </button>
            <button 
              onClick={() => { setShowShareModal(false); setCurrentView('community'); }} 
              className="w-full text-zinc-500 font-bold uppercase text-xs tracking-widest py-3 hover:text-white transition-colors"
            >
              Ir al Salón Ragnar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DEUDA DE PAGO CON DÍAS DE GRACIA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="mx-auto bg-red-500/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
              Acceso Bloqueado
            </h2>
            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
              Tu suscripción ha vencido. Por favor regulariza tu pago para desbloquear tus rutinas.
            </p>
            
            {client?.graceDays > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-6">
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                  Los {client.graceDays} días de gracia otorgados ya han expirado.
                </p>
              </div>
            )}
            
            <div className="bg-black/50 rounded-2xl p-5 mb-8 border border-zinc-800 text-left">
              <p className="text-[10px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Transferir al Alias:</p>
              <p className="text-lg font-mono font-bold text-yellow-400 break-all select-all">{trainerSettings.alias || 'COACH_SIN_ALIAS'}</p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handleGoToPay} 
                className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                Pagar Cuota <ExternalLink size={18}/>
              </button>
              <button 
                onClick={() => { setShowPaymentModal(false); setCurrentView('chat'); }} 
                className="w-full text-zinc-500 font-bold text-xs uppercase tracking-widest py-2"
              >
                Informar Pago por Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FALTA INJUSTIFICADA */}
      {missedWorkout && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl">
            <div className="mx-auto bg-red-500/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">
              Sesión Pendiente
            </h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              No completaste tu entrenamiento del <span className="text-white font-bold">{missedWorkout.date.toLocaleDateString()}</span>. Justifica tu falta para continuar.
            </p>
            
            <form onSubmit={submitMissedWorkout} className="space-y-4">
              <textarea 
                required
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white text-sm focus:border-red-500 outline-none resize-none h-24"
                placeholder="Motivo de la falta..."
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
              />
              <button 
                type="submit" 
                className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                Enviar Justificación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MENÚ LATERAL MÓVIL */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-6 animate-in slide-in-from-right">
          <div className="flex justify-end mb-10">
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-full">
              <X size={32}/>
            </button>
          </div>
          
          <div className="flex flex-col gap-6 text-2xl font-black uppercase italic">
            <button onClick={()=>{setCurrentView('home');setIsMenuOpen(false);}}
              className={`text-left flex items-center gap-3 ${currentView==='home'?'text-yellow-400':'text-zinc-300'}`}>
              <Dumbbell size={20}/> Mi inicio
            </button>
            <button onClick={()=>{setCurrentView('alerts');setIsMenuOpen(false);}}
              className={`text-left flex items-center gap-3 ${currentView==='alerts'?'text-yellow-400':'text-zinc-300'}`}>
              <Bell size={20}/> Notificaciones {studentUnreadCount>0?'('+studentUnreadCount+')':''}
            </button>
            <button 
              disabled={!hasPaidMonth} 
              onClick={() => { setCurrentView('calendar'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (['calendar', 'workout'].includes(currentView) ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Mi Agenda {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            <button 
              disabled={!hasPaidMonth} 
              onClick={() => { setCurrentView('stats'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'stats' ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Mi Estadística {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            <button 
              disabled={!hasPaidMonth} 
              onClick={() => { setCurrentView('community'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-3 ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'community' ? 'text-yellow-400' : 'text-zinc-600')}`}
            >
              Salón Ragnar {!hasPaidMonth && <Clock size={20}/>}
            </button>
            
            <button 
              onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }} 
              className={`text-left flex items-center gap-4 ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-600'}`}
            >
              Chat Directo 
              {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full not-italic font-sans">{unreadCount}</span>}
            </button>
            
            <button 
              onClick={() => { setCurrentView('profile'); setIsMenuOpen(false); }} 
              className={`text-left ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-600'}`}
            >
              Mi Perfil & Trofeos
            </button>
            
            <div className="h-px bg-zinc-800 my-4"></div>
            
            <button 
              onClick={handleLogout} 
              className="text-left text-red-500 flex items-center gap-3"
            >
              <LogOut/> Salir
            </button>
            
          </div>
        </div>
      )}

      {/* HEADER DE BIENVENIDA CON RACHA */}
      <div className="bg-yellow-400 text-black px-3 sm:px-4 pt-4 pb-10 rounded-b-[2rem] sm:rounded-b-[3rem] shadow-xl relative z-10 shrink-0 w-full min-w-0"
        style={{paddingTop:'max(16px, env(safe-area-inset-top))'}}>
          <div className="flex justify-between items-center gap-2 min-w-0 w-full max-w-2xl mx-auto">
            
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
               <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-black rounded-2xl flex items-center justify-center text-yellow-400 shadow-lg">
                 <User size={24}/>
               </div>
               <div className="min-w-0 flex-1">
                 <h1 className="text-base sm:text-xl font-black uppercase leading-tight tracking-tighter break-words">
                   {client?.name || 'Atleta'}
                 </h1>
                 <div className="flex items-center gap-1.5 mt-1">
                   <Flame size={12} className={client?.currentStreak > 0 ? "text-orange-500" : "text-black/40"}/>
                   <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                     Racha: {client?.currentStreak || 0} Días
                   </p>
                 </div>
               </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
               <button onClick={() => setCurrentView('alerts')} aria-label="Mis notificaciones"
                 className="relative p-2 bg-black/5 rounded-lg">
                 <Bell size={24}/>
                 {(studentUnreadCount>0||unreadCount>0) && <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-red-600 text-white font-black rounded-full text-[10px] border border-black flex items-center justify-center">{studentUnreadCount||unreadCount}</span>}
               </button>
               <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-black/5 rounded-lg">
                 <Menu size={28}/>
               </button>
            </div>
            
          </div>
      </div>

      {/* CONTENIDO PRINCIPAL DINÁMICO */}
      <main className="ragnar-student-content flex-1 min-w-0 max-w-2xl mx-auto w-full px-3 sm:px-4 -mt-6 pb-32 relative z-20 flex flex-col">

        {currentView==='home' && (
          <section className="space-y-4 animate-in fade-in">
            <div className="rounded-[2rem] border border-yellow-400/30 bg-zinc-900 p-6 shadow-xl">
              <div className="flex items-center gap-2 text-yellow-400 mb-3">
                <Dumbbell size={22}/>
                <span className="font-black uppercase tracking-wider text-xs">Mi entrenamiento de hoy</span>
              </div>
              <h2 className="text-white text-2xl font-black uppercase tracking-tight">
                {todayWorkout ? todayWorkout.finalized?'¡Entrenamiento completado!':'Listo para entrenar' : 'Tu próxima sesión'}
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                {todayWorkout
                  ? todayWorkout.count+' ejercicios · '+todayWorkout.sets+' series planificadas'
                  : allSessionsIds.some(id=>id>todayYmd)
                    ? 'Próxima rutina programada: '+allSessionsIds.filter(id=>id>todayYmd).sort()[0].split('-').reverse().join('/')
                    : 'Todavía no tenés una rutina asignada para hoy. Consultá el calendario o escribile a tu entrenador.'}
              </p>
              {hasPaidMonth ? (
                <button type="button" onClick={()=>{
                  if(todayWorkout){setDate(new Date());setCurrentView('workout');}
                  else {setCurrentView('calendar');}
                }} className="mt-5 w-full py-4 bg-yellow-400 text-black font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2">
                  <Dumbbell size={18}/>
                  {todayWorkout ? todayWorkout.finalized?'Ver mi entrenamiento':'Comenzar / continuar entrenamiento':'Ver mi agenda'}
                </button>
              ) : (
                <button type="button" onClick={()=>setCurrentView('profile')}
                  className="mt-4 w-full py-3 bg-amber-500/10 border border-amber-400/30 text-amber-200 rounded-xl font-bold text-sm">
                  Revisar mi suscripción
                </button>
              )}
            </div>
            {upcomingRenewal && upcomingRenewal.daysUntil>=0 &&
              upcomingRenewal.daysUntil<=3 && renewalPaid===false && (
              <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4 flex items-start gap-3">
                <Clock size={21} className="text-amber-300 shrink-0"/>
                <div>
                  <p className="text-amber-200 text-sm font-black">
                    {upcomingRenewal.daysUntil===0?'Tu plan renueva hoy':
                      'Tu plan se renueva en '+upcomingRenewal.daysUntil+' día'+(upcomingRenewal.daysUntil===1?'':'s')}
                  </p>
                  <p className="text-zinc-300 text-xs mt-1">
                    Fecha base de cobro: {upcomingRenewal.dueYmd.split('-').reverse().join('/')}. Si ya abonaste, consultá al entrenador.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setCurrentView('stats')} disabled={!hasPaidMonth}
                className="bg-zinc-900 border border-zinc-800 text-left rounded-2xl p-4 disabled:opacity-40">
                <TrendingUp className="text-yellow-400" size={24}/>
                <p className="text-white font-black text-sm mt-3">Mi evolución</p>
                <p className="text-xs text-zinc-400 mt-1">Series, cargas y progreso</p>
              </button>
              <button onClick={()=>setCurrentView('alerts')}
                className="bg-zinc-900 border border-zinc-800 text-left rounded-2xl p-4">
                <Bell className="text-yellow-400" size={24}/>
                <p className="text-white font-black text-sm mt-3">Mis avisos</p>
                <p className="text-xs text-zinc-400 mt-1">{studentUnreadCount} avisos pendientes</p>
              </button>
              <button onClick={()=>setCurrentView('chat')}
                className="bg-zinc-900 border border-zinc-800 text-left rounded-2xl p-4">
                <MessageSquare className="text-yellow-400" size={24}/>
                <p className="text-white font-black text-sm mt-3">Mi entrenador</p>
                <p className="text-xs text-zinc-400 mt-1">{unreadCount} mensajes sin leer</p>
              </button>
              <button onClick={()=>setCurrentView('calendar')} disabled={!hasPaidMonth}
                className="bg-zinc-900 border border-zinc-800 text-left rounded-2xl p-4 disabled:opacity-40">
                <CalendarIcon className="text-yellow-400" size={24}/>
                <p className="text-white font-black text-sm mt-3">Calendario</p>
                <p className="text-xs text-zinc-400 mt-1">Planificación de mis días</p>
              </button>
            </div>
          </section>
        )}

        {currentView==='alerts' && (
          <StudentAlertsPanel clientId={clientId}
            vapidKey={trainerSettings.webPushVapidPublicKey||''}
            refreshSignal={studentAlertsRevision}
            onRead={setStudentUnreadCount}
            openChat={()=>setCurrentView('chat')}
            openCalendar={(sourceId)=>{
              if(sourceId && /^\d{4}-\d{2}-\d{2}$/.test(sourceId)){
                setDate(new Date(sourceId+'T12:00:00'));
              }
              setCurrentView('calendar');
            }}/>
        )}

        {/* --- VISTA: CALENDARIO --- */}
        {currentView === 'calendar' && hasPaidMonth && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
               <div className="flex items-center gap-2 mb-6">
                 <CalendarIcon size={20} className="text-yellow-400"/>
                 <h3 className="text-lg font-black uppercase tracking-widest text-white italic">Planificación</h3>
               </div>
               <Calendar 
                 onChange={handleDateChange} 
                 value={date} 
                 className="react-calendar-custom" 
                 tileClassName={({ date: tDate }) => allSessionsIds.includes(formatDateId(tDate)) ? 'has-workout' : null} 
               />
            </div>
          </div>
        )}

        {/* --- VISTA: ENTRENAMIENTO --- */}
        {currentView === 'workout' && hasPaidMonth && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-10">
            
            <div className="flex items-center gap-4 px-2 mb-2">
                <button 
                  onClick={() => setCurrentView('calendar')} 
                  className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-white hover:text-yellow-400 hover:border-yellow-400 transition-colors shadow-lg"
                >
                  <ChevronLeft size={24}/>
                </button>
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                      {isSessionFinalized ? 'Resumen' : 'Entrenar'}
                    </h2>
                    <p className="text-yellow-400 font-bold text-[10px] uppercase mt-1 tracking-widest">
                      {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  {isSessionFinalized && (
                    <button 
                      onClick={() => setShowShareModal(true)} 
                      className="p-2 bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-xl hover:bg-yellow-400/20 transition-colors" 
                      title="Compartir Victoria"
                    >
                      <Share2 size={20}/>
                    </button>
                  )}
                </div>
            </div>

            {/* --- PANEL DE CONFIGURACIÓN DE SESIÓN --- */}
            {!isSessionFinalized && (
              <div className="space-y-3 mb-6">
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-zinc-500" />
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                      Timer Descanso:
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-black px-3 py-1 rounded-xl border border-zinc-800">
                     <input 
                       type="number" 
                       className="bg-transparent text-yellow-400 font-black w-10 text-center outline-none" 
                       value={restTime} 
                       onChange={(e) => updatePreferredRest(e.target.value)} 
                     />
                     <span className="text-[10px] font-black text-zinc-600">seg</span>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
                   
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <Droplets size={20} className="text-blue-400" />
                       <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                         Hidratación:
                       </span>
                     </div>
                     <div className="flex items-center gap-2 bg-black px-3 py-1 rounded-xl border border-zinc-800">
                        <input 
                          type="number" 
                          step="0.1" 
                          placeholder="0.0" 
                          className="bg-transparent text-blue-400 font-black w-12 text-center outline-none" 
                          value={hydration} 
                          onChange={(e) => handleUpdateSessionDetails('hydration', e.target.value)} 
                        />
                        <span className="text-[10px] font-black text-zinc-600">Lts</span>
                     </div>
                   </div>

                   <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/50">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <Activity size={20} className="text-red-400" />
                         <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                           Cardio Extra:
                         </span>
                       </div>
                       <div className="flex items-center gap-2 bg-black px-3 py-1 rounded-xl border border-zinc-800">
                          <input 
                            type="number" 
                            placeholder="0" 
                            className="bg-transparent text-red-400 font-black w-12 text-center outline-none" 
                            value={cardioMinutes} 
                            onChange={(e) => handleUpdateSessionDetails('cardioMinutes', e.target.value)} 
                          />
                          <span className="text-[10px] font-black text-zinc-600">Min</span>
                       </div>
                     </div>
                     
                     <div className="flex gap-2">
                       {['Baja', 'Media', 'Alta'].map(level => (
                         <button 
                           key={level} 
                           onClick={() => handleUpdateSessionDetails('cardioIntensity', level)} 
                           className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border ${cardioIntensity === level ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                         >
                           {level}
                         </button>
                       ))}
                     </div>
                   </div>
                </div>
              </div>
            )}

            {/* RESUMEN DE COMPLEMENTOS CUANDO SE FINALIZA */}
            {isSessionFinalized && (hydration || cardioMinutes) && (
              <div className="flex gap-3 mb-6">
                 {hydration && (
                   <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex-1 flex flex-col items-center justify-center text-center">
                     <Droplets size={24} className="text-blue-400 mb-2" />
                     <span className="text-white font-black text-lg">{hydration} Lts</span>
                     <span className="text-[10px] text-blue-400/60 uppercase tracking-widest font-black mt-1">Hidratación</span>
                   </div>
                 )}
                 {cardioMinutes && (
                   <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex-1 flex flex-col items-center justify-center text-center">
                     <Activity size={24} className="text-red-400 mb-2" />
                     <span className="text-white font-black text-lg">{cardioMinutes} Min</span>
                     <span className="text-[10px] text-red-400/60 uppercase tracking-widest font-black mt-1">Cardio {cardioIntensity}</span>
                   </div>
                 )}
              </div>
            )}

            {/* LISTA DE EJERCICIOS Y SOBRECARGA */}
            <div className="space-y-4">
                {dailySession.length > 0 ? (
                  dailySession.map((ex, exIdx) => {
                    const safeSets = ex.plannedSets || Array.from({ length: Math.max(1, parseInt(ex.sets) || 1) }).map(() => ({
                      reps: String(ex.reps || ''), 
                      rir: String(ex.rir || '')
                    }));

                    // HISTORIAL DE SOBRECARGA PROGRESIVA
                    const historyData = exerciseHistory[ex.name];
                    const hasValidHistory = historyData && historyData.actualSets && historyData.actualSets.some(s => s.completed);

                    return (
                      <div key={exIdx} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-sm">
                        
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3 w-full">
                            <div className="w-8 h-8 rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-black shrink-0">
                              {exIdx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg uppercase tracking-tight leading-none text-white">{ex.name}</h3>
                                {ex.videoUrl && (
                                  <a 
                                    href={ex.videoUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                                  >
                                    <Video size={16}/>
                                  </a>
                                )}
                              </div>

                              {/* ALERTA DE SOBRECARGA MÁGICA */}
                              {hasValidHistory && (
                                <div className="mt-2 mb-4 inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 px-2 py-1 rounded-md text-yellow-400 shadow-inner">
                                  <TrendingUp size={12} className="shrink-0" />
                                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                                    Última vez ({new Date(historyData.date + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}): 
                                    {(() => {
                                       const completedSets = historyData.actualSets.filter(s => s.completed);
                                       const maxWeight = Math.max(0, ...completedSets.map(s => Number(s.weight) || 0));
                                       const maxReps = Math.max(0, ...completedSets.map(s => Number(s.reps) || 0));
                                       return maxWeight > 0 ? ` Máx ${maxWeight}kg` : ` Máx ${maxReps} Reps`;
                                    })()}
                                  </span>
                                </div>
                              )}

                            </div>
                          </div>
                        </div>

                        {/* Adaptador visual por si es una rutina vieja (Global RIR) */}
                        {ex.rir && !ex.plannedSets && (
                          <div className="mb-4 bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                            <div className="flex justify-between items-center mb-1.5">
                               <span className="text-[10px] text-zinc-500 font-black uppercase">Intensidad</span>
                               <span className="text-[10px] text-black font-black bg-yellow-400 px-2 py-0.5 rounded">RIR {ex.rir}</span>
                            </div>
                            <div className="flex gap-1 h-2.5">
                               {[5, 4, 3, 2, 1, 0].map((val, i) => (
                                  <div 
                                    key={val} 
                                    className={`flex-1 rounded-full ${val >= parseInt(ex.rir) ? rirColors[i] : 'bg-zinc-800'}`}
                                  ></div>
                               ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-[minmax(28px,0.65fr)_minmax(38px,0.85fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2 mb-2 px-1 sm:px-2 text-[9px] uppercase font-black text-zinc-500 text-center">
                          <span>Set</span>
                          <span>Meta</span>
                          <span>Reps</span>
                          <span>Kg</span>
                        </div>
                        
                        <div className="space-y-2">
                          {safeSets.map((set, sIdx) => {
                            const isDone = dailySession[exIdx].actualSets?.[sIdx]?.completed;
                            return (
                              <div key={sIdx} className={`grid grid-cols-[minmax(28px,0.65fr)_minmax(38px,0.85fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2 items-center p-1.5 sm:p-2 rounded-2xl transition-colors ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/30 border border-zinc-800/50'}`}>
                                <span className="font-bold text-xs sm:text-sm ml-0.5 sm:ml-2 text-white whitespace-nowrap">#{sIdx + 1}</span>
                                
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-center text-xs font-black text-zinc-400">
                                    {set.reps || ex.reps}
                                  </span>
                                  {set.rir && (
                                    <span className="text-[8px] uppercase font-black text-yellow-500 bg-yellow-500/10 px-1 rounded mt-0.5">
                                      RIR {set.rir}
                                    </span>
                                  )}
                                </div>
                                
                                <input 
                                  type="number" 
                                  placeholder="0" 
                                  disabled={isSessionFinalized} 
                                  className="w-full min-w-0 max-w-full bg-zinc-800 border-none rounded-lg py-2 px-1 text-center text-base font-bold text-white focus:ring-1 focus:ring-yellow-400 disabled:opacity-50" 
                                  value={dailySession[exIdx].actualSets?.[sIdx]?.reps || ''} 
                                  onChange={(e) => handleUpdateSet(exIdx, sIdx, 'reps', e.target.value)} 
                                />
                                
                                <input 
                                  type="number" 
                                  placeholder="kg" 
                                  disabled={isSessionFinalized} 
                                  className="w-full min-w-0 max-w-full bg-zinc-800 border-none rounded-lg py-2 px-1 text-center text-base font-bold text-white focus:ring-1 focus:ring-yellow-400 disabled:opacity-50" 
                                  value={dailySession[exIdx].actualSets?.[sIdx]?.weight || ''} 
                                  onChange={(e) => handleUpdateSet(exIdx, sIdx, 'weight', e.target.value)} 
                                />
                                
                                <button 
                                  onClick={() => toggleSetComplete(exIdx, sIdx)} 
                                  className={`col-span-4 mt-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDone ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                >
                                  {isDone ? <><CheckCircle size={14}/> Completada</> : 'Marcar Hecha'}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800 flex flex-col items-center">
                    <Dumbbell className="w-12 h-12 text-zinc-800 mb-4 opacity-30"/>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Sin rutina para hoy</p>
                  </div>
                )}
            </div>
            
            {dailySession.length > 0 && (
              <StudentWorkoutNote clientId={clientId} dateId={currentDateId}/>
            )}

            {dailySession.length > 0 && !isSessionFinalized && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2 mt-4">
                <label htmlFor="ragnar-effort" className="block text-white font-black text-sm uppercase">
                  Esfuerzo percibido · del 1 al 10
                </label>
                <p className="text-zinc-400 text-xs">1 significa muy fácil; 10, máximo esfuerzo. Ayuda al coach a ajustar tu planificación.</p>
                <select id="ragnar-effort" disabled={isFinishing} value={perceivedEffort}
                  onChange={e=>setPerceivedEffort(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-white text-sm outline-none focus:border-yellow-400">
                  {Array.from({length:10},(_,i)=>i+1).map(value=>(
                    <option key={value} value={value}>{value} / 10{value===1?' · Muy fácil':value===10?' · Máximo esfuerzo':''}</option>
                  ))}
                </select>
              </div>
            )}
            {dailySession.length>0&&isSessionFinalized&&(
              <div className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm">
                Entrenamiento finalizado {recordedEffort!==null && '· esfuerzo '+recordedEffort+'/10'}
              </div>
            )}
            {dailySession.length > 0 && !isSessionFinalized && (
              <button 
                onClick={handleFinishWorkout}
                disabled={isFinishing}
                className="w-full bg-green-500 text-black font-black py-5 mt-6 rounded-[2rem] uppercase tracking-widest shadow-lg shadow-green-500/10 transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
              >
                <Trophy size={20} /> {isFinishing ? 'Guardando entrenamiento...' : 'Finalizar Sesión'}
              </button>
            )}

          </div>
        )}

        {/* --- VISTA: SALÓN RAGNAR --- */}
        {currentView === 'community' && hasPaidMonth && (
          <CommunityView currentUserId={clientId} userName={client?.name} />
        )}

        {/* --- VISTA: ESTADÍSTICAS --- */}
        {currentView === 'stats' && hasPaidMonth && (
          <div className="space-y-6 animate-in fade-in">
            <ProgressChart clientId={client?.id} />
          </div>
        )}

        {/* --- VISTA: CHAT --- */}
        {currentView === 'chat' && (
          <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 flex flex-col h-[65vh] shadow-xl overflow-hidden animate-in fade-in">
            
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-3">
              <MessageSquare className="text-yellow-400" size={24}/>
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">Canal Directo</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                  <MessageSquare size={48} className="mb-4" />
                  <p>Mándale un mensaje a tu entrenador.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.sender === 'student' ? 'bg-yellow-400 text-black rounded-tr-none' : msg.sender === 'system' ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none font-bold' : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'}`}>
                      {msg.text}
                      <span className="block text-[9px] opacity-60 mt-2 text-right">
                        {msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2">
              <input 
                type="text" 
                placeholder="Tu mensaje..." 
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 outline-none text-sm" 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()} 
                className="bg-yellow-400 disabled:opacity-50 text-black p-3 rounded-xl transition-colors"
              >
                <Send size={20}/>
              </button>
            </form>

          </div>
        )}

        {/* --- VISTA: PERFIL Y VITRINA DE TROFEOS --- */}
        {currentView === 'profile' && (
          <div className="space-y-6 animate-in fade-in">
             
             <div className="bg-zinc-900 rounded-[2rem] p-8 border border-zinc-800 text-center relative overflow-hidden">
               {client?.currentStreak >= 3 && (
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
               )}
               <div className="w-20 h-20 bg-yellow-400 rounded-2xl mx-auto mb-4 flex items-center justify-center text-black shadow-lg relative z-10">
                 <User size={40}/>
               </div>
               <h2 className="text-2xl font-black uppercase text-white relative z-10">{client?.name}</h2>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">{client?.email}</p>
             </div>
             
             {/* VITRINA DE TROFEOS */}
             <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 shadow-xl">
               <h3 className="text-white font-bold uppercase mb-4 flex items-center gap-2">
                 <Award size={20} className="text-yellow-400"/> Vitrina de Logros
               </h3>
               
               <div className="grid grid-cols-2 gap-3">
                 {Object.values(MEDALS_DB).map(medal => {
                   const isUnlocked = client?.medals?.includes(medal.id);
                   return (
                     <div 
                       key={medal.id} 
                       className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all border ${isUnlocked ? `bg-gradient-to-br ${medal.color} border-transparent shadow-lg ${medal.shadow}` : 'bg-black/40 border-zinc-800 opacity-50 grayscale'}`}
                     >
                       <span className="text-3xl mb-2 drop-shadow-md">{medal.icon}</span>
                       <h4 className={`text-[10px] font-black uppercase tracking-widest ${isUnlocked ? 'text-white' : 'text-zinc-500'}`}>
                         {medal.name}
                       </h4>
                     </div>
                   );
                 })}
               </div>
             </div>

             <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 shadow-xl">
               <h3 className="text-white font-bold uppercase mb-6 flex items-center gap-2">
                 <CreditCard size={20} className="text-yellow-400"/> Suscripción
               </h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-black/40 p-5 rounded-2xl border border-zinc-800">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-black">Estado</p>
                      <p className="font-bold text-lg uppercase text-white">{date.toLocaleString('es-ES', { month: 'long' })}</p>
                    </div>
                    <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase ${hasPaidMonth ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                      {hasPaidMonth ? 'Activo' : 'Vencido'}
                    </span>
                  </div>
                  
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Alias de Pago:</p>
                    <p className="font-mono font-bold text-yellow-400 text-lg select-all">{trainerSettings.alias || 'SIN_ALIAS'}</p>
                  </div>
                  
                  <button 
                    onClick={handleGoToPay} 
                    className="w-full bg-yellow-400 text-black font-black py-5 rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    Ir a Mercado Pago <ExternalLink size={20}/>
                  </button>
               </div>
             </div>
             
             <StudentChangePassword />

             <button 
               onClick={handleLogout} 
               className="w-full py-4 text-zinc-600 hover:text-red-500 font-bold uppercase text-[10px] tracking-[0.3em] transition-colors"
             >
               Cerrar Sesión
             </button>
             
          </div>
        )}
      </main>

      {/* --- CRONÓMETRO FLOTANTE --- */}
      {timerEndTime && (
        <div className="fixed bottom-24 left-4 right-4 bg-zinc-900 border border-yellow-400/50 rounded-2xl p-4 shadow-2xl z-[60] flex items-center justify-between animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-4">
            <Timer size={28} className="text-yellow-400 animate-pulse" />
            <div>
              <p className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Descanso...</p>
              <p className="text-3xl font-black text-white leading-none">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setTimerEndTime(null)} 
            className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <X size={20}/>
          </button>
        </div>
      )}

      {/* --- NAV BAR INFERIOR --- */}
      <nav className="ragnar-student-bottom-nav fixed bottom-0 left-0 right-0 w-full max-w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-1 sm:px-2 py-2 flex justify-between items-center z-[40]"
        style={{paddingBottom:'max(12px, env(safe-area-inset-bottom))'}} aria-label="Navegación del alumno">
        <button type="button" onClick={()=>setCurrentView('home')}
          className={`flex flex-col items-center justify-center gap-1 w-1/6 min-h-12 transition-colors ${currentView==='home'?'text-yellow-400':'text-zinc-500'}`}>
          <Dumbbell size={20}/>
          <span className="text-[9px] font-black uppercase">Inicio</span>
        </button>
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('calendar')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/6 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (['calendar', 'workout'].includes(currentView) ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <CalendarIcon size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Agenda</span>
        </button>
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('community')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/6 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'community' ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <Users size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Salón</span>
        </button>
        
        <button 
          disabled={!hasPaidMonth} 
          onClick={() => setCurrentView('stats')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/6 transition-colors ${!hasPaidMonth ? 'opacity-30 cursor-not-allowed' : (currentView === 'stats' ? 'text-yellow-400' : 'text-zinc-500')}`}
        >
          <TrendingUp size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Progreso</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('chat')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/6 relative transition-colors ${currentView === 'chat' ? 'text-yellow-400' : 'text-zinc-500'}`}
        >
          <MessageSquare size={20}/>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-black"></span>
          )}
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Chat</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('profile')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-1/6 transition-colors ${currentView === 'profile' ? 'text-yellow-400' : 'text-zinc-500'}`}
        >
          <User size={20}/>
          <span className="text-[9px] font-black uppercase tracking-wider mt-1">Perfil</span>
        </button>
        
      </nav>

    </div>
  );
}
