import React from 'react';
import { Check, MonitorSmartphone, Moon, Sun } from 'lucide-react';
import { useAppearance } from '../context/AppearanceContext';

const options = [
  { value:'system', title:'Automático', description:'Sigue la apariencia del celular o computadora', Icon:MonitorSmartphone },
  { value:'dark', title:'Oscuro', description:'Entrenamiento de alto contraste', Icon:Moon },
  { value:'light', title:'Claro', description:'Superficies claras y detalles definidos', Icon:Sun }
];

export default function AppearanceSelector({ compact = false }) {
  const { mode, resolved, setMode } = useAppearance();
  return (
    <section className="ragnar-appearance-panel" aria-label="Apariencia de RAGNAR">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="ragnar-appearance-title">APARIENCIA</h3>
          <p className="ragnar-appearance-subtitle">
            Elegí cómo querés ver RAGNAR en este dispositivo.
          </p>
        </div>
        <span className="ragnar-appearance-current">
          <span className="ragnar-appearance-current-dot"/>
          {mode === 'system' ? 'AUTO · ' + (resolved === 'dark' ? 'OSCURO' : 'CLARO') : resolved === 'dark' ? 'OSCURO' : 'CLARO'}
        </span>
      </div>
      <div className="ragnar-appearance-options" role="group" aria-label="Elegir apariencia">
        {options.map(({ value, title, description, Icon }) => {
          const selected = mode === value;
          return (
            <button key={value} type="button"
              aria-pressed={selected}
              onClick={() => setMode(value)}
              className={'ragnar-appearance-option ' + (selected ? 'is-selected' : '')}>
              <span className="ragnar-appearance-option-icon">
                <Icon size={compact ? 19 : 21} aria-hidden="true"/>
              </span>
              <span className="ragnar-appearance-option-text">
                <strong>{title}</strong>
                {!compact && <small>{description}</small>}
              </span>
              {selected && <Check className="ragnar-appearance-option-check" size={16} aria-hidden="true"/>}
            </button>
          );
        })}
      </div>
      <p className="ragnar-appearance-footnote">
        {mode === 'system'
          ? 'Automático está activo. Si el celular cambia de tema, RAGNAR cambia con él.'
          : 'El ajuste se guarda únicamente en este dispositivo. Podés cambiarlo cuando quieras.'}
      </p>
    </section>
  );
}
