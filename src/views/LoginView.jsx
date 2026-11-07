import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(); 
    } catch (err) {
      setError('Credenciales incorrectas. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans text-zinc-100">
      
      {/* Decoración de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-96 bg-yellow-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          
          {/* AQUÍ CARGAMOS EL LOGO PRINCIPAL */}
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Ragnar Training Logo" 
              className="w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>

          <h1 className="text-4xl font-black text-white tracking-tighter italic">
            <span className="text-yellow-400">RAGNAR</span>
            <span className="text-white">-TRAINING</span>
          </h1>
          <p className="text-zinc-500 mt-2">Panel de Control para Entrenadores</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-white focus:border-yellow-400 focus:outline-none transition-colors"
                  placeholder="entrenador@gym.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="password" 
                  required
                  className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-white focus:border-yellow-400 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? 'Entrando...' : (
                <>Ingresar al Panel <ArrowRight size={18}/></>
              )}
            </button>

          </form>
        </div>
        
        <p className="text-center text-zinc-600 text-xs mt-8">
          © 2026 RAGNAR-TRAINING. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
