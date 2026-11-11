import React from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, Share2, TrendingUp } from 'lucide-react';

function dateLabel(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? value.split('-').reverse().join('/') : '';
}
export default function SessionCompletionCard({ feedback, loading = false, error = '', onProgress, onShare, onDone }) {
  return (
    <section className="ragnar-performance-finish-feedback" aria-label="Resultado y comparación del entrenamiento">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="ragnar-performance-finish-icon"><CheckCircle2 size={23}/></span>
          <div>
            <p className="ragnar-performance-finish-eyebrow">ENTRENAMIENTO GUARDADO</p>
            <h3 className="ragnar-performance-finish-title">BUEN TRABAJO.</h3>
            <p className="ragnar-performance-finish-muted text-xs mt-1">
              Cada serie queda registrada en tu historial de Progreso.
            </p>
          </div>
        </div>
      </div>
      {loading ? (
        <p className="ragnar-performance-finish-muted text-sm mt-3" role="status">
          Comparando con tus entrenamientos anteriores...
        </p>
      ) : feedback ? (
        <div className="mt-4 space-y-3">
          <div className="ragnar-performance-finish-comparison">
            <div className="ragnar-performance-finish-stat">
              <span>SERIES COMPLETADAS</span>
              <strong>{feedback.completedSets}</strong>
              <small>{feedback.previousDate
                ? 'Sesión anterior: ' + feedback.previousSets + ' · ' + dateLabel(feedback.previousDate)
                : 'Primer registro disponible'}</small>
            </div>
            <div className="ragnar-performance-finish-stat">
              <span>CARGAS COMPARABLES</span>
              <strong>{feedback.comparableCount}</strong>
              <small>{feedback.increasedCount > 0
                ? feedback.increasedCount + (feedback.increasedCount === 1
                  ? ' ejercicio con mayor carga' : ' ejercicios con mayor carga')
                : feedback.comparableCount > 0
                  ? 'Registros del mismo ejercicio'
                  : 'Todavía no hay marcas previas'}</small>
            </div>
          </div>
          {feedback.comparisons.length > 0 ? (
            <div className="ragnar-performance-finish-detail space-y-2">
              {feedback.comparisons.map(item => (
                <div key={item.name} className="flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-xs">{item.name}</p>
                    <p className="ragnar-performance-finish-muted text-[11px]">
                      Última vez ({dateLabel(item.previousDate)}): {item.fromLabel} · Hoy: {item.toLabel}
                    </p>
                  </div>
                  <span className={'ragnar-performance-delta ' +
                    (item.delta > 0 ? 'is-positive' : item.delta < 0 ? 'is-lower' : 'is-even')}>
                    {item.delta > 0 && <TrendingUp size={14}/>}
                    {item.delta === 0 ? 'Igual carga' : item.formattedDelta}
                  </span>
                </div>
              ))}
              <p className="ragnar-performance-finish-muted text-[11px]">
                La carga es solo una referencia: menos kilos no significa necesariamente menos progreso.
              </p>
            </div>
          ) : (
            <p className="ragnar-performance-finish-muted text-xs">
              {feedback.previousDate
                ? 'Aún no hay cargas comparables de estos ejercicios con sesiones anteriores.'
                : 'Es tu primera marca registrada. A partir de ahora podrás compararla con futuras sesiones.'}
            </p>
          )}
        </div>
      ) : (
        <p className="ragnar-performance-finish-muted text-sm mt-3">
          {error ? 'La sesión quedó guardada. No pudimos cargar la comparación en este momento.' :
            'Tu entrenamiento está guardado en el historial.'}
        </p>
      )}
      <div className="ragnar-performance-finish-actions mt-4">
        <button type="button" onClick={onDone} className="ragnar-performance-finish-progress">
          <CheckCircle2 size={17}/> LISTO · VOLVER AL INICIO
        </button>
        <button type="button" onClick={onShare} className="ragnar-performance-finish-share">
          <Share2 size={16}/> COMPARTIR
        </button>
      </div>
      <button type="button" onClick={onProgress}
        className="ragnar-performance-finish-progress-link">
        VER MI PROGRESO <ArrowUpRight size={15}/>
      </button>
    </section>
  );
}
