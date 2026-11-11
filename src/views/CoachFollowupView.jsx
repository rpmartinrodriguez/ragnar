import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Clock3,
  MessageSquare, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';
import { collection, documentId, endAt, getDocs, orderBy, query, startAt } from 'firebase/firestore';
import { db } from '../firebase';
import {enrichCoachIntelligence} from '../utils/coachIntelligence';
import { ymdInArgentina } from '../utils/billingCycle';
import {
  analyzeCoachFollowup, FOLLOWUP_NEXT_DAYS, FOLLOWUP_READ_DAYS,
  shiftYmd, sortCoachFollowup
} from '../utils/coachFollowup';

const stateInfo = {
  contact: { label: 'Contactar', text: 'text-red-300', border: 'border-red-500/30', bg: 'bg-red-500/10', icon: ShieldAlert },
  review: { label: 'Revisar', text: 'text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: AlertCircle },
  onTrack: { label: 'Al día', text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  noData: { label: 'Sin datos', text: 'text-zinc-300', border: 'border-zinc-700', bg: 'bg-zinc-800/60', icon: Clock3 },
  error: { label: 'No disponible', text: 'text-zinc-300', border: 'border-zinc-700', bg: 'bg-zinc-800/60', icon: AlertCircle }
};

function shortDate(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))
    ? ymd.split('-').reverse().join('/') : 'Sin registrar en el período';
}

