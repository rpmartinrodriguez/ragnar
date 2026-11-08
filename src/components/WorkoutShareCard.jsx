import React,{useState} from 'react';
import {CheckCircle2,Clock,Download,Dumbbell,Flame,Instagram,X} from 'lucide-react';

function completedSets(session){
  return (session?.exercises||[]).reduce((sum,ex)=>sum+
    (ex.actualSets||[]).filter(set=>set?.completed===true).length,0);
}
function roundPath(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function fitted(ctx,value,maximum,base=38){
  const text=String(value);let size=base;
  while(size>20){ctx.font='900 '+size+'px system-ui, sans-serif';
    if(ctx.measureText(text).width<=maximum)break;size-=2;}
  return size;
}
async function createImage({studentName,dateYmd,session,streak}) {
  const canvas=document.createElement('canvas');
  canvas.width=840;canvas.height=1020;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('El navegador no permite generar imágenes.');
  ctx.clearRect(0,0,840,1020);
  roundPath(ctx,26,26,788,968,55);
  ctx.fillStyle='#121217';ctx.fill();
  ctx.save();roundPath(ctx,26,26,788,968,55);ctx.clip();
  const gold=ctx.createLinearGradient(0,0,840,0);
  gold.addColorStop(0,'#facc15');gold.addColorStop(1,'#eab308');
  ctx.fillStyle=gold;ctx.fillRect(26,26,788,18);
  const glow=ctx.createRadialGradient(690,190,10,690,190,390);
  glow.addColorStop(0,'rgba(250,204,21,.16)');glow.addColorStop(1,'rgba(250,204,21,0)');
  ctx.fillStyle=glow;ctx.fillRect(26,26,788,480);

  try {
    const image=new Image();image.src='/logo.png';
    await new Promise((resolve,reject)=>{
      if(image.complete&&image.naturalWidth)return resolve();
      image.onload=resolve;image.onerror=reject;
    });
    const scale=Math.min(122/image.width,122/image.height);
    const w=image.width*scale,h=image.height*scale;
    ctx.drawImage(image,420-w/2,104-h/2,w,h);
  }catch{
    roundPath(ctx,366,52,108,108,26);ctx.fillStyle='#facc15';ctx.fill();
    ctx.font='italic 900 78px system-ui';ctx.fillStyle='#09090b';ctx.textAlign='center';ctx.fillText('R',420,130);
  }
  const centered=(text,y,color,size,maximum=670)=>{
    ctx.textAlign='center';ctx.fillStyle=color;
    ctx.font='900 '+fitted(ctx,text,maximum,size)+'px system-ui,sans-serif';
    ctx.fillText(text,420,y);
  };
  centered('RAGNAR TRAINING',212,'#facc15',26);
  centered('ENTRENAMIENTO FINALIZADO',271,'#d4d4d8',25);
  const d=new Date(dateYmd+'T12:00:00');
  const dateLabel=Number.isFinite(d.valueOf())
    ?d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()
    :String(dateYmd);
  centered(dateLabel,350,'#fff',55);
  ctx.strokeStyle='#39393e';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(94,391);ctx.lineTo(748,391);ctx.stroke();

  const duration=Number(session?.workoutDurationMinutes);
  const effort=Number(session?.perceivedEffort);
  const info=[
    {label:'MINUTOS REALES',value:duration>0&&Number.isFinite(duration)?Math.round(duration)+' MIN':'—'},
    {label:'ESFUERZO PERCIBIDO',value:effort>=1&&effort<=10?effort+'/10':'—'},
    {label:'EJERCICIOS',value:String((session?.exercises||[]).length)},
    {label:'SERIES REALIZADAS',value:String(completedSets(session))}
  ];
  info.forEach((item,i)=>{
    const x=94+(i%2)*338,y=435+Math.floor(i/2)*175;
    roundPath(ctx,x,y,316,149,20);ctx.fillStyle='#232329';ctx.fill();
    ctx.textAlign='left';ctx.fillStyle='#a1a1aa';ctx.font='700 18px system-ui';
    ctx.fillText(item.label,x+22,y+39);
    ctx.fillStyle='#facc15';ctx.font='900 49px system-ui';ctx.fillText(item.value,x+22,y+103);
  });
  centered(streak>1?'RACHA '+streak+' DIAS · UN DIA MAS FUERTE':'LA CONSTANCIA CONSTRUYE FUERZA',828,'#facc15',24);
  ctx.beginPath();ctx.moveTo(94,864);ctx.lineTo(748,864);ctx.stroke();
  centered(String(studentName||'ATLETA RAGNAR').trim().toUpperCase(),917,'#fff',38);
  centered('MI PROGRESO · MI COMPROMISO',960,'#a1a1aa',19);
  ctx.restore();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
    if(blob)resolve(new File([blob],'ragnar-entrenamiento-'+dateYmd+'.png',{type:'image/png'}));
    else reject(new Error('No se pudo generar la tarjeta PNG.'));
  },'image/png'));
}

