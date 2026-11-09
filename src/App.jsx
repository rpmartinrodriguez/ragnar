import React, { useState, useEffect } from 'react';
import { 
  Menu, Dumbbell, Settings, BarChart3, Users, Calendar, KeyRound, Activity, 
  X, LogOut, List, Layout, Bell, MessageSquare, CreditCard 
} from 'lucide-react';

// --- Firebase ---
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, query, orderBy, where, getDocs, setDoc, limit 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase'; 

// --- Componentes ---
import { Sidebar } from './components/Sidebar';
import DashboardView from './views/DashboardView';
import CoachFollowupView from './views/CoachFollowupView';
import ClientsView from './views/ClientsView';
import ClientDetailView from './views/ClientDetailView';
import ExercisesView from './views/ExercisesView';
import RoutinesView from './views/RoutinesView';
import CalendarView from './views/CalendarView';
import LoginView from './views/LoginView';
import StudentView from './views/StudentView';
import StudentRegistration from './views/StudentRegistration';
import NotificationsView from './views/NotificationsView';
import SettingsView from './views/SettingsView';
import MigrationAuditPanel from './components/MigrationAuditPanel';
import StudentAccessPanel from './components/StudentAccessPanel';
import CoachPushPanel from './components/CoachPushPanel';
import CoachPushForeground from './components/CoachPushForeground';
import ConnectionBanner from './components/ConnectionBanner';
import CommunityView from './views/CommunityView'; 
import PaymentsView from './views/PaymentsView'; 