export default function CoachFollowupView({ clients = [], navigateTo }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const today = ymdInArgentina();
  const activeClients = useMemo(
    () => clients.filter(client => client?.id && client.active !== false),
    [clients]
  );

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      setLoading(true);
      setRows([]);
      setRefreshedAt(null);
      const from = shiftYmd(today, -(FOLLOWUP_READ_DAYS - 1));
      const until = shiftYmd(today, FOLLOWUP_NEXT_DAYS);
      const results = [];
      // Una consulta limitada por atleta y sólo cuando se abre Seguimiento.
      // Los registros sin finalizar son señales para revisar, no ausencias confirmadas.
      for (let i = 0; i < activeClients.length; i += 8) {
        const batch = await Promise.allSettled(activeClients.slice(i, i + 8).map(async client => {
          const ref = collection(db, 'clients', client.id, 'sessions');
          const sessionsQuery = query(ref, orderBy(documentId()), startAt(from), endAt(until));
          const snap = await getDocs(sessionsQuery);
          const sessions=snap.docs.map(item => ({...item.data(),id:item.id}));
          return enrichCoachIntelligence(
            analyzeCoachFollowup(client,sessions,today),
            sessions,today
          );
        }));
        if (cancelled) return;
        batch.forEach((result, offset) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              client: activeClients[i + offset],
              status: 'error',
              reason: 'No pudimos consultar sus sesiones. Revisá conexión o permisos.',
              completed14: null,
              planned14: null,
              unfinishedPast14: null,
              lastFinished: null,
              upcoming: null
            });
          }
        });
        setRows(sortCoachFollowup(results));
      }
      if (!cancelled) {
        setLoading(false);
        setRefreshedAt(new Date());
      }
    }
    refresh().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setRows(activeClients.map(client => ({
          client, status: 'error',
          reason: 'No pudimos consultar sus sesiones. Revisá conexión o permisos.'
        })));
      }
    });
    return () => { cancelled = true; };
  }, [activeClients, refreshIndex, today]);

  const counts = useMemo(() => rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { contact: 0, review: 0, onTrack: 0, noData: 0, error: 0 }), [rows]);

  const checkInReviewCount=useMemo(()=>rows.filter(row=>row.needsWellnessReview).length,[rows]);
  const recentCheckInCount=useMemo(()=>rows.filter(row=>row.checkIn).length,[rows]);

  const visible = useMemo(() => rows.filter(row => {
    if (filter === 'checkin') {
      if (!row.needsWellnessReview) return false;
    } else if (filter !== 'all' && row.status !== filter) return false;
    const term = search.toLocaleLowerCase('es').trim();
    const c = row.client || {};
    return !term || [c.name, c.email, c.plan?.name || c.plan]
      .some(value => String(value || '').toLocaleLowerCase('es').includes(term));
  }), [rows, filter, search]);

  const filters = [
    { id: 'all', label: 'Todos', count: rows.length },
    { id: 'checkin', label: 'Revisar Check-in', count: checkInReviewCount },
    { id: 'contact', label: 'Contactar', count: counts.contact },
    { id: 'review', label: 'Revisar', count: counts.review },
    { id: 'onTrack', label: 'Al día', count: counts.onTrack },
    { id: 'noData', label: 'Sin datos', count: counts.noData },
    { id: 'error', label: 'Errores', count: counts.error }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Activity size={29} className="text-yellow-400 shrink-0" />
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tight">RAGNAR Coach Intelligence</h2>
          </div>
          <p className="text-zinc-400 text-sm mt-2 max-w-2xl">
            Seguimiento de rutinas, adherencia y Check-ins voluntarios en un mismo lugar.
            Las señales sirven para conversar con el alumno, no son diagnósticos ni ausencias confirmadas.
          </p>
        </div>
        <button type="button" onClick={() => setRefreshIndex(n => n + 1)} disabled={loading}
          className="self-start shrink-0 inline-flex items-center gap-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-200 hover:text-yellow-400 hover:border-yellow-400 disabled:opacity-60">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      </header>

      <div className="ragnar-intelligence-coach-summary">
        <div className="flex-1 min-w-0">
          <p className="ragnar-intelligence-eyebrow">PRIORIZÁ TU ACOMPAÑAMIENTO</p>
          <p className="font-black text-white text-lg mt-1">
            {checkInReviewCount > 0
              ? checkInReviewCount + (checkInReviewCount===1
                  ? ' Check-in para revisar' : ' Check-ins para revisar')
              : 'Sin señales de bienestar pendientes de revisión'}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {recentCheckInCount} con Check-in en los últimos 7 días ·
            {rows.filter(row=>row.status==='contact'||row.status==='review').length}
            {' '}con rutinas para revisar.
          </p>
        </div>
        <button type="button" onClick={()=>setFilter(filter==='checkin'?'all':'checkin')}
          className="ragnar-intelligence-coach-action" aria-pressed={filter==='checkin'}>
          {filter==='checkin'?'VER TODOS':'VER CHECK-INS'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { id: 'onTrack', count: counts.onTrack },
          { id: 'review', count: counts.review },
          { id: 'contact', count: counts.contact },
          { id: 'noData', count: counts.noData }
        ].map(({ id, count }) => {
          const style = stateInfo[id], Icon = style.icon;
          return <button key={id} type="button" onClick={() => setFilter(id)}
            className={`rounded-2xl border text-left p-4 hover:border-yellow-400 transition-colors ${style.bg} ${style.border}`}>
            <Icon size={22} className={style.text} />
            <p className="text-white font-black text-3xl mt-2 tabular-nums">{count}</p>
            <p className={`text-xs font-bold mt-1 ${style.text}`}>{style.label}</p>
          </button>;
        })}
      </div>

      {counts.error > 0 && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        <AlertCircle size={18} className="shrink-0" />
        {counts.error} atleta(s) sin información por error de lectura. No se clasificaron como al día ni pendientes.
      </div>}

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 sm:min-w-[260px]">
            <Search size={18} className="text-zinc-500" />
            <input aria-label="Buscar alumno" className="min-w-0 flex-1 bg-transparent outline-none text-white text-sm"
              placeholder="Buscar alumno o plan..." value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          <p className="text-zinc-500 text-xs">
            Últimos 14 días · {refreshedAt ? 'Actualizado ' + refreshedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Consultando datos'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(item => <button type="button" key={item.id} onClick={() => setFilter(item.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold ${filter === item.id
              ? 'bg-yellow-400 border-yellow-400 text-black'
              : 'bg-black/50 border-zinc-700 text-zinc-300 hover:border-yellow-400'}`}>
            {item.label} ({item.count})
          </button>)}
        </div>
      </div>

      {loading && <p className="text-yellow-400 text-sm font-medium" role="status">
        Consultando las sesiones de {activeClients.length} atleta(s)... {rows.length} revisados.
      </p>}
      {!loading && activeClients.length === 0 && <div className="rounded-2xl border border-zinc-800 p-8 text-center text-zinc-400">
        <Users size={28} className="mx-auto mb-3" /> No hay atletas activos para seguir.
      </div>}
      {visible.length === 0 && rows.length > 0 && <p className="text-zinc-500 text-center py-6">No hay atletas que coincidan con este filtro.</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visible.map(row => {
          const style = stateInfo[row.status] || stateInfo.error;
          const Icon = style.icon, client = row.client || {};
          return <article key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-white text-lg truncate">{client.name || 'Atleta sin nombre'}</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {client.trainingMode === 'presencial' ? 'Presencial' : 'Plan'} · {String(client.plan?.name || client.plan || 'Sin plan')}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 ${style.bg} ${style.border} ${style.text}`}>
                <Icon size={15}/><span className="font-bold text-xs">{style.label}</span>
              </div>
            </div>
            <p className="text-sm text-zinc-300">{row.reason}</p>
            {row.checkIn && (
              <div className="ragnar-intelligence-coach-checkin">
                <div className="flex justify-between flex-wrap gap-2 items-center">
                  <strong className="text-xs uppercase">Último Check-in · {shortDate(row.checkIn.date)}</strong>
                  {row.needsWellnessReview && (
                    <span className="ragnar-intelligence-coach-signal">
                      {row.wellnessSignals.length} señal{row.wellnessSignals.length===1?'':'es'} para revisar
                    </span>
                  )}
                </div>
                <p className="text-xs mt-2">{row.checkInSummary}</p>
                {row.needsWellnessReview && (
                  <p className="text-xs mt-2 opacity-85">
                    {row.wellnessSignals.join(' · ')}. Conversar antes de interpretar o ajustar.
                  </p>
                )}
              </div>
            )}
            {row.progressSnapshot && row.progressSnapshot.scheduled>0 && (
              <p className="text-xs text-zinc-400">
                Últimos 28 días: <strong className="text-zinc-200">
                  {row.progressSnapshot.completed}/{row.progressSnapshot.scheduled}
                  {' '}sesiones registradas como finalizadas
                </strong>
                {row.progressSnapshot.completionRate!==null
                  ? ' · '+row.progressSnapshot.completionRate+'% de registros completos' : ''}
                {row.progressSnapshot.increased>0
                  ? ' · '+row.progressSnapshot.increased+' ejercicio(s) con carga mayor' : ''}
              </p>
            )}
            {row.status !== 'error' && <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-black/50 rounded-xl p-3">
                <p className="text-xl font-black text-white tabular-nums">{row.completed14}</p>
                <p className="text-[11px] text-zinc-500">Finalizadas</p>
              </div>
              <div className="bg-black/50 rounded-xl p-3">
                <p className="text-xl font-black text-white tabular-nums">{row.unfinishedPast14}</p>
                <p className="text-[11px] text-zinc-500">Pasadas sin cerrar</p>
              </div>
              <div className="bg-black/50 rounded-xl p-3">
                <p className="text-xl font-black text-white tabular-nums">{row.planned14}</p>
                <p className="text-[11px] text-zinc-500">Programadas</p>
              </div>
            </div>}
            {row.status !== 'error' && <div className="text-xs text-zinc-500 flex flex-col gap-1">
              <span>Última finalización en los últimos 28 días: <strong className="text-zinc-300">{shortDate(row.lastFinished)}</strong></span>
              {row.upcoming && <span>Próxima sesión programada: <strong className="text-zinc-300">{shortDate(row.upcoming)}</strong></span>}
            </div>}
            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <button type="button" onClick={() => navigateTo('client-detail', client)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black rounded-xl px-4 py-3">
                Ver ficha <ArrowRight size={15}/>
              </button>
              <button type="button" onClick={() => navigateTo('client-detail', client, { tab: 'mensajes' })}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold rounded-xl px-4 py-3">
                <MessageSquare size={15}/> Abrir chat
              </button>
            </div>
          </article>;
        })}
      </div>
      <p className="text-xs text-zinc-600">
        Coach Intelligence reutiliza las consultas actuales (28 días de historial y 7 de planificación).
        Los Check-ins son voluntarios y solo se muestran si fueron registrados en los últimos 7 días.
        Una sesión no finalizada puede deberse a falta de registro, no necesariamente a una ausencia.
        Los indicadores no modifican rutinas ni sustituyen el criterio del entrenador.
      </p>
    </div>
  );
}
