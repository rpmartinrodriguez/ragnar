import React,{useState} from 'react';
import { getAuth,signOut } from 'firebase/auth';
import { ShieldCheck, LockKeyhole, Eye, EyeOff, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

/**
 * Primer acceso con clave temporal.
 * La clave temporal ya fue verificada durante el login: no la pedimos otra vez,
 * ni la guardamos en localStorage o la enviamos junto con la nueva.
 */
export default function StudentFirstAccessModal({clientId,onCompleted}){
  const [newPassword,setNewPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [completed,setCompleted]=useState(false);
  const [changedButNotConfirmed,setChangedButNotConfirmed]=useState(false);
  const logout=async()=>{await signOut(getAuth());};

  const submit=async e=>{
    e.preventDefault();
    if(saving||completed)return;
    if(newPassword.length<10||newPassword.length>128){
      return setError('Elegí una contraseña de 10 a 128 caracteres.');
    }
    if(newPassword.trim()!==newPassword){
      return setError('No uses espacios al principio o al final de la clave.');
    }
    if(newPassword!==confirm){
      return setError('Las contraseñas nuevas no coinciden.');
    }
    setSaving(true);setError('');
    try{
      const user=getAuth().currentUser;
      if(!user)throw new Error('La sesión terminó. Volvé a ingresar con tu clave temporal.');
      const token=await user.getIdToken();
      const response=await fetch('/.netlify/functions/change-student-password',{
        method:'POST',cache:'no-store',
        headers:{'content-type':'application/json',authorization:'Bearer '+token},
        body:JSON.stringify({clientId,newPassword})
      });
      let data;
      try{data=await response.json();}
      catch{throw new Error('No se pudo contactar al servidor de cambio de contraseña.');}
      if(!response.ok||!data?.success){
        if(data?.passwordUpdated)setChangedButNotConfirmed(true);
        throw new Error(data?.error||'No fue posible guardar la nueva contraseña.');
      }
      setNewPassword('');setConfirm('');
      setCompleted(true);
    }catch(error){setError(error?.message||'No se pudo cambiar la contraseña.');}
    finally{setSaving(false);}
  };

  return(
    <div className="ragnar-first-access-modal fixed inset-0 z-[9000] bg-black/95 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain"
      style={{paddingTop:'max(12px, env(safe-area-inset-top))',paddingBottom:'max(12px, env(safe-area-inset-bottom))'}}>
      <div role="dialog" aria-modal="true" aria-labelledby="ragnar-first-login-title"
        className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain bg-zinc-950 border border-yellow-400/50 rounded-3xl shadow-2xl p-5 sm:p-7">
        {completed?(
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="text-emerald-400 mx-auto" size={55}/>
            <h2 id="ragnar-first-login-title" className="text-white text-2xl font-black uppercase">¡Contraseña actualizada!</h2>
            <p className="text-zinc-300 text-sm">Ya tenés tu contraseña personal. Tu clave temporal anterior dejó de servir. Conservala en un lugar seguro.</p>
            <button type="button" onClick={onCompleted} className="w-full rounded-xl bg-yellow-400 text-black font-black py-4">
              Entrar a Ragnar
            </button>
          </div>
        ):(
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-yellow-400/10 text-yellow-400 p-3 shrink-0"><ShieldCheck size={27}/></div>
              <div className="min-w-0">
                <h2 id="ragnar-first-login-title" className="text-white text-xl sm:text-2xl font-black uppercase leading-tight">
                  Protegé tu cuenta
                </h2>
                <p className="text-zinc-300 text-sm mt-2">Es tu primer ingreso o recibiste una clave temporal. Para continuar, elegí una contraseña que solo conozcas vos.</p>
              </div>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold mb-2">Clave temporal actual</label>
              <div className="rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-zinc-400 tracking-[0.25em]" aria-hidden="true">••••••••••••</span>
                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={15}/> Verificada
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-2">Ya comprobamos la clave con la que ingresaste. No necesitás escribirla de nuevo.</p>
            </div>
            <div>
              <label htmlFor="ragnar-new-login-password" className="block text-zinc-300 text-xs font-bold mb-2">
                Nueva contraseña (mínimo 10 caracteres)
              </label>
              <div className="relative">
                <input id="ragnar-new-login-password" type={show?'text':'password'}
                  autoComplete="new-password" required minLength={10} maxLength={128}
                  value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 p-3 pr-12 text-base text-white outline-none focus:border-yellow-400"
                  placeholder="Elegí tu nueva clave"/>
                <button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'Ocultar contraseña':'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400">
                  {show?<EyeOff size={20}/>:<Eye size={20}/>}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="ragnar-confirm-login-password" className="block text-zinc-300 text-xs font-bold mb-2">
                Repetí tu nueva contraseña
              </label>
              <input id="ragnar-confirm-login-password" type={show?'text':'password'}
                autoComplete="new-password" required minLength={10} maxLength={128}
                value={confirm} onChange={e=>setConfirm(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 p-3 text-base text-white outline-none focus:border-yellow-400"
                placeholder="Confirmar contraseña"/>
            </div>
            {error&&(
              <p role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-xs flex gap-2 items-start">
                <AlertCircle size={17} className="shrink-0"/>{error}
              </p>
            )}
            <button type="submit" disabled={saving||!newPassword||!confirm}
              className="w-full rounded-xl bg-yellow-400 text-black font-black py-4 flex justify-center items-center gap-2 disabled:opacity-50">
              <LockKeyhole size={18}/>{saving?'Guardando contraseña...':'Confirmar cambio de contraseña'}
            </button>
            <button type="button" onClick={logout}
              className="w-full text-zinc-400 text-xs font-bold py-2 flex gap-2 justify-center items-center">
              <LogOut size={16}/>{changedButNotConfirmed?'Volver a ingresar con mi contraseña nueva':'Salir y hacerlo después'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
