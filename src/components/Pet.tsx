import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, 
  Bed, 
  Bath, 
  Gamepad2, 
  Heart, 
  Zap, 
  Droplets, 
  Smile,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { db, doc, onSnapshot, updateDoc, auth, serverTimestamp } from '../firebase';
import { PetState } from '../types';

const ROOMS = [
  { id: 'kitchen', name: 'Кухня', icon: <Utensils />, bg: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80' },
  { id: 'bedroom', name: 'Спальня', icon: <Bed />, bg: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80' },
  { id: 'bathroom', name: 'Ванная', icon: <Bath />, bg: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=800&q=80' },
  { id: 'playroom', name: 'Игровая', icon: <Gamepad2 />, bg: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80' },
];

export default function Pet() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const petRef = doc(db, 'pet', 'frosh');
    const unsub = onSnapshot(petRef, (docSnap) => {
      if (docSnap.exists()) {
        setPet(docSnap.data() as PetState);
      } else {
        // Initialize pet if not exists
        const initialState: PetState = {
          hunger: 80,
          energy: 100,
          cleanliness: 100,
          happiness: 100,
          lastAction: 'Появился на свет',
          lastActionBy: 'Система',
          isSleeping: false,
          currentRoom: 'playroom',
          lastUpdate: serverTimestamp()
        };
        updateDoc(petRef, initialState as any).catch(() => {
          // If update fails (e.g. permission), it might be because it needs to be set
          import('../firebase').then(({ setDoc }) => setDoc(petRef, initialState));
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const performAction = async (action: string, updates: Partial<PetState>) => {
    if (!pet) return;
    const petRef = doc(db, 'pet', 'frosh');
    
    setActionFeedback(action);
    setTimeout(() => setActionFeedback(null), 2000);

    try {
      await updateDoc(petRef, {
        ...updates,
        lastAction: action,
        lastActionBy: auth.currentUser?.displayName || 'Кто-то',
        lastUpdate: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to update pet:", e);
    }
  };

  const changeRoom = (direction: 'left' | 'right') => {
    if (!pet) return;
    const currentIndex = ROOMS.findIndex(r => r.id === pet.currentRoom);
    let nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) nextIndex = ROOMS.length - 1;
    if (nextIndex >= ROOMS.length) nextIndex = 0;
    
    performAction(`Перешел в ${ROOMS[nextIndex].name}`, { currentRoom: ROOMS[nextIndex].id as any });
  };

  if (loading) return (
    <div className="h-[500px] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
    </div>
  );

  if (!pet) return null;

  const currentRoomData = ROOMS.find(r => r.id === pet.currentRoom) || ROOMS[0];

  return (
    <div className="max-w-md mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden border border-stone-100 relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={pet.currentRoom}
            src={currentRoomData.bg}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/80" />
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 p-6 flex flex-col h-[600px]">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          <StatItem icon={<Utensils className="w-4 h-4" />} value={pet.hunger} color="bg-orange-400" />
          <StatItem icon={<Zap className="w-4 h-4" />} value={pet.energy} color="bg-yellow-400" />
          <StatItem icon={<Droplets className="w-4 h-4" />} value={pet.cleanliness} color="bg-sky-400" />
          <StatItem icon={<Heart className="w-4 h-4" />} value={pet.happiness} color="bg-rose-400" />
        </div>

        {/* Room Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeRoom('left')} className="p-2 bg-white/50 backdrop-blur-sm rounded-full hover:bg-white/80 transition-all">
            <ChevronLeft className="w-6 h-6 text-stone-600" />
          </button>
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full shadow-sm border border-white/50">
            {currentRoomData.icon}
            <span className="font-bold text-xs uppercase tracking-widest text-stone-600">{currentRoomData.name}</span>
          </div>
          <button onClick={() => changeRoom('right')} className="p-2 bg-white/50 backdrop-blur-sm rounded-full hover:bg-white/80 transition-all">
            <ChevronRight className="w-6 h-6 text-stone-600" />
          </button>
        </div>

        {/* Pet Character Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <AnimatePresence>
            {actionFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: -40, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="absolute top-1/4 z-20 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-rose-100 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-bold text-rose-600">{actionFeedback}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={{
              y: pet.isSleeping ? [0, 5, 0] : [0, -10, 0],
              scale: pet.isSleeping ? 0.95 : 1,
              rotate: pet.isSleeping ? 5 : 0
            }}
            transition={{
              duration: pet.isSleeping ? 3 : 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            {/* The Pet (Stylized Fox/Cat hybrid) */}
            <div className="w-48 h-48 relative">
              <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                {/* Ears */}
                <path d="M60 60 L40 20 L90 50 Z" fill="#F97316" />
                <path d="M140 60 L160 20 L110 50 Z" fill="#F97316" />
                {/* Face */}
                <circle cx="100" cy="100" r="70" fill="#FB923C" />
                <circle cx="70" cy="90" r="15" fill="white" />
                <circle cx="130" cy="90" r="15" fill="white" />
                {/* Eyes */}
                <motion.circle 
                  cx="70" cy="90" r={pet.isSleeping ? 1 : 6} 
                  fill="#1E293B" 
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 4, repeat: Infinity, times: [0, 0.95, 1] }}
                />
                <motion.circle 
                  cx="130" cy="90" r={pet.isSleeping ? 1 : 6} 
                  fill="#1E293B"
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 4, repeat: Infinity, times: [0, 0.95, 1] }}
                />
                {/* Nose */}
                <path d="M90 110 L110 110 L100 125 Z" fill="#451A03" />
                {/* Mouth */}
                <path 
                  d={pet.hunger < 30 ? "M85 140 Q100 130 115 140" : "M85 140 Q100 155 115 140"} 
                  stroke="#451A03" 
                  strokeWidth="3" 
                  fill="none" 
                  strokeLinecap="round" 
                />
                {/* Sleep ZZZ */}
                {pet.isSleeping && (
                  <motion.text
                    x="150" y="50"
                    fontSize="24"
                    fill="#F97316"
                    animate={{ opacity: [0, 1, 0], y: [50, 20], x: [150, 170] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Zzz
                  </motion.text>
                )}
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {pet.currentRoom === 'kitchen' && (
            <ActionButton 
              onClick={() => performAction('Покормил', { hunger: Math.min(100, pet.hunger + 20), happiness: Math.min(100, pet.happiness + 5) })}
              icon={<Utensils />}
              label="Покормить"
              color="bg-orange-500"
              disabled={pet.isSleeping}
            />
          )}
          {pet.currentRoom === 'bedroom' && (
            <ActionButton 
              onClick={() => performAction(pet.isSleeping ? 'Разбудил' : 'Уложил спать', { isSleeping: !pet.isSleeping, energy: pet.isSleeping ? pet.energy : pet.energy })}
              icon={<Bed />}
              label={pet.isSleeping ? "Разбудить" : "Уложить спать"}
              color="bg-indigo-500"
            />
          )}
          {pet.currentRoom === 'bathroom' && (
            <ActionButton 
              onClick={() => performAction('Помыл', { cleanliness: 100, happiness: Math.min(100, pet.happiness + 10) })}
              icon={<Bath />}
              label="Помыть"
              color="bg-sky-500"
              disabled={pet.isSleeping}
            />
          )}
          {pet.currentRoom === 'playroom' && (
            <ActionButton 
              onClick={() => performAction('Поиграл', { happiness: 100, energy: Math.max(0, pet.energy - 15) })}
              icon={<Gamepad2 />}
              label="Поиграть"
              color="bg-rose-500"
              disabled={pet.isSleeping}
            />
          )}
        </div>

        {/* Footer Info */}
        <div className="bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white/50 text-center">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">Последнее действие</p>
          <p className="text-xs text-stone-600 font-medium">
            <span className="text-rose-500 font-bold">{pet.lastActionBy}</span>: {pet.lastAction}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, value, color }: { icon: React.ReactNode, value: number, color: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-white/50 flex flex-col items-center gap-1">
      <div className={`${color} p-1.5 rounded-lg text-white`}>
        {icon}
      </div>
      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, color, disabled }: { onClick: () => void, icon: React.ReactNode, label: string, color: string, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-3 p-4 rounded-3xl text-white font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale ${color}`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
