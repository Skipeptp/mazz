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
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { 
  db, 
  doc, 
  onSnapshot, 
  updateDoc, 
  auth, 
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { PetState } from '../types';

const ROOMS = [
  { id: 'kitchen', name: 'Кухня', icon: <Utensils />, bg: 'https://images.unsplash.com/photo-1585007600263-ad1f347368d1?auto=format&fit=crop&w=800&q=80' },
  { id: 'bedroom', name: 'Спальня', icon: <Bed />, bg: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80' },
  { id: 'bathroom', name: 'Ванная', icon: <Bath />, bg: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
  { id: 'playroom', name: 'Игровая', icon: <Gamepad2 />, bg: 'https://images.unsplash.com/photo-1550005816-09246d37735c?auto=format&fit=crop&w=800&q=80' },
];

interface PetQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  createdByEmail: string;
  createdByName: string;
  targetEmail: string;
  status: 'pending' | 'answered';
  isCorrect?: boolean;
}

type AnswerStatus = 'idle' | 'correct' | 'wrong';
type GameStatus = 'idle' | 'success' | 'fail';

export default function Pet() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Вопросы на еду
  const [myQuestion, setMyQuestion] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);

  const [incomingQuestion, setIncomingQuestion] = useState<PetQuestion | null>(null);
  const [incomingAnswer, setIncomingAnswer] = useState('');
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle');
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null);

  const [answeredQuestionsHistory, setAnsweredQuestionsHistory] = useState<PetQuestion[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

  // Мини‑игра
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [sequence, setSequence] = useState<number[]>([]);
  const [showSequence, setShowSequence] = useState(false);
  const [gameInput, setGameInput] = useState('');
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');

  const [isWashing, setIsWashing] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isSendingLove, setIsSendingLove] = useState(false);
  const [showBodyHearts, setShowBodyHearts] = useState(false);

  useEffect(() => {
    const petRef = doc(db, 'pet', 'frosh');
    const unsub = onSnapshot(petRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as PetState;
        
        // Логика убывания показателей (decay)
        if (data.lastUpdate) {
          try {
            const lastUpdateDate = data.lastUpdate.toDate ? data.lastUpdate.toDate() : new Date(data.lastUpdate);
            const now = new Date();
            const diffMs = now.getTime() - lastUpdateDate.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));

            if (diffMinutes > 0) {
              const hungerDecay = Math.floor(diffMinutes / 3);
              const cleanlinessDecay = Math.floor(diffMinutes / 15);
              const happinessDecay = Math.floor(diffMinutes / 6);
              
              let energyChange = 0;
              if (data.isSleeping) {
                energyChange = Math.floor(diffMinutes / 6) * 10;
              } else {
                energyChange = -Math.floor(diffMinutes / 7);
              }

              if (hungerDecay > 0 || cleanlinessDecay > 0 || happinessDecay > 0 || energyChange !== 0) {
                const newHunger = Math.max(0, data.hunger - hungerDecay);
                const newCleanliness = Math.max(0, data.cleanliness - cleanlinessDecay);
                const newHappiness = Math.max(0, data.happiness - happinessDecay);
                const newEnergy = Math.min(100, Math.max(0, data.energy + energyChange));
                
                // Обновляем только если значения изменились
                if (
                  newHunger !== data.hunger || 
                  newCleanliness !== data.cleanliness || 
                  newHappiness !== data.happiness || 
                  newEnergy !== data.energy
                ) {
                  updateDoc(petRef, {
                    hunger: newHunger,
                    cleanliness: newCleanliness,
                    happiness: newHappiness,
                    energy: newEnergy,
                    lastUpdate: serverTimestamp()
                  });
                  return;
                }
              }
            }
          } catch (e) {
            console.error("Error calculating decay:", e);
          }
        }
        setPet(data);
      } else {
        const initialState: PetState = {
          hunger: 80,
          energy: 100,
          cleanliness: 100,
          happiness: 100,
          foodCount: 5,
          name: 'Фрош',
          lastAction: 'Появился на свет',
          lastActionBy: 'Система',
          isSleeping: false,
          currentRoom: 'playroom',
          lastUpdate: serverTimestamp(),
          lastCleanupDate: new Date().toISOString().split('T')[0]
        };
        updateDoc(petRef, initialState as any).catch(() => {
          import('../firebase').then(({ setDoc }) => setDoc(petRef, initialState));
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Pet snapshot error:", error);
      handleFirestoreError(error, OperationType.GET, 'pet/frosh');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Обновление текущей даты каждую минуту для срабатывания очистки в полночь
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toISOString().split('T')[0];
      if (now !== currentDate) {
        setCurrentDate(now);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [currentDate]);

  // Логика ежедневной очистки истории
  useEffect(() => {
    if (!pet || !auth.currentUser) return;

    if (pet.lastCleanupDate === currentDate) return;

    const cleanupHistory = async () => {
      try {
        const q = query(
          collection(db, 'petQuestions'),
          where('status', '==', 'answered')
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          const petRef = doc(db, 'pet', 'frosh');
          await updateDoc(petRef, { lastCleanupDate: currentDate });
          return;
        }

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        
        const petRef = doc(db, 'pet', 'frosh');
        batch.update(petRef, { lastCleanupDate: currentDate });
        
        await batch.commit();
        console.log("Midnight history cleanup completed");
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    };

    cleanupHistory();
  }, [pet?.lastCleanupDate, currentDate, pet === null]);

  // Подписка на входящие вопросы для текущего пользователя
  useEffect(() => {
    if (!auth.currentUser?.email) return;
    const email = auth.currentUser.email.toLowerCase();

    const q = query(
      collection(db, 'petQuestions'),
      where('targetEmail', '==', email),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setIncomingQuestion(null);
        setAnswerStatus('idle');
        setIncomingAnswer('');
        return;
      }
      const d = snap.docs[0];
      setIncomingQuestion({ id: d.id, ...(d.data() as any) } as PetQuestion);
      setAnswerStatus('idle');
      setIncomingAnswer('');
    }, (error) => {
      console.error("Questions snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'petQuestions');
    });

    return () => unsub();
  }, []);

  // Подписка на историю ответов (все отвеченные вопросы)
  useEffect(() => {
    if (!auth.currentUser?.email) return;

    const q = query(
      collection(db, 'petQuestions'),
      orderBy('answeredAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PetQuestion));
      setAnsweredQuestionsHistory(docs);
    }, (error) => {
      console.error("Questions history snapshot error:", error);
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

  const handleWash = async () => {
    if (!pet || pet.isSleeping || isWashing) return;
    
    setIsWashing(true);
    setActionFeedback('Принимаем ванну... 🛁');
    
    // Динамическое обновление сообщения
    const messages = [
      'Намыливаем шёрстку... 🧼',
      'Много пузырьков! 🫧',
      'Смываем пенку... 🚿',
      'Почти готово! ✨'
    ];
    
    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < messages.length) {
        setActionFeedback(messages[msgIndex]);
        msgIndex++;
      }
    }, 1200);

    setTimeout(async () => {
      clearInterval(interval);
      await performAction('Помылся и стал чистым ✨', { 
        cleanliness: 100, 
        happiness: Math.min(100, pet.happiness + 15) 
      });
      setIsWashing(false);
      setActionFeedback('Теперь я чистый и пушистый! ✨');
      setTimeout(() => setActionFeedback(null), 3000);
    }, 5000);
  };

  const handleFeed = async () => {
    if (!pet || pet.isSleeping || isFeeding || pet.foodCount <= 0) return;
    
    setIsFeeding(true);
    setActionFeedback('Кушаем рыбку... 🐟');
    
    setTimeout(async () => {
      await performAction('Покушал рыбку 🐟', { 
        hunger: Math.min(100, pet.hunger + 25),
        foodCount: pet.foodCount - 1,
        happiness: Math.min(100, pet.happiness + 10)
      });
      setIsFeeding(false);
      setActionFeedback('Вкусно! 😋');
      setTimeout(() => setActionFeedback(null), 2000);
    }, 3000);
  };

  const handleSendLove = async () => {
    if (!pet || pet.isSleeping || isSendingLove) return;
    
    setIsSendingLove(true);
    setActionFeedback('Отправляем любовь... ❤️');
    
    // Sequence:
    // 1. Heart flies to fox (handled in SVG)
    // 2. Fox "kisses" it (handled in SVG)
    // 3. Body hearts appear
    
    setTimeout(() => {
      setShowBodyHearts(true);
      setActionFeedback('Лисёнок счастлив! 🥰');
    }, 1500);

    setTimeout(async () => {
      await performAction('Отправил любовь партнёру ❤️', { 
        happiness: Math.min(100, pet.happiness + 15) 
      });
      setIsSendingLove(false);
      setShowBodyHearts(false);
      setTimeout(() => setActionFeedback(null), 2000);
    }, 4500);
  };

  const changeRoom = (direction: 'left' | 'right') => {
    if (!pet) return;
    const currentIndex = ROOMS.findIndex(r => r.id === pet.currentRoom);
    let nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) nextIndex = ROOMS.length - 1;
    if (nextIndex >= ROOMS.length) nextIndex = 0;
    
    performAction(`Перешел в ${ROOMS[nextIndex].name}`, { currentRoom: ROOMS[nextIndex].id as any });
  };

  const updateName = async () => {
    if (!pet || !nameInput.trim()) return;
    await performAction(`Переименовал лисёнка в ${nameInput.trim()}`, { name: nameInput.trim() });
    setIsEditingName(false);
  };

  const getPartnerEmail = () => {
    const email = auth.currentUser?.email?.toLowerCase();
    if (!email) return null;
    const WHITELIST = ['glebkarpuhin8@gmail.com', 'arhipovaaliena78@gmail.com'];
    if (!WHITELIST.includes(email)) return null;
    return email === WHITELIST[0] ? WHITELIST[1] : WHITELIST[0];
  };

  const sendQuestion = async () => {
    if (!auth.currentUser?.email) return;
    if (!myQuestion.trim() || !myAnswer.trim()) return;
    const target = getPartnerEmail();
    if (!target) return;

    setIsSendingQuestion(true);
    try {
      await addDoc(collection(db, 'petQuestions'), {
        question: myQuestion.trim(),
        correctAnswer: myAnswer.trim(),
        createdByEmail: auth.currentUser.email.toLowerCase(),
        createdByName: auth.currentUser.displayName || 'Кто-то',
        targetEmail: target,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setMyQuestion('');
      setMyAnswer('');
      setActionFeedback('Вопрос отправлен партнёру');
    } catch (e) {
      console.error('Failed to send question:', e);
    } finally {
      setIsSendingQuestion(false);
    }
  };

  const submitAnswer = async () => {
    if (!incomingQuestion || !auth.currentUser || !pet) return;
    if (!incomingAnswer.trim()) return;

    const normalizedCorrect = incomingQuestion.correctAnswer.trim().toLowerCase();
    const normalizedGiven = incomingAnswer.trim().toLowerCase();
    const isCorrect = normalizedCorrect.length > 0 && normalizedCorrect === normalizedGiven;
    const correctAnswer = incomingQuestion.correctAnswer;

    try {
      const qRef = doc(db, 'petQuestions', incomingQuestion.id);
      await updateDoc(qRef, {
        status: 'answered',
        isCorrect,
        answerGiven: incomingAnswer.trim(),
        answeredByEmail: auth.currentUser.email?.toLowerCase() || '',
        answeredByName: auth.currentUser.displayName || 'Кто-то',
        answeredAt: serverTimestamp()
      });

      if (isCorrect) {
        setAnswerStatus('correct');
        setLastCorrectAnswer(null);
        await performAction('Правильный ответ на вопрос (Получена еда)', {
          foodCount: (pet.foodCount || 0) + 1,
          happiness: Math.min(100, pet.happiness + 2)
        });
      } else {
        setAnswerStatus('wrong');
        setLastCorrectAnswer(correctAnswer);
        await performAction('Ответил на вопрос', {});
      }
      setIncomingAnswer('');
    } catch (e) {
      console.error('Failed to answer question:', e);
    }
  };

  const startGame = () => {
    if (!pet || pet.isSleeping) return;
    const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 9) + 1);
    setSequence(seq);
    setShowSequence(true);
    setGameInput('');
    setGameStatus('idle');
    setIsGameOpen(true);
  };

  useEffect(() => {
    if (!isGameOpen || sequence.length === 0) return;
    setShowSequence(true);
    const t = setTimeout(() => setShowSequence(false), 4000);
    return () => clearTimeout(t);
  }, [isGameOpen, sequence]);

  const submitGame = async () => {
    if (!pet || sequence.length === 0 || !gameInput.trim()) return;

    let inputNumbers: number[] = [];
    const parts = gameInput.trim().split(/\s+/);
    if (parts.length === 1 && parts[0].length === sequence.length) {
      inputNumbers = parts[0].split('').map(n => Number(n));
    } else {
      inputNumbers = parts.map(n => Number(n));
    }

    const ok =
      inputNumbers.length === sequence.length &&
      inputNumbers.every((n, i) => n === sequence[i]);

    if (ok) {
      setGameStatus('success');
      const points = 50;
      await performAction('Выиграл мини-игру на память', {
        happiness: Math.min(100, pet.happiness + points),
        energy: Math.max(0, pet.energy - 10)
      });
    } else {
      setGameStatus('fail');
      await performAction('Проиграл мини-игру на память', {
        happiness: Math.max(0, pet.happiness - 5),
        energy: Math.max(0, pet.energy - 5)
      });
    }

    setTimeout(() => {
      setIsGameOpen(false);
      setSequence([]);
      setGameInput('');
      setGameStatus('idle');
      setShowSequence(false);
    }, 1500);
  };

  if (loading) return (
    <div className="h-[500px] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
    </div>
  );

  if (!pet) return null;

  const currentRoomData = ROOMS.find(r => r.id === pet.currentRoom) || ROOMS[0];

  const moodText = pet.isSleeping
    ? `${pet.name} спит`
    : pet.happiness < 40
      ? `${pet.name} грустит`
      : pet.hunger < 40
        ? `${pet.name} голоден`
        : pet.energy < 30
          ? `${pet.name} устал`
          : `${pet.name} доволен`;

  return (
    <>
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
        <div className="relative z-10 p-6 flex flex-col min-h-[850px]">
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
              {/* Name Editing */}
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="px-3 py-1 text-sm rounded-lg bg-white/80 border border-stone-100 outline-none focus:ring-2 focus:ring-rose-200"
                      autoFocus
                    />
                    <button onClick={updateName} className="p-1 bg-emerald-500 text-white rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-1 bg-stone-200 text-stone-500 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => { setNameInput(pet.name); setIsEditingName(true); }}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <h2 className="font-serif text-2xl text-stone-800 drop-shadow-sm">{pet.name}</h2>
                    <Sparkles className="w-4 h-4 text-stone-300 group-hover:text-rose-400 transition-colors" />
                  </div>
                )}
              </div>

              {/* Комната‑карточка с интерьером и лисёнком */}
              <div className="w-full max-w-xs aspect-[4/3] bg-white/80 rounded-[32px] shadow-xl border border-white/70 relative overflow-hidden flex items-end justify-center">
                {/* Базовая заливка стены/пола */}
                <div className="absolute inset-0">
                  <div className="absolute top-0 left-0 right-0 h-2/3 bg-gradient-to-b from-rose-50 via-amber-50/60 to-emerald-50/40" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-100 to-amber-200" />
                </div>

                {/* Интерьер под конкретную комнату */}
                <RoomInterior room={pet.currentRoom} />

                {/* Анимация пузырьков при мытье */}
                <AnimatePresence>
                  {isWashing && <Bubbles />}
                </AnimatePresence>

                {/* Тень под лисом */}
                <div className="absolute inset-x-10 bottom-8 h-5 bg-black/10 blur-xl rounded-full" />

                {/* Лисёнок */}
                <motion.div
                  animate={{
                    y: showBodyHearts 
                      ? [0, -40, 0, -40, 0] 
                      : pet.isSleeping ? [0, 5, 0] : isWashing ? [0, -4, 0] : [0, -10, 0],
                    scale: showBodyHearts ? [1, 1.1, 1, 1.1, 1] : pet.isSleeping ? 0.96 : isWashing ? 1.05 : 1,
                    rotate: showBodyHearts ? [0, 5, -5, 5, 0] : pet.isSleeping ? 4 : isWashing ? [0, -2, 2, 0] : 0
                  }}
                  transition={{
                    duration: showBodyHearts ? 1.5 : pet.isSleeping ? 3 : isWashing ? 0.3 : 2,
                    repeat: showBodyHearts ? 0 : Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative z-10"
                >
                  <div className="w-40 h-40 sm:w-48 sm:h-48 relative">
                    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                      <defs>
                        <linearGradient id="foxFur" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FB923C" />
                          <stop offset="100%" stopColor="#F97316" />
                        </linearGradient>
                        <radialGradient id="foxFace" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#FDBA74" />
                          <stop offset="100%" stopColor="#FB923C" />
                        </radialGradient>
                        <linearGradient id="foxBelly" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#FFF1F2" />
                        </linearGradient>
                        <radialGradient id="foxEyeIris" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#1E1B4B" />
                        </radialGradient>
                      </defs>

                      {/* Хвост - очень пушистый */}
                      <motion.g
                        animate={{ 
                          rotate: pet.isSleeping ? [0, 8, 0] : [0, 20, -10, 20, 0],
                          x: pet.isSleeping ? [0, 2, 0] : [0, 8, -4, 8, 0]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        style={{ originX: "110px", originY: "145px" }}
                      >
                        <path
                          d="M110 145 C 170 155 190 80 155 50 C 130 30 100 70 110 115"
                          fill="url(#foxFur)"
                          stroke="#EA580C"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M155 50 C 175 65 180 90 160 100 C 145 90 135 75 155 50"
                          fill="white"
                        />
                      </motion.g>

                      {/* Тело - маленькое и круглое */}
                      <motion.g
                        animate={{ scale: pet.isSleeping ? [1, 1.03, 1] : [1, 1.02, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <ellipse cx="80" cy="155" rx="48" ry="40" fill="url(#foxFur)" stroke="#EA580C" strokeWidth="1.5" />
                        <path d="M55 145 Q80 175 105 145 Q80 160 55 145" fill="url(#foxBelly)" />
                        
                        {/* Сердечки на теле */}
                        {showBodyHearts && (
                          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Heart x="55" y="145" className="w-4 h-4 text-white/60 fill-white/60" />
                            <Heart x="90" y="155" className="w-3 h-3 text-white/40 fill-white/40" />
                            <Heart x="70" y="165" className="w-2 h-2 text-white/50 fill-white/50" />
                          </motion.g>
                        )}
                      </motion.g>

                      {/* Ошейник с сердечком */}
                      <path d="M50 142 Q80 155 110 142" stroke="#FDA4AF" strokeWidth="4" fill="none" strokeLinecap="round" />
                      <motion.path 
                        d="M80 152 L84 156 L80 160 L76 156 Z" 
                        fill="#FB7185" 
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ originX: "80px", originY: "152px" }}
                      />

                      {/* Уши - большие и мягкие */}
                      <motion.g
                        animate={{ rotate: pet.isSleeping ? 0 : [0, 5, 0, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                        style={{ originX: "45px", originY: "70px" }}
                      >
                        <path d="M45 70 L5 15 L70 55 Z" fill="#F97316" stroke="#EA580C" strokeWidth="1.5" />
                        <path d="M45 70 L15 30 L60 55 Z" fill="#FFE4E6" />
                      </motion.g>
                      <motion.g
                        animate={{ rotate: pet.isSleeping ? 0 : [0, -5, 0, 5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
                        style={{ originX: "115px", originY: "70px" }}
                      >
                        <path d="M115 70 L155 15 L90 55 Z" fill="#F97316" stroke="#EA580C" strokeWidth="1.5" />
                        <path d="M115 70 L145 30 L100 55 Z" fill="#FFE4E6" />
                      </motion.g>

                      {/* Голова - большая и круглая (Chibi style) */}
                      <path 
                        d="M25 105 Q15 80 40 65 Q80 45 120 65 Q145 80 135 105 Q145 125 125 145 Q80 165 35 145 Q15 125 25 105" 
                        fill="url(#foxFace)" 
                        stroke="#EA580C" 
                        strokeWidth="1.5" 
                      />
                      
                      {/* Белая мордочка */}
                      <path
                        d="M45 125 C 55 150 105 150 115 125 C 105 140 90 145 80 145 C 70 145 55 140 45 125 Z"
                        fill="white"
                      />

                      {/* Щёчки - яркий румянец */}
                      <motion.circle 
                        cx="40" cy="130" r="10" fill="#FDA4AF" 
                        animate={{ opacity: pet.happiness > 50 ? [0.4, 0.8, 0.4] : 0.2 }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <motion.circle 
                        cx="120" cy="130" r="10" fill="#FDA4AF" 
                        animate={{ opacity: pet.happiness > 50 ? [0.4, 0.8, 0.4] : 0.2 }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />

                      {/* Глаза - ОГРОМНЫЕ И МИЛЫЕ */}
                      <g>
                        <circle cx="52" cy="105" r="18" fill="white" />
                        {showBodyHearts ? (
                          <motion.path 
                            d="M 52 116 C 44 116, 40 108, 40 102 C 40 94, 48 94, 52 100 C 56 94, 64 94, 64 102 C 64 108, 60 116, 52 116" 
                            fill="#FB7185"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            style={{ originX: "50%", originY: "50%" }}
                          />
                        ) : (
                          <>
                            <motion.circle 
                              cx="52" 
                              cy="105" 
                              r={pet.isSleeping ? 1 : 11} 
                              fill="url(#foxEyeIris)"
                              animate={pet.isSleeping ? {} : { scaleY: [1, 0.1, 1] }}
                              transition={pet.isSleeping ? {} : { duration: 5, repeat: Infinity, times: [0, 0.96, 1] }}
                            />
                            {!pet.isSleeping && (
                              <>
                                <circle cx="48" cy="100" r="5" fill="white" opacity="0.9" />
                                <circle cx="58" cy="110" r="2.5" fill="white" opacity="0.6" />
                              </>
                            )}
                          </>
                        )}
                      </g>
                      <g>
                        <circle cx="108" cy="105" r="18" fill="white" />
                        {showBodyHearts ? (
                          <motion.path 
                            d="M 108 116 C 100 116, 96 108, 96 102 C 96 94, 104 94, 108 100 C 112 94, 120 94, 120 102 C 120 108, 116 116, 108 116" 
                            fill="#FB7185"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            style={{ originX: "50%", originY: "50%" }}
                          />
                        ) : (
                          <>
                            <motion.circle 
                              cx="108" 
                              cy="105" 
                              r={pet.isSleeping ? 1 : 11} 
                              fill="url(#foxEyeIris)"
                              animate={pet.isSleeping ? {} : { scaleY: [1, 0.1, 1] }}
                              transition={pet.isSleeping ? {} : { duration: 5, repeat: Infinity, times: [0, 0.96, 1] }}
                            />
                            {!pet.isSleeping && (
                              <>
                                <circle cx="104" cy="100" r="5" fill="white" opacity="0.9" />
                                <circle cx="114" cy="110" r="2.5" fill="white" opacity="0.6" />
                              </>
                            )}
                          </>
                        )}
                      </g>

                      {/* Носик - крошечный */}
                      <circle cx="80" cy="128" r="4" fill="#271105" />

                      {/* Ротик / Поцелуй */}
                      {isSendingLove && !showBodyHearts ? (
                        <motion.path 
                          d="M75 135 Q80 140 85 135" 
                          stroke="#271105" 
                          strokeWidth="2" 
                          fill="none" 
                          strokeLinecap="round"
                          animate={{ scale: [1, 1.2, 1] }}
                        />
                      ) : (
                        <path d="M75 135 Q80 138 85 135" stroke="#271105" strokeWidth="1" fill="none" strokeLinecap="round" />
                      )}

                      {/* Лапки и рыбка при кормлении (поверх лица) */}
                      <motion.g
                        animate={isFeeding ? { y: -45, x: 10 } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        <circle cx="60" cy="185" r="8" fill="#451A03" />
                        <circle cx="60" cy="185" r="3" fill="#FDA4AF" opacity="0.4" />
                      </motion.g>
                      <motion.g
                        animate={isFeeding ? { y: -45, x: -10 } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        <circle cx="100" cy="185" r="8" fill="#451A03" />
                        <circle cx="100" cy="185" r="3" fill="#FDA4AF" opacity="0.4" />
                      </motion.g>

                      <AnimatePresence>
                        {isFeeding && (
                          <motion.g
                            initial={{ opacity: 0, scale: 0, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ originX: "80px", originY: "140px" }}
                          >
                            <motion.g
                              animate={{ y: [0, -2, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            >
                              {/* Тело рыбки */}
                              <path d="M65 140 Q80 130 95 140 Q80 150 65 140" fill="#94A3B8" />
                              {/* Хвост */}
                              <path d="M95 140 L105 135 L105 145 Z" fill="#64748B" />
                              {/* Глаз */}
                              <circle cx="70" cy="138" r="1" fill="black" />
                            </motion.g>
                          </motion.g>
                        )}
                      </AnimatePresence>

                      {/* Летящее сердечко */}
                      <AnimatePresence>
                        {isSendingLove && !showBodyHearts && (
                          <motion.g
                            initial={{ x: 80, y: 250, scale: 0, opacity: 0 }}
                            animate={{ x: 80, y: 135, scale: 1.5, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          >
                            <Heart className="w-8 h-8 text-rose-500 fill-rose-500 -translate-x-4 -translate-y-4" />
                          </motion.g>
                        )}
                      </AnimatePresence>

                      {/* Пена при мытье */}
                      {isWashing && (
                        <motion.g
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <circle cx="40" cy="80" r="12" fill="white" opacity="0.9" />
                          <circle cx="120" cy="80" r="10" fill="white" opacity="0.9" />
                          <circle cx="80" cy="65" r="15" fill="white" opacity="0.9" />
                          <circle cx="30" cy="140" r="10" fill="white" opacity="0.9" />
                          <circle cx="130" cy="140" r="12" fill="white" opacity="0.9" />
                          <circle cx="80" cy="160" r="8" fill="white" opacity="0.9" />
                        </motion.g>
                      )}

                      {/* Ротик - милая "w" */}
                      <motion.path 
                        d={
                          pet.happiness < 35
                            ? "M72 145 Q80 138 88 145"
                            : "M72 142 Q76 148 80 142 Q84 148 88 142"
                        }
                        stroke="#451A03"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        animate={isFeeding ? { scaleY: [1, 1.08, 1], y: [0, 0.2, 0] } : { scaleY: 1, y: 0 }}
                        transition={{ duration: 0.5, repeat: isFeeding ? Infinity : 0 }}
                        style={{ originX: "80px", originY: pet.happiness < 35 ? "145px" : "142px" }}
                      />

                      {/* Сердечки при высоком счастье */}
                      {!pet.isSleeping && pet.happiness > 80 && (
                        <motion.g
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0], y: [-20, -60] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <Heart x="150" y="80" className="w-6 h-6 text-rose-400 fill-rose-400" />
                        </motion.g>
                      )}

                      {/* Zzz при сне */}
                      {pet.isSleeping && (
                        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <motion.text x="160" y="60" fontSize="24" fontWeight="bold" fill="#F97316" animate={{ y: [60, 30], x: [160, 180], opacity: [0, 1, 0] }} transition={{ duration: 3, repeat: Infinity }}>Z</motion.text>
                          <motion.text x="175" y="50" fontSize="18" fontWeight="bold" fill="#F97316" animate={{ y: [50, 25], x: [175, 195], opacity: [0, 1, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.7 }}>z</motion.text>
                        </motion.g>
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
          <div className="grid grid-cols-2 gap-3 mb-3">
            {pet.currentRoom === 'kitchen' && (
              <ActionButton 
                onClick={handleFeed}
                icon={<Utensils />}
                label={isFeeding ? "Кушаем..." : `Покормить (${pet.foodCount})`}
                color="bg-orange-500"
                disabled={pet.isSleeping || pet.foodCount <= 0 || isFeeding}
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
                onClick={handleWash}
                icon={<Bath />}
                label={isWashing ? "Моемся..." : "Помыть"}
                color="bg-sky-500"
                disabled={pet.isSleeping || isWashing}
              />
            )}
            {pet.currentRoom === 'playroom' && (
              <ActionButton 
                onClick={startGame}
                icon={<Gamepad2 />}
                label="Поиграть"
                color="bg-rose-500"
                disabled={pet.isSleeping}
              />
            )}
            <ActionButton 
              onClick={handleSendLove}
              icon={<Heart className={isSendingLove ? "fill-white animate-pulse" : ""} />}
              label={isSendingLove ? "Любовь летит!" : "Отправить любовь"}
              color="bg-pink-500"
              disabled={pet.isSleeping || isSendingLove}
            />
          </div>

          {/* Блок вопросов на еду – только на кухне */}
          {pet.currentRoom === 'kitchen' && (
            <div className="space-y-2 mb-3">
              {/* Я задаю вопрос */}  
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-100 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
                  Вопрос на еду партнёру
                </p>
                <input
                  type="text"
                  placeholder="Вопрос для неё/него..."
                  value={myQuestion}
                  onChange={(e) => setMyQuestion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 border border-stone-100 outline-none focus:ring-2 focus:ring-rose-200"
                />
                <input
                  type="text"
                  placeholder="Правильный ответ..."
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 border border-stone-100 outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button
                  type="button"
                  onClick={sendQuestion}
                  disabled={isSendingQuestion || !myQuestion.trim() || !myAnswer.trim()}
                  className="w-full py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-stone-800 text-white disabled:opacity-50"
                >
                  {isSendingQuestion ? 'Отправка...' : 'Отправить вопрос'}
                </button>
              </div>

              {/* Вопрос для меня */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-100 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
                  Вопрос для тебя
                </p>
                {incomingQuestion ? (
                  <>
                    <p className="text-xs text-stone-700">
                      {incomingQuestion.question}
                    </p>
                    <input
                      type="text"
                      placeholder="Твой ответ..."
                      value={incomingAnswer}
                      onChange={(e) => setIncomingAnswer(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 border border-stone-100 outline-none focus:ring-2 focus:ring-rose-200"
                    />
                    <button
                      type="button"
                      onClick={submitAnswer}
                      className="w-full py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-emerald-500 text-white"
                    >
                      Ответить
                    </button>
                    {answerStatus === 'correct' && (
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Правильно! Ты получил 1 еду для лисёнка.
                      </p>
                    )}
                    {answerStatus === 'wrong' && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-rose-500 font-medium">
                          Не совсем так.
                        </p>
                        {lastCorrectAnswer && (
                          <p className="text-[10px] text-stone-500 italic">
                            Правильный ответ был: <span className="font-bold text-stone-700">{lastCorrectAnswer}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-stone-400 italic">
                    Сейчас для тебя нет активного вопроса.
                  </p>
                )}
              </div>

              {/* История ответов */}
              {answeredQuestionsHistory.length > 0 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-100 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
                    История ответов
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {answeredQuestionsHistory.map((q) => (
                      <div key={q.id} className="p-2 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="text-[9px] text-stone-400 font-bold uppercase">
                            От: {q.createdByName}
                          </p>
                          <p className="text-[9px] text-stone-400 font-bold uppercase">
                            Для: {q.targetEmail === 'glebkarpuhin8@gmail.com' ? 'Глеба' : 'Алёны'}
                          </p>
                        </div>
                        <p className="text-[10px] font-medium text-stone-600">
                          В: {q.question}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] text-stone-500">
                              О: <span className={q.isCorrect ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
                                {(q as any).answerGiven || 'Нет ответа'}
                              </span>
                            </p>
                            {q.isCorrect ? (
                              <div className="bg-emerald-100 p-0.5 rounded-full">
                                <Check className="w-3 h-3 text-emerald-600" />
                              </div>
                            ) : (
                              <div className="bg-rose-100 p-0.5 rounded-full">
                                <X className="w-3 h-3 text-rose-600" />
                              </div>
                            )}
                          </div>
                          {!q.isCorrect && (
                            <p className="text-[9px] text-stone-400 italic">
                              Правильно: <span className="text-stone-600 font-medium">{q.correctAnswer}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Info */}
          <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl border border-white/50 text-center mt-auto">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">Последнее действие</p>
            <p className="text-xs text-stone-600 font-medium">
              <span className="text-rose-500 font-bold">{pet.lastActionBy}</span>: {pet.lastAction}
            </p>
          </div>
        </div>
      </div>

      {/* Оверлей мини‑игры */}
      <AnimatePresence>
        {isGameOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-stone-100 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-xl text-stone-800">Мини‑игра «Запомни числа»</h3>
                  <p className="text-xs text-stone-500">
                    Запомни 5 чисел по порядку и введи их, чтобы порадовать лисёнка.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-rose-500" />
                </div>
              </div>

              <div className="border border-stone-100 rounded-2xl p-4 bg-stone-50/60 min-h-[90px] flex items-center justify-center">
                {showSequence && sequence.length > 0 ? (
                  <div className="flex gap-3 text-lg font-bold tracking-[0.3em] text-stone-800">
                    {sequence.map((n, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {n}
                      </motion.span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 text-center">
                    Числа скрыты. Введи последовательность, которую запомнил. Можно через пробел или подряд, например: <br />
                    <span className="font-mono text-[11px] text-stone-700">1 5 3 9 2</span> или <span className="font-mono text-[11px] text-stone-700">15392</span>.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={gameInput}
                  onChange={(e) => setGameInput(e.target.value)}
                  disabled={showSequence}
                  placeholder={showSequence ? "Сначала запомни числа..." : "Введи 5 чисел в нужном порядке..."}
                  className={`w-full px-4 py-2 text-sm rounded-xl border outline-none focus:ring-2 transition-all ${
                    showSequence 
                      ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed" 
                      : "bg-stone-50 border-stone-100 focus:ring-rose-200"
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitGame}
                    disabled={showSequence}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
                      showSequence
                        ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                        : "bg-stone-800 text-white hover:bg-stone-700"
                    }`}
                  >
                    Проверить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGameOpen(false);
                      setSequence([]);
                      setGameInput('');
                      setGameStatus('idle');
                      setShowSequence(false);
                    }}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-stone-100 text-stone-500"
                  >
                    Отмена
                  </button>
                </div>
                {gameStatus === 'success' && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    Круто! Ты всё запомнил. Лисёнок стал счастливее.
                  </p>
                )}
                {gameStatus === 'fail' && (
                  <p className="text-[11px] text-rose-500 font-medium">
                    В этот раз не получилось. Попробуйте ещё раз чуть позже.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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

function Bubbles() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            y: 300, 
            x: Math.random() * 300, 
            opacity: 0, 
            scale: Math.random() * 0.5 + 0.5 
          }}
          animate={{ 
            y: -100, 
            opacity: [0, 1, 1, 0],
            x: (Math.random() * 300) + (Math.sin(i) * 30)
          }}
          transition={{ 
            duration: Math.random() * 2 + 1.5, 
            repeat: Infinity, 
            delay: Math.random() * 2,
            ease: "linear"
          }}
          className="absolute w-6 h-6 rounded-full bg-white/40 border border-white/60 backdrop-blur-[1px]"
          style={{
            boxShadow: 'inset -2px -2px 4px rgba(255,255,255,0.4), inset 2px 2px 4px rgba(0,0,0,0.05)'
          }}
        />
      ))}
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
  if (room === 'kitchen') {
    return (
      <>
        <div className="absolute top-4 left-4 right-4 h-10 bg-amber-100 rounded-2xl border border-amber-200 flex gap-2 px-3 items-center">
          <div className="w-6 h-6 bg-amber-200 rounded-lg" />
          <div className="w-10 h-6 bg-amber-200 rounded-lg" />
          <div className="w-12 h-6 bg-amber-200 rounded-lg" />
        </div>
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
        <div className="absolute top-6 left-6 w-24 h-20 bg-sky-200 rounded-2xl border border-sky-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-400" />
          <div className="absolute inset-0 border-2 border-white/70 rounded-2xl" />
        </div>
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
        <div className="absolute top-0 left-0 right-0 h-2/3 bg-sky-100 grid grid-cols-6 grid-rows-3 opacity-70">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="border border-sky-200/60" />
          ))}
        </div>
        <div className="absolute bottom-20 left-10 right-10 h-16 bg-sky-50 rounded-full border border-sky-200 shadow-inner">
          <div className="absolute inset-x-6 top-2 h-7 bg-sky-100 rounded-full" />
        </div>
        <div className="absolute top-6 right-12 w-2 h-18 bg-sky-300 rounded-full" />
      </>
    );
  }

  return (
    <>
      <div className="absolute top-6 left-4 right-4 h-6 flex items-center justify-between">
        <div className="w-full h-[2px] bg-amber-300 rounded-full" />
        <div className="absolute inset-x-4 top-1 flex justify-between">
          <div className="w-3 h-4 bg-rose-300 rounded-b-full" />
          <div className="w-3 h-4 bg-emerald-300 rounded-b-full" />
          <div className="w-3 h-4 bg-sky-300 rounded-b-full" />
          <div className="w-3 h-4 bg-violet-300 rounded-b-full" />
        </div>
      </div>
      <div className="absolute bottom-18 left-8 right-8 h-18 bg-gradient-to-r from-rose-200 via-amber-200 to-sky-200 rounded-[999px] shadow-inner" />
      <div className="absolute bottom-22 left-14 w-6 h-6 bg-emerald-400 rounded-2xl rotate-12" />
      <div className="absolute bottom-24 right-14 w-7 h-7 bg-violet-400 rounded-full" />
    </>
  );
}
