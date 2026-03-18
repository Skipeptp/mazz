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

  const moodText = pet.isSleeping
    ? 'Лисёнок спит'
    : pet.happiness < 40
      ? 'Лисёнок грустит'
      : pet.hunger < 40
        ? 'Лисёнок голоден'
        : pet.energy < 30
          ? 'Лисёнок устал'
          : 'Лисёнок доволен';

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
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-white/90" />
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

          <div className="w-full flex flex-col items-center gap-4">
            {/* Комната‑карточка с интерьером */}
            <div className="w-full max-w-xs aspect-[4/3] bg-white/80 rounded-[32px] shadow-xl border border-white/70 relative overflow-hidden flex items-end justify-center">
              {/* Базовая заливка стены/пола */}
              <div className="absolute inset-0">
                <div className="absolute top-0 left-0 right-0 h-2/3 bg-gradient-to-b from-rose-50 via-amber-50/60 to-emerald-50/40" />
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-100 to-amber-200" />
              </div>

              {/* Интерьер под конкретную комнату */}
              <RoomInterior room={pet.currentRoom} />

              {/* Тень пола под лисёнком */}
              <div className="absolute inset-x-10 bottom-8 h-5 bg-black/10 blur-xl rounded-full" />

              {/* Лисёнок */}
              <motion.div
                animate={{
                  y: pet.isSleeping ? [0, 5, 0] : [0, -10, 0],
                  scale: pet.isSleeping ? 0.96 : 1,
                  rotate: pet.isSleeping ? 4 : 0
                }}
                transition={{
                  duration: pet.isSleeping ? 3 : 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative z-10"
              >
                <div className="w-40 h-40 sm:w-48 sm:h-48 relative">
                  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                    {/* Хвост */}
                    <path
                      d="M140 150 C 180 130 180 90 150 80 C 155 105 145 125 130 135 Z"
                      fill="#FB923C"
                    />
                    <path
                      d="M147 115 C 165 110 170 95 162 88"
                      fill="#FFEDD5"
                    />

                    {/* Тело */}
                    <ellipse cx="100" cy="135" rx="55" ry="35" fill="#F97316" />
                    <ellipse cx="100" cy="137" rx="42" ry="24" fill="#FB923C" />

                    {/* Лапы */}
                    <ellipse cx="80" cy="155" rx="10" ry="7" fill="#451A03" />
                    <ellipse cx="120" cy="155" rx="10" ry="7" fill="#451A03" />

                    {/* Уши */}
                    <path d="M60 70 L40 20 L90 55 Z" fill="#F97316" />
                    <path d="M140 70 L160 20 L110 55 Z" fill="#F97316" />
                    <path d="M60 70 L48 30 L80 55 Z" fill="#FED7AA" />
                    <path d="M140 70 L152 30 L120 55 Z" fill="#FED7AA" />

                    {/* Морда */}
                    <circle cx="100" cy="95" r="55" fill="#FB923C" />
                    <path
                      d="M60 105 C 75 125 125 125 140 105 C 130 115 120 120 100 120 C 80 120 70 115 60 105 Z"
                      fill="#FFEDD5"
                    />

                    {/* Щёчки */}
                    <circle cx="70" cy="112" r="7" fill="#FDBA74" />
                    <circle cx="130" cy="112" r="7" fill="#FDBA74" />

                    {/* Белки */}
                    <circle cx="75" cy="90" r="13" fill="white" />
                    <circle cx="125" cy="90" r="13" fill="white" />

                    {/* Глаза */}
                    <motion.circle 
                      cx="75" 
                      cy="90" 
                      r={pet.isSleeping ? 1 : 6} 
                      fill="#111827"
                      animate={pet.isSleeping ? {} : { scaleY: [1, 0.1, 1] }}
                      transition={pet.isSleeping ? {} : { duration: 4, repeat: Infinity, times: [0, 0.95, 1] }}
                    />
                    <motion.circle 
                      cx="125" 
                      cy="90" 
                      r={pet.isSleeping ? 1 : 6} 
                      fill="#111827"
                      animate={pet.isSleeping ? {} : { scaleY: [1, 0.1, 1] }}
                      transition={pet.isSleeping ? {} : { duration: 4, repeat: Infinity, times: [0, 0.95, 1] }}
                    />

                    {/* Нос */}
                    <path d="M92 110 L108 110 L100 122 Z" fill="#451A03" />

                    {/* Рот: грустный / радостный */}
                    <path 
                      d={
                        pet.happiness < 35
                          ? "M85 140 Q100 132 115 140"
                          : "M85 140 Q100 152 115 140"
                      }
                      stroke="#451A03"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Zzz при сне */}
                    {pet.isSleeping && (
                      <motion.text
                        x="145"
                        y="45"
                        fontSize="22"
                        fill="#F97316"
                        animate={{ opacity: [0, 1, 0], y: [45, 20, 10] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        Zzz
                      </motion.text>
                    )}
                  </svg>
                </div>
              </motion.div>
            </div>

            {/* Маленький статус под лисёнком */}
            <div className="inline-flex items-center gap-2 px-4 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-stone-100 shadow-sm">
              <Smile className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-medium text-stone-600">{moodText}</span>
            </div>
          </div>
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
              onClick={() => performAction(pet.isSleeping ? 'Разбудил' : 'Уложил спать', { isSleeping: !pet.isSleeping })}
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
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl border border-white/50 text-center">
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

function RoomInterior({ room }: { room: PetState['currentRoom'] }) {
  // Небольшие декоративные элементы, чтобы каждая комната ощущалась по-разному
  if (room === 'kitchen') {
    return (
      <>
        {/* Шкафчики */}
        <div className="absolute top-4 left-4 right-4 h-10 bg-amber-100 rounded-2xl border border-amber-200 flex gap-2 px-3 items-center">
          <div className="w-6 h-6 bg-amber-200 rounded-lg" />
          <div className="w-10 h-6 bg-amber-200 rounded-lg" />
          <div className="w-12 h-6 bg-amber-200 rounded-lg" />
        </div>
        {/* Стол */}
        <div className="absolute bottom-20 left-6 right-6 h-10 bg-amber-300 rounded-2xl shadow-lg">
          <div className="absolute inset-x-6 top-2 h-6 bg-amber-100 rounded-xl flex gap-3 items-center px-4">
            <div className="w-4 h-4 bg-red-300 rounded-full" />
            <div className="w-4 h-4 bg-green-300 rounded-full" />
            <div className="w-4 h-4 bg-sky-300 rounded-full" />
          </div>
        </div>
      </>
    );
  }

  if (room === 'bedroom') {
    return (
      <>
        {/* Окно */}
        <div className="absolute top-6 left-6 w-24 h-20 bg-sky-200 rounded-2xl border border-sky-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-400" />
          <div className="absolute inset-0 border-2 border-white/70 rounded-2xl" />
        </div>
        {/* Кровать */}
        <div className="absolute bottom-18 left-8 right-8 h-16 bg-indigo-300 rounded-3xl shadow-xl">
          <div className="absolute inset-x-3 top-2 h-7 bg-indigo-100 rounded-2xl" />
          <div className="absolute inset-x-10 bottom-0 h-4 bg-indigo-500 rounded-t-3xl" />
        </div>
      </>
    );
  }

  if (room === 'bathroom') {
    return (
      <>
        {/* Плитка на стене */}
        <div className="absolute top-0 left-0 right-0 h-2/3 bg-sky-100 grid grid-cols-6 grid-rows-3 opacity-70">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="border border-sky-200/60" />
          ))}
        </div>
        {/* Ванна */}
        <div className="absolute bottom-20 left-10 right-10 h-16 bg-sky-50 rounded-full border border-sky-200 shadow-inner">
          <div className="absolute inset-x-6 top-2 h-7 bg-sky-100 rounded-full" />
        </div>
        {/* Душ */}
        <div className="absolute top-6 right-12 w-2 h-18 bg-sky-300 rounded-full" />
      </>
    );
  }

  // playroom
  return (
    <>
      {/* Гирлянда */}
      <div className="absolute top-6 left-4 right-4 h-6 flex items-center justify-between">
        <div className="w-full h-[2px] bg-amber-300 rounded-full" />
        <div className="absolute inset-x-4 top-1 flex justify-between">
          <div className="w-3 h-4 bg-rose-300 rounded-b-full" />
          <div className="w-3 h-4 bg-emerald-300 rounded-b-full" />
          <div className="w-3 h-4 bg-sky-300 rounded-b-full" />
          <div className="w-3 h-4 bg-violet-300 rounded-b-full" />
        </div>
      </div>
      {/* Ковёр и игрушки */}
      <div className="absolute bottom-18 left-8 right-8 h-18 bg-gradient-to-r from-rose-200 via-amber-200 to-sky-200 rounded-[999px] shadow-inner" />
      <div className="absolute bottom-22 left-14 w-6 h-6 bg-emerald-400 rounded-2xl rotate-12" />
      <div className="absolute bottom-24 right-14 w-7 h-7 bg-violet-400 rounded-full" />
    </>
  );
}
