import React, { useState, useEffect } from 'react';
import { 
  Flame, HandMetal, Clock, ShieldCheck 
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

export default function CommunityView({ currentUserId, userName }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchamos los últimos 50 eventos del Gran Salón
    const q = query(
      collection(db, 'communityFeed'), 
      orderBy('createdAt', 'desc'), 
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReaction = async (postId, reactionType, hasReacted) => {
    const postRef = doc(db, 'communityFeed', postId);
    const reactionKey = `reactions.${reactionType}`;
    
    try {
      if (hasReacted) {
        await updateDoc(postRef, {
          [reactionKey]: arrayRemove(currentUserId)
        });
      } else {
        await updateDoc(postRef, {
          [reactionKey]: arrayUnion(currentUserId)
        });
      }
    } catch (e) { console.error("Error en reacción:", e); }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in pb-20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center justify-center gap-3">
          <ShieldCheck className="text-yellow-400" size={32}/> El Gran Salón
        </h2>
        <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-bold">La hermandad del esfuerzo</p>
      </div>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/30 rounded-[2rem] border border-dashed border-zinc-800">
            <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
              El salón está en silencio... <br/> ¡Sé el primero en forjar tu camino!
            </p>
          </div>
        ) : (
          posts.map(post => {
            const fireReacts = post.reactions?.fire || [];
            const powerReacts = post.reactions?.power || [];
            const hasFire = fireReacts.includes(currentUserId);
            const hasPower = powerReacts.includes(currentUserId);

            return (
              <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-5 flex gap-4">
                  {/* Avatar con inicial */}
                  <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg shrink-0">
                    {post.userName?.charAt(0)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-white uppercase tracking-tight">{post.userName}</h4>
                      <span className="text-[10px] text-zinc-600 font-bold flex items-center gap-1">
                        <Clock size={12}/> {post.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>

                    <div className="mt-2 text-zinc-300 text-sm leading-relaxed">
                      {post.type === 'workout_completed' ? (
                        <p>Ha completado su entrenamiento de <span className="text-yellow-400 font-bold uppercase">{post.workoutName}</span>. ¡Un paso más cerca de la cima!</p>
                      ) : (
                        <p>¡Increíble! Ha superado un <span className="text-green-400 font-bold uppercase">Récord Personal</span> hoy. ¡La fuerza es intensa!</p>
                      )}
                    </div>

                    {/* Botones de Reacción */}
                    <div className="mt-5 flex gap-3">
                      <button 
                        onClick={() => handleReaction(post.id, 'fire', hasFire)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${hasFire ? 'bg-orange-500/20 border-orange-500 text-orange-500' : 'bg-black/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                      >
                        <Flame size={18} className={hasFire ? 'fill-orange-500' : ''}/>
                        <span className="font-black text-xs">{fireReacts.length}</span>
                      </button>

                      <button 
                        onClick={() => handleReaction(post.id, 'power', hasPower)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${hasPower ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-black/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                      >
                        <HandMetal size={18} className={hasPower ? 'fill-blue-500' : ''}/>
                        <span className="font-black text-xs">{powerReacts.length}</span>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Decoración Vikinga Inferior */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent"></div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