export default function WorkoutShareCard({onClose,onOpenSalon,studentName,session,dateYmd,streak=1}){
  const [busy,setBusy]=useState('');
  const [info,setInfo]=useState('');
  const duration=Number(session?.workoutDurationMinutes);
  const effort=Number(session?.perceivedEffort);
  const share=async(mode)=>{
    setBusy(mode);setInfo('');
    try{
      const file=await createImage({studentName,dateYmd,session,streak});
      if(mode==='share' && navigator.canShare?.({files:[file]}) && navigator.share){
        try{await navigator.share({files:[file],title:'Mi entrenamiento Ragnar'});return;}
        catch(error){if(error?.name==='AbortError')return;}
      }
      const url=URL.createObjectURL(file);
      const a=document.createElement('a');a.href=url;a.download=file.name;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      setInfo('Imagen guardada. Abrí Instagram y añadila a Tu historia desde tus fotos o archivos.');
    }catch(error){setInfo(error?.message||'No se pudo generar la tarjeta.');}
    finally{setBusy('');}
  };
  return(
    <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl p-3 sm:p-6 overflow-y-auto overscroll-contain"
      style={{paddingTop:'max(12px,env(safe-area-inset-top))',paddingBottom:'max(12px,env(safe-area-inset-bottom))'}}>
      <div role="dialog" aria-modal="true" aria-label="Compartir rutina finalizada"
        className="max-w-md mx-auto my-3 sm:my-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-black uppercase">Tu tarjeta Ragnar</h2>
            <p className="text-zinc-400 text-xs mt-1">Compacta y lista para compartir en historias.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-3 text-zinc-300 border border-zinc-700 rounded-xl"><X size={20}/></button>
        </div>
        <div className="rounded-3xl border border-yellow-400/30 bg-zinc-900 p-5 space-y-4 shadow-xl max-w-[310px] mx-auto">
          <div className="text-center">
            <img src="/logo.png" alt="Logo oficial Ragnar" className="w-16 h-16 object-contain mx-auto"/>
            <p className="text-yellow-400 font-black tracking-widest text-xs mt-2">RAGNAR TRAINING</p>
            <p className="text-white text-lg font-black uppercase mt-2">Misión cumplida</p>
            <p className="text-zinc-500 text-xs mt-1">{dateYmd?.split('-').reverse().join('/')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {icon:Clock,label:'Tiempo real',value:duration>0?Math.round(duration)+' min':'Sin medir'},
              {icon:Flame,label:'Esfuerzo',value:effort>=1&&effort<=10?effort+'/10':'Sin medir'},
              {icon:Dumbbell,label:'Ejercicios',value:(session?.exercises||[]).length},
              {icon:CheckCircle2,label:'Series',value:completedSets(session)}
            ].map(metric=>{const Icon=metric.icon;return <div key={metric.label} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <Icon size={17} className="text-yellow-400"/>
              <p className="text-white text-lg font-black mt-2">{metric.value}</p>
              <p className="text-zinc-500 text-[11px]">{metric.label}</p>
            </div>;})}
          </div>
          <p className="text-white font-black text-center uppercase text-sm break-words">{studentName}</p>
          <p className="text-zinc-500 text-center text-[11px]">Mi progreso · Mi compromiso</p>
        </div>
        <p className="text-zinc-400 text-xs text-center">Se descarga como PNG con márgenes transparentes para usarla como tarjeta pequeña dentro de una historia.</p>
        {info&&<p role="status" className="text-amber-300 text-xs p-3 rounded-xl border border-amber-400/20">{info}</p>}
        <button type="button" onClick={()=>share('share')} disabled={!!busy}
          className="w-full py-4 rounded-xl bg-yellow-400 text-black font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
          <Instagram size={20}/>{busy?'Generando...':'Compartir tarjeta como imagen'}
        </button>
        <button type="button" onClick={()=>share('download')} disabled={!!busy}
          className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-200 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          <Download size={18}/> Guardar PNG
        </button>
        {onOpenSalon&&<button type="button" onClick={onOpenSalon}
          className="w-full py-3 rounded-xl text-zinc-400 hover:text-yellow-300 text-xs font-black uppercase">
          Ir al Salón Ragnar
        </button>}
      </div>
    </div>
  );
}
