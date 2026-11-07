export const initialClients = [
  { id: 1, name: 'Carlos Gomez', plan: 'Hipertrofia', status: 'active', lastCheckin: 'Hoy', routine: [] },
  { id: 2, name: 'Ana Rodriguez', plan: 'Pérdida de Peso', status: 'active', lastCheckin: 'Ayer', routine: [
    { id: 101, name: 'Sentadilla Libre', sets: 4, reps: '10-12', weight: '40kg' },
    { id: 102, name: 'Peso Muerto Rumano', sets: 3, reps: '12', weight: '30kg' }
  ]},
  { id: 3, name: 'Miguel Angel', plan: 'Fuerza', status: 'pending', lastCheckin: 'Hace 3 días', routine: [] },
  { id: 4, name: 'Sofia Martinez', plan: 'Funcional', status: 'active', lastCheckin: 'Hoy', routine: [] },
];

export const exerciseLibrary = [
  'Press de Banca', 'Sentadilla', 'Peso Muerto', 'Dominadas', 'Flexiones', 
  'Press Militar', 'Zancadas', 'Hip Thrust', 'Curl de Bíceps', 'Extensión de Tríceps'
];