export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [splashFade, setSplashFade] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null); 
  const [inviteId, setInviteId] = useState(null);

  // Estados de navegación y datos
  const [activeView, setActiveView] = useState(() => {
    const incoming = new URLSearchParams(window.location.search).get('view');
    return incoming === 'notifications' ? 'notifications' : 'dashboard';
  });
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailInitialTab, setDetailInitialTab] = useState('resumen');
  const [detailReturnView, setDetailReturnView] = useState('clients');
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [routines, setRoutines] = useState([]); 
  const [settings, setSettings] = useState(null); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const auth = getAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) setInviteId(inviteParam);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await checkUserRole(currentUser.uid);
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole(null);
        setStudentProfileId(null);
      }
      
      setTimeout(() => {
        setSplashFade(true);
        setTimeout(() => {
          setIsAppReady(true);
        }, 700);
      }, 1500); 
    });
    
    return () => unsubscribe();
  }, []);

  const checkUserRole = async (uid) => {
    // Los historiales conservan UID anteriores: nunca inferir entrenador
    // por el simple hecho de que el usuario no figure como alumno.
    setUserRole(null);
    setStudentProfileId(null);
    try {
      const own = await getDocs(query(collection(db, 'clients'), where('studentUserId', '==', uid), limit(1)));
      if (!own.empty) {
        setStudentProfileId(own.docs[0].id);
        setUserRole('student');
        return;
      }
    } catch (error) {
      console.error('Verificación de alumno:', error);
    }

    // Solo un coach autorizado por reglas Firestore puede listar clients.
    try {
      await getDocs(query(collection(db, 'clients'), limit(1)));
      setUserRole('trainer');
    } catch (error) {
      console.warn('Usuario no habilitado en Firebase nuevo:', error.code || error.message);
      setUserRole('unlinked');
    }
  };

  useEffect(() => {
    if (!user || userRole !== 'trainer') return;

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExercises = query(collection(db, 'exercises'), orderBy('name'));
    const unsubExercises = onSnapshot(qExercises, (snapshot) => {
      setExercises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRoutines = onSnapshot(collection(db, 'routines'), (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const qNotif = query(collection(db, 'trainerNotifications'), where('read', '==', false));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => {
      unsubClients();
      unsubExercises();
      unsubRoutines();
      unsubSettings();
      unsubNotif();
    };
  }, [user, userRole]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.history.pushState({}, document.title, window.location.pathname);
      setInviteId(null);
    } catch (error) { console.error("Error logout:", error); }
  };

  const navigateTo = (view, client = null, options = {}) => {
    if (view === 'client-detail') {
      setDetailReturnView(activeView === 'followup' ? 'followup' : 'clients');
      setDetailInitialTab(options.tab === 'mensajes' ? 'mensajes' : 'resumen');
    }
    setActiveView(view);
    if (client) setSelectedClient(client);
    setIsMobileMenuOpen(false);
  };

  const handleAddClient = async (data) => {
    // Rechazar el formulario solamente si Firestore guardó correctamente.
    await addDoc(collection(db, 'clients'), {
      ...data, createdAt: new Date(), active: true, trainerId: user.uid
    });
  };

  const handleUpdateClientData = async (updatedData) => {
    const { id, ...rest } = updatedData;
    if (!id) throw new Error('La ficha no tiene un ID válido.');
    // Protegemos la relación entre el correo de la ficha y Firebase Auth:
    // modificar solo Firestore dejaría al atleta sin recuperación de contraseña.
    const current = clients.find(c => c.id === id);
    if (current?.accountAccessStatus === 'activated' &&
        String(current.email || '').trim().toLowerCase() !==
        String(rest.email || '').trim().toLowerCase()) {
      throw new Error('El correo de un alumno activado debe cambiarse también en Authentication. Operación cancelada.');
    }
    // Las pantallas de edición reutilizan un objeto de ficha completo. Excluir
    // campos administrados por Auth/servidor evita que un coach con una copia
    // antigua del perfil reactive por accidente la contraseña temporal ya cambiada.
    for (const field of [
      'studentUserId', 'legacyStudentUserId', 'accountAccessStatus',
      'accountActivatedAt', 'authPasswordResetAt', 'authPasswordResetBy',
      'passwordChangeRequired', 'passwordTemporaryIssuedAt',
      'passwordChangedAt', 'passwordChangedBy', 'trainerId', 'createdAt'
    ]) delete rest[field];
    await updateDoc(doc(db, 'clients', id), rest);
  };

  const handleDeleteClient = async (clientId) => {
    const current = clients.find(c => c.id === clientId);
    if (!current) return;
    const willArchive = current.active !== false;
    const question = willArchive
      ? '¿Archivar a ' + (current.name || 'este atleta') +
        '?\n\nSe conservarán la ficha, rutinas, sesiones, mensajes y pagos. Archivar no revoca su acceso de Authentication.'
      : '¿Restaurar a ' + (current.name || 'este atleta') + '?';
    if (!window.confirm(question)) return;
    try {
      // Nunca borrar el documento raíz sin tratar sus subcolecciones.
      // En Firebase, eliminar clients/{id} NO borra sessions/messages/payments.
      await updateDoc(doc(db, 'clients', clientId), { active: !willArchive });
      if (selectedClient?.id === clientId && willArchive) {
        setActiveView('clients');
        setSelectedClient(null);
      }
    } catch (error) {
      window.alert('No se pudo ' + (willArchive ? 'archivar' : 'restaurar') +
        ' el atleta: ' + (error?.message || 'Error de conexión'));
    }
  };

  const handleAddExercise = async (data) => { 
    try { await addDoc(collection(db, 'exercises'), { name: data.name, videoUrl: data.videoUrl || '', trainingRegion: data.trainingRegion || 'unknown' }); } catch (error) { console.error(error); }
  };

  const handleUpdateExercise = async (updatedData) => {
    try { const { id, ...rest } = updatedData; await updateDoc(doc(db, 'exercises', id), rest); } catch (error) { console.error(error); }
  };
  
  const handleDeleteExercise = async (id) => { 
    if(window.confirm('¿Eliminar este ejercicio?')) {
      try { await deleteDoc(doc(db, 'exercises', id)); } catch (error) { console.error(error); }
    }
  };

  const handleAddRoutine = async (data) => {
    try { await addDoc(collection(db, 'routines'), data); } catch (error) { console.error(error); }
  };

  const handleUpdateRoutine = async (data) => {
    try { const { id, ...rest } = data; await updateDoc(doc(db, 'routines', id), rest); } catch (error) { console.error(error); }
  };

  const handleDeleteRoutine = async (id) => {
    if(window.confirm('¿Eliminar esta rutina?')) {
      try { await deleteDoc(doc(db, 'routines', id)); } catch (error) { console.error(error); }
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try { await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true }); } catch (error) { console.error(error); }
  };

  const renderMainContent = () => {
    if (inviteId) {
      return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center gap-4">
        <h1 className="text-yellow-400 text-2xl font-black">RAGNAR · Migración</h1>
        <p className="max-w-md text-zinc-300">Los enlaces de registro antiguos están deshabilitados en esta versión de prueba. Primero vamos a vincular de forma segura las cuentas del Firebase nuevo para conservar los historiales.</p>
        <button onClick={() => { window.history.replaceState({}, document.title, '/'); setInviteId(null); }} className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold">Volver al inicio</button>
      </div>;
    }
    if (user && userRole === 'student' && studentProfileId) {
      return <StudentView clientId={studentProfileId} />;
    }
    if (!user) {
      return <LoginView onLoginSuccess={() => {}} />;
    }
    if (!userRole) {
      return <div className="min-h-screen bg-black text-zinc-300 grid place-items-center">Verificando permisos en el Firebase nuevo...</div>;
    }
    if (userRole !== 'trainer') {
      return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 gap-4 text-center">
        <h1 className="text-2xl font-black text-yellow-400">Cuenta pendiente de vinculación</h1>
        <p className="max-w-md text-zinc-300">Tu cuenta está autenticada, pero todavía no está asociada a un perfil de alumno ni tiene permisos de entrenador en el Firebase nuevo. Tus historiales importados no se borraron.</p>
        <button onClick={handleLogout} className="rounded-xl border border-yellow-400 px-6 py-3 text-yellow-400">Cerrar sesión</button>
      </div>;
    }

    return (
      <div className="ragnar-coach-shell flex w-full max-w-full min-w-0 h-[100dvh] min-h-0 bg-black text-zinc-100 font-sans overflow-hidden">
        <ConnectionBanner/>
        <div className="hidden md:block">
          <Sidebar activeView={activeView} navigateTo={navigateTo} notificationCount={unreadCount} />
        </div>
        
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/95 md:hidden flex flex-col min-h-0 overflow-hidden animate-in fade-in backdrop-blur-sm"
            style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}> 
            <div className="p-4 flex justify-between items-center border-b border-zinc-800 shrink-0">
              <h2 className="text-white font-bold text-xl uppercase tracking-tighter">Menú</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 p-2"><X size={24} /></button>
            </div>
            <div className="p-4 flex flex-col gap-1 overflow-y-auto flex-1 custom-scrollbar">
              <button onClick={() => navigateTo('dashboard')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'dashboard' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><BarChart3 size={20}/> Panel Principal</button>
              <button onClick={() => navigateTo('notifications')} className={`p-4 text-left rounded-xl flex justify-between items-center transition-colors ${activeView === 'notifications' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                 <span className="flex items-center gap-3"><Bell size={20}/> Notificaciones</span>
                 {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
              </button>
              <button onClick={() => navigateTo('clients')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'clients' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Users size={20}/> Mis Atletas</button>
              <button onClick={() => navigateTo('followup')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'followup' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Activity size={20}/> Seguimiento</button>
              <button onClick={() => navigateTo('access')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'access' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><KeyRound size={20}/> Accesos alumnos</button>
              <button onClick={() => navigateTo('exercises')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'exercises' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><List size={20}/> Ejercicios</button>
              <button onClick={() => navigateTo('routines')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'routines' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Layout size={20}/> Rutinas</button>
              <button onClick={() => navigateTo('calendar')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'calendar' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Calendar size={20}/> Agenda</button>
              <button onClick={() => navigateTo('community')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'community' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><MessageSquare size={20}/> Comunidad</button>
              <button onClick={() => navigateTo('payments')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'payments' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><CreditCard size={20}/> Cobros</button>
              <button onClick={() => navigateTo('settings')} className={`p-4 text-left rounded-xl flex items-center gap-3 transition-colors ${activeView === 'settings' ? 'bg-yellow-400 text-black font-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}><Settings size={20}/> Configuración</button>
              <div className="mt-auto pt-6 pb-4 shrink-0">
                <div className="h-px bg-zinc-800 mb-4"></div>
                <button onClick={handleLogout} className="w-full p-4 text-left text-red-500 hover:bg-red-500/10 rounded-xl font-bold flex items-center gap-3 transition-colors"><LogOut size={20} /> Cerrar Sesión</button>
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 min-h-0 flex-1 flex flex-col h-full overflow-hidden relative bg-black">
          <header className="md:hidden shrink-0 min-w-0 flex items-center justify-between gap-2 px-3 py-3 bg-zinc-950 border-b border-zinc-800 shadow-xl"
            style={{paddingTop:'max(12px, env(safe-area-inset-top))'}}> 
            <div className="flex items-center gap-2 min-w-0 flex-1">
               <span className="font-black italic text-base sm:text-lg tracking-tighter truncate"><span className="text-yellow-400">RAGNAR</span><span className="text-white hidden min-[375px]:inline">-TRAINING</span></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
               <button onClick={() => navigateTo('notifications')} className="relative p-2 text-zinc-400"><Bell size={24}/>{unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black"></span>}</button>
               <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-400"><Menu size={24} /></button>
            </div>
          </header>

          <div className="ragnar-coach-content flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 md:p-8 no-scrollbar"
            style={{WebkitOverflowScrolling:'touch',paddingBottom:'max(20px, env(safe-area-inset-bottom))'}}> 
            {activeView === 'dashboard' && <DashboardView clients={clients} settings={settings} navigateTo={navigateTo} onAddClient={handleAddClient} />}
            {activeView === 'notifications' && <NotificationsView navigateTo={navigateTo} clients={clients} />}
            {activeView === 'followup' && <CoachFollowupView clients={clients} navigateTo={navigateTo} />}
            {activeView === 'clients' && <ClientsView clients={clients} settings={settings} routines={routines} navigateTo={navigateTo} onAddClient={handleAddClient} onUpdateClient={handleUpdateClientData} onDeleteClient={handleDeleteClient} />}
            {activeView === 'access' && <StudentAccessPanel clients={clients} onOpenClients={() => navigateTo('clients')} />}
            {activeView === 'exercises' && <ExercisesView exercises={exercises} exercisesLibrary={exercises} onAddExercise={handleAddExercise} onUpdateExercise={handleUpdateExercise} onDeleteExercise={handleDeleteExercise} />}
            {activeView === 'routines' && <RoutinesView routines={routines} exercisesLibrary={exercises} onAddRoutine={handleAddRoutine} onUpdateRoutine={handleUpdateRoutine} onDeleteRoutine={handleDeleteRoutine} />}
            {activeView === 'client-detail' && selectedClient && <ClientDetailView key={selectedClient.id + ':' + detailInitialTab} client={clients.find(c=>c.id===selectedClient.id)||selectedClient} initialTab={detailInitialTab} goBack={() => navigateTo(detailReturnView)} exercisesLibrary={exercises} routines={routines} onUpdateClient={handleUpdateClientData} />}
            {activeView === 'calendar' && <CalendarView clients={clients} />}
            {activeView === 'settings' && (
              <div className="space-y-6">
                <MigrationAuditPanel clients={clients} coachUid={user.uid} />
                <CoachPushPanel />
                <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />
              </div>
            )}
            {activeView === 'community' && <CommunityView isCoach={true} coachName="Coach Ragnar" />}
            {activeView === 'payments' && <PaymentsView clients={clients} settings={settings} onUpdateClient={handleUpdateClientData} />}
          </div>
        </main>
      </div>
    );
  };

  return (
    <>
      {!isAppReady && (
        <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${splashFade ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="relative flex flex-col items-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64 bg-yellow-400/20 blur-[80px] rounded-full pointer-events-none"></div>
            <img src="/logo.png" alt="Logo" className="w-24 h-24 md:w-32 md:h-32 object-contain animate-pulse relative z-10 drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]" onError={(e) => e.target.style.display = 'none'}/>
            <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white mt-6 relative z-10"><span className="text-yellow-400">RAGNAR</span> TRAINING</h1>
            <p className="text-zinc-500 font-black text-[10px] md:text-xs tracking-[0.4em] uppercase mt-2 mb-8 relative z-10">Elite Coaching</p>
            <div className="flex gap-2 relative z-10">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      {renderMainContent()}
      {user && userRole === 'trainer' && <CoachPushForeground onOpenNotifications={() => navigateTo('notifications')} />}
    </>
  );
}
