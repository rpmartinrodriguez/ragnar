import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, Plus, X, Dumbbell, Calendar, Check, Link, Edit, Archive, ArchiveRestore, User, Clock, ShieldCheck, ShieldAlert, Filter, LoaderCircle } from 'lucide-react';

export default function ClientsView({ 
  clients = [], 
  settings = null, 
  navigateTo, 
  onAddClient, 
  onUpdateClient, 
  onDeleteClient 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // --- ESTADOS PARA DÍAS DE GRACIA ---
  const [isGraceModalOpen, setIsGraceModalOpen] = useState(false);
  const [graceClient, setGraceClient] = useState(null);
  const [graceDays, setGraceDays] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    plan: '',
    startDate: ''
  });

  const safeClients = Array.isArray(clients) ? clients : [];
  const safePlans = settings?.plans && Array.isArray(settings.plans) && settings.plans.length > 0 
    ? settings.plans.map(p => typeof p === 'object' ? String(p.name) : String(p)) 
    : ['Plan Base'];

  // La ficha sigue siendo la misma: "UID histórico" no es sinónimo de acceso activo.
  const filteredClients = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es');
    return safeClients.filter(client => {
      if (!client || !client.name) return false;
      const plan = typeof client.plan === 'object' ? client.plan?.name : client.plan;
      const searchable = [client.name,client.email,plan].map(v=>String(v||'').toLocaleLowerCase('es')).join(' ');
      if (query && !searchable.includes(query)) return false;
      if (statusFilter === 'activated' && client.accountAccessStatus !== 'activated') return false;
      if (statusFilter === 'pending' && client.accountAccessStatus === 'activated') return false;
      if (statusFilter === 'archived' && client.active !== false) return false;
      if (statusFilter === 'active' && client.active === false) return false;
      return true;
    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  }, [clients,searchTerm,statusFilter]);
  const activatedCount = safeClients.filter(c=>c.accountAccessStatus==='activated').length;
  const activeCount = safeClients.filter(c=>c.active!==false).length;

  // --- MANEJO DEL MODAL PRINCIPAL (CREAR/EDITAR) ---
  const openAddModal = () => {
    setEditingClient(null);
    setFormError('');
    setFormData({
      name: '',
      email: '',
      plan: safePlans[0],
      startDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client, e) => {
    e.stopPropagation();
    setEditingClient(client);
    setFormError('');
    let planStr = client.plan || safePlans[0];
    if (typeof client.plan === 'object' && client.plan !== null) {
      planStr = client.plan.name || safePlans[0];
    }
    setFormData({
      name: String(client.name || ''),
      email: String(client.email || ''),
      plan: String(planStr),
      startDate: client.startDate ? String(client.startDate) : new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // --- MANEJO DEL MODAL DE DÍAS DE GRACIA ---
  const openGraceModal = (client, e) => {
    e.stopPropagation();
    setGraceClient(client);
    // Si ya tenía días de gracia asignados, los cargamos. Si no, 0.
    setGraceDays(client.graceDays || 0);
    setIsGraceModalOpen(true);
  };

  const handleGraceSubmit = async (e) => {
    e.preventDefault();
    if (!graceClient || isSaving) return;
    setIsSaving(true);
    setFormError('');
    try {
      await onUpdateClient?.({ ...graceClient, graceDays: Math.min(365,Math.max(0,Number(graceDays)||0)) });
      setIsGraceModalOpen(false);
      setGraceClient(null);
    } catch (error) {
      setFormError('No se pudieron guardar los días de gracia: ' + (error?.message||'error de conexión'));
    } finally { setIsSaving(false); }
  };

  // --- ACCIONES GENERALES ---
  const handleDelete = (clientId, e) => {
    e.stopPropagation();
    if(typeof onDeleteClient === 'function') {
      onDeleteClient(clientId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const name = String(formData.name||'').trim().replace(/\s+/g,' ');
    const email = String(formData.email||'').trim().toLowerCase();
    if (!name) return setFormError('Ingresá el nombre del atleta.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setFormError('El correo tiene un formato inválido.');
    }
    if (email && safeClients.some(c=>c.id!==editingClient?.id && String(c.email||'').trim().toLowerCase()===email)) {
      return setFormError('Otro atleta ya tiene asignado este correo. Cada acceso debe ser único.');
    }
    if (editingClient?.accountAccessStatus==='activated' &&
        email !== String(editingClient.email||'').trim().toLowerCase()) {
      return setFormError('El correo de un atleta activado no se cambia desde esta ficha porque está vinculado a Firebase Authentication.');
    }
    const dataToSave = {
      name,
      email,
      plan: String(formData.plan||safePlans[0]),
      startDate:String(formData.startDate)
    };
    setIsSaving(true);setFormError('');
    try {
      if(editingClient) await onUpdateClient?.({...editingClient,...dataToSave});
      else await onAddClient?.({...dataToSave,graceDays:0,status:'active'});
      setIsModalOpen(false);
    } catch (error) {
      setFormError('No se pudo guardar el atleta: '+(error?.message||'revisá tu conexión e intentá nuevamente.'));
    } finally {setIsSaving(false);}
  };

  const handleCopyLink = (e, clientId) => {
    e.stopPropagation(); 
    const inviteLink = `${window.location.origin}?invite=${clientId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      
      {/* Header con Buscador y Botón */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase">Mis Atletas</h2>
          <p className="text-zinc-400 text-sm">Perfiles, suscripciones y estado de acceso de tus alumnos.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="search" aria-label="Buscar atleta por nombre, correo o plan"
              placeholder="Buscar nombre, correo o plan..." 
              className="pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl w-full text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shrink-0"
          >
            <Plus size={18}/> <span className="hidden sm:inline">Nuevo Atleta</span><span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Controles rápidos de gestión: sin consultar subcolecciones ni modificar datos. */}
      <div className="flex flex-wrap items-center gap-2 mb-5" aria-label="Filtros de atletas">
        {[
          {id:'all',label:'Todos',count:safeClients.length},
          {id:'active',label:'Activos',count:activeCount},
          {id:'activated',label:'Con acceso',count:activatedCount},
          {id:'pending',label:'Sin activar',count:safeClients.length-activatedCount},
          {id:'archived',label:'Archivados',count:safeClients.length-activeCount}
        ].map(option=>(
          <button key={option.id} type="button" onClick={()=>setStatusFilter(option.id)}
            aria-pressed={statusFilter===option.id}
            className={`px-3 py-2 min-h-10 rounded-xl text-xs font-bold border transition-colors ${statusFilter===option.id?'bg-yellow-400 border-yellow-400 text-black':'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-yellow-400/50'}`}>
            {option.label} <span className="ml-1 opacity-70">{option.count}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500" role="status">{filteredClients.length} mostrados</span>
      </div>
      {/* Grilla de atletas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div 
              key={client.id} 
              onClick={() => { if(typeof navigateTo === 'function') navigateTo('client-detail', client) }}
              className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 hover:border-yellow-400/50 focus-within:border-yellow-400/60 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400 transform -translate-x-1 group-hover:translate-x-0 transition-transform duration-200"></div>

              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-zinc-800 text-yellow-400 rounded-full flex items-center justify-center font-bold text-lg border border-zinc-700 shrink-0">
                  {client.name ? String(client.name).charAt(0).toUpperCase() : '?'}
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${client.accountAccessStatus==='activated' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'}`}>
                    {client.accountAccessStatus==='activated' ? 'Acceso activado' : 'Acceso pendiente'}
                  </span>
                  {client.active===false && (
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Archivado
                    </span>
                  )}
                  {/* Etiqueta visible si tiene días de gracia activos */}
                  {client.graceDays > 0 && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      <Clock size={10} /> +{client.graceDays} Días Gracia
                    </span>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-lg text-white group-hover:text-yellow-400 transition-colors mb-1 break-words">{client.name}</h3>
              <p className="text-xs text-zinc-500 mb-3 break-all">{client.email || 'Sin correo de acceso'}</p>
              
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Dumbbell size={12} className="text-yellow-400"/> 
                  {typeof client.plan === 'object' && client.plan !== null ? client.plan.name : (client.plan || 'Plan Base')}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Calendar size={12} className="text-yellow-400"/> 
                  Inicio: {client.startDate ? new Date(client.startDate).toLocaleDateString('es-ES', {timeZone: 'UTC'}) : 'No definido'}
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-800" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigateTo('access'); }}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg border border-yellow-400/20 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                  title="Administrar acceso; la invitación antigua está deshabilitada durante la migración"
                >
                  Gestionar acceso
                </button>

                {/* NUEVO BOTÓN: DÍAS DE GRACIA */}
                <button 
                  onClick={(e) => openGraceModal(client, e)} 
                  className={`p-2 rounded-lg transition-colors border ${client.graceDays > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' : 'text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 border-transparent'}`}
                  title="Otorgar Días de Gracia"
                >
                  <Clock size={16}/>
                </button>

                <button onClick={(e) => openEditModal(client, e)} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors" title="Editar Atleta">
                  <Edit size={16}/>
                </button>

                <button type="button" onClick={(e) => handleDelete(client.id, e)}
                  className="p-2.5 text-zinc-400 hover:text-yellow-400 rounded-lg hover:bg-zinc-800 transition-colors"
                  title={client.active===false?'Restaurar atleta':'Archivar atleta sin perder historial'}
                  aria-label={client.active===false?'Restaurar '+client.name:'Archivar '+client.name}>
                  {client.active===false?<ArchiveRestore size={17}/>:<Archive size={17}/>}
                </button>
                
                <div className="ml-auto text-zinc-600 group-hover:text-yellow-400 transition-colors">
                  <ChevronRight size={18}/>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <User size={48} className="mb-4 opacity-20 text-zinc-500" />
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">{safeClients.length===0?'Todavía no hay atletas':'No hay atletas con estos filtros'}</p>
            {(searchTerm||statusFilter!=='all') && <button type="button" onClick={()=>{setSearchTerm('');setStatusFilter('all');}} className="mt-4 text-yellow-400 font-bold text-sm underline">Limpiar búsqueda y filtros</button>}
          </div>
        )}
      </div>

      {/* MODAL PRINCIPAL CREAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-label={editingClient?'Editar atleta':'Nuevo atleta'} className="bg-zinc-950 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[2rem] border border-zinc-800 shadow-2xl relative">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                {editingClient ? 'Editar Atleta' : 'Nuevo Atleta'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} type="button" className="text-zinc-500 hover:text-white bg-zinc-800 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nombre del Atleta</label>
                <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Correo Electrónico (Opcional)</label>
                <input type="email" autoComplete="off" disabled={editingClient?.accountAccessStatus==='activated'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                {editingClient?.accountAccessStatus==='activated' && (
                  <p className="mt-2 text-xs text-amber-300">El correo de este atleta ya está vinculado a Firebase Authentication. Para cambiarlo necesitaremos actualizar también su cuenta de acceso.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Plan de Suscripción</label>
                <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors text-sm" value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value})}>
                  {safePlans.map((planName, index) => <option key={index} value={planName}>{planName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Fecha Base de Cobro</label>
                <input type="date" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-400 transition-colors [color-scheme:dark]" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              {formError && <p role="alert" className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{formError}</p>}
              <div className="pt-4 border-t border-zinc-800 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-yellow-400/20 disabled:opacity-50">
                  {isSaving ? 'Guardando...' : editingClient ? 'Guardar Cambios' : 'Crear Atleta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÍAS DE GRACIA */}
      {isGraceModalOpen && graceClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 w-full max-w-sm rounded-[2rem] border border-blue-500/30 shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>

            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full mx-auto flex items-center justify-center mb-4 border border-blue-500/20">
                <Clock size={32} className="text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">
                Días de Gracia
              </h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">
                Atleta: <span className="text-white">{graceClient.name}</span>
              </p>

              <form onSubmit={handleGraceSubmit}>
                {formError && <p role="alert" className="mb-4 text-red-300 text-xs">{formError}</p>
                <div className="mb-6 text-left">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 text-center">
                    Días adicionales de acceso
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button 
                      type="button"
                      onClick={() => setGraceDays(prev => Math.max(0, prev - 1))}
                      className="w-12 h-12 rounded-xl bg-zinc-900 text-white font-black text-xl hover:bg-zinc-800 border border-zinc-800 transition-colors flex items-center justify-center"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="0"
                      className="w-24 bg-zinc-900 border border-blue-500/30 rounded-xl p-3 text-white text-center font-black text-2xl outline-none focus:border-blue-500 transition-colors" 
                      value={graceDays}
                      max="365"
                      onChange={e => setGraceDays(Math.max(0,Math.min(365,parseInt(e.target.value)||0)))} 
                    />
                    <button 
                      type="button"
                      onClick={() => setGraceDays(prev => prev + 1)}
                      className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-black text-xl hover:bg-blue-500/30 border border-blue-500/30 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-zinc-600 text-[10px] text-center mt-3 font-medium px-4">
                    Estos días se sumarán a su fecha de vencimiento antes de que la app le bloquee el acceso. Puedes poner "0" para quitar la gracia.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsGraceModalOpen(false);
                      setGraceClient(null);
                    }} 
                    className="flex-1 py-4 text-zinc-400 font-bold uppercase text-xs rounded-xl bg-black border border-zinc-800 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" disabled={isSaving}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSaving?'Guardando...':'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
