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
import { calculateForestState } from '../services/forestLogic';

const ROOMS = [
  { id: 'kitchen', name: 'Кухня', icon: <Utensils /> },
  { id: 'bedroom', name: 'Спальня', icon: <Bed /> },
  { id: 'bathroom', name: 'Ванная', icon: <Bath /> },
  { id: 'playroom', name: 'Игровая', icon: <Gamepad2 /> },
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
  const [foodType, setFoodType] = useState<'fish' | 'berry' | 'chicken'>('fish');
  const [isSendingLove, setIsSendingLove] = useState(false);
  const [showBodyHearts, setShowBodyHearts] = useState(false);
  const [idleAnimation, setIdleAnimation] = useState<'none' | 'look' | 'ears' | 'tail'>('none');

  // Цикл "бездействующих" анимаций
  useEffect(() => {
    if (pet?.isSleeping || isFeeding || isWashing || isSendingLove) {
      setIdleAnimation('none');
      return;
    }

    const interval = setInterval(() => {
      const types: ('none' | 'look' | 'ears' | 'tail')[] = ['none', 'look', 'ears', 'tail', 'none'];
      const next = types[Math.floor(Math.random() * types.length)];
      setIdleAnimation(next);
      
      // Сбрасываем анимацию через 2 секунды, чтобы они не были постоянными
      setTimeout(() => setIdleAnimation('none'), 2000);
    }, 5000);

    return () => clearInterval(interval);
  }, [pet?.isSleeping, isFeeding, isWashing, isSendingLove]);

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
              const hungerDecay = Math.floor(diffMinutes / 6);
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
                  const forestUpdates = calculateForestState({
                    ...data,
                    hunger: newHunger,
                    cleanliness: newCleanliness,
                    happiness: newHappiness,
                    energy: newEnergy
                  });

                  updateDoc(petRef, {
                    hunger: newHunger,
                    cleanliness: newCleanliness,
                    happiness: newHappiness,
                    energy: newEnergy,
                    lastUpdate: serverTimestamp(),
                    ...forestUpdates
                  });
                  return;
                } else {
                  // Даже если статы не изменились, проверяем логику леса (по времени)
                  const forestUpdates = calculateForestState(data);
                  if (Object.keys(forestUpdates).length > 0) {
                    updateDoc(petRef, {
                      ...forestUpdates,
                      lastUpdate: serverTimestamp()
                    });
                    return;
                  }
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
          lastCleanupDate: new Date().toISOString().split('T')[0],
          isAtForest: false,
          zeroStatsSince: null,
          aboveZeroStatsSince: null
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

  // Одноразовый эффект для возвращения в комнату по просьбе пользователя
  useEffect(() => {
    if (pet && pet.isAtForest) {
      const petRef = doc(db, 'pet', 'frosh');
      updateDoc(petRef, {
        isAtForest: false,
        hunger: 80,
        energy: 80,
        cleanliness: 80,
        happiness: 80,
        zeroStatsSince: null,
        aboveZeroStatsSince: serverTimestamp(),
        lastAction: 'Вернулся домой из леса ✨',
        lastUpdate: serverTimestamp()
      });
    }
  }, [pet === null]); // Run once when pet is loaded
  
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
    
    // Выбираем следующий тип еды
    const types: ('fish' | 'berry' | 'chicken')[] = ['fish', 'berry', 'chicken'];
    const currentIndex = types.indexOf(foodType);
    const nextType = types[(currentIndex + 1) % types.length];
    setFoodType(nextType);

    const foodNames = {
      fish: 'рыбку... 🐟',
      berry: 'ягодку... 🍓',
      chicken: 'курочку... 🍗'
    };
    
    setActionFeedback(`Кушаем ${foodNames[nextType]}`);
    
    setTimeout(async () => {
      const actionNames = {
        fish: 'Покушал рыбку 🐟',
        berry: 'Покушал ягодку 🍓',
        chicken: 'Покушал курочку 🍗'
      };
      await performAction(actionNames[nextType], { 
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

  const goToRoom = (roomId: string) => {
    if (!pet || pet.currentRoom === roomId) return;
    const room = ROOMS.find(r => r.id === roomId);
    if (room) {
      performAction(`Перешел в ${room.name}`, { currentRoom: roomId as any });
    }
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
    : pet.isAtForest
      ? `${pet.name} в лесу... 🌲`
      : pet.hunger === 0
        ? `${pet.name} умирает от голода! 😭`
        : pet.happiness < 40
          ? `${pet.name} грустит`
          : pet.hunger < 40
            ? `${pet.name} голоден`
            : pet.energy < 30
              ? `${pet.name} устал`
              : `${pet.name} доволен`;

  return (
    <>
      <div className={`max-w-md mx-auto rounded-[40px] shadow-2xl overflow-hidden border relative transition-colors duration-1000 ${
        pet.isAtForest ? 'bg-emerald-950 border-emerald-900' : 'bg-stone-50 border-stone-100'
      }`}>
        {/* UI Overlay */}
        <div className="relative z-10 p-4 flex flex-col min-h-[650px]">
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <StatItem 
              icon={<Utensils className="w-4 h-4" />} 
              value={pet.hunger} 
              color="bg-orange-400" 
              onClick={() => goToRoom('kitchen')}
              label="Голод"
            />
            <StatItem 
              icon={<Zap className="w-4 h-4" />} 
              value={pet.energy} 
              color="bg-yellow-400" 
              onClick={() => goToRoom('bedroom')}
              label="Энергия"
            />
            <StatItem 
              icon={<Droplets className="w-4 h-4" />} 
              value={pet.cleanliness} 
              color="bg-sky-400" 
              onClick={() => goToRoom('bathroom')}
              label="Чистота"
            />
            <StatItem 
              icon={<Heart className="w-4 h-4" />} 
              value={pet.happiness} 
              color="bg-rose-400" 
              onClick={() => goToRoom('playroom')}
              label="Счастье"
            />
          </div>

          {/* Room Header (Arrows removed as requested) */}
          <div className="flex items-center justify-center mb-2">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full shadow-sm border border-white/50">
              {currentRoomData.icon}
              <span className="font-bold text-xs uppercase tracking-widest text-stone-600">{currentRoomData.name}</span>
            </div>
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

            <div className="w-full flex flex-col items-center gap-2">
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
                {/* Базовая заливка стены/пола (скрываем в лесу) */}
                <div className={`absolute inset-0 transition-opacity duration-1000 ${pet.isAtForest ? 'opacity-0' : 'opacity-100'}`}>
                  <div className="absolute top-0 left-0 right-0 h-2/3 bg-gradient-to-b from-rose-50 via-amber-50/60 to-emerald-50/40" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-100 to-amber-200" />
                </div>

                {/* Интерьер под конкретную комнату */}
                <div className="absolute inset-0 z-0">
                  {pet.isAtForest ? (
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Глубокая ночная атмосфера */}
                      <div className="absolute inset-0 bg-[#061a12]" />
                      <div className="absolute inset-0 bg-gradient-to-b from-[#061a12] via-[#0a2e1f] to-[#061a12] opacity-80" />
                      
                      {/* Дальние слои леса */}
                      <div className="absolute bottom-0 left-0 w-full h-full flex justify-around items-end opacity-20 blur-[2px]">
                        {[1, 2, 3, 4, 5, 6, 7].map(i => (
                          <div key={`far-${i}`} className="w-8 bg-emerald-900 rounded-t-full" style={{ height: `${40 + Math.sin(i) * 20}%`, transform: `translateX(${Math.cos(i) * 20}px)` }} />
                        ))}
                      </div>

                      {/* Средние слои леса */}
                      <div className="absolute bottom-0 left-0 w-full h-full flex justify-around items-end opacity-40 blur-[1px]">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={`mid-${i}`} className="w-12 bg-[#0a2e1f] rounded-t-full" style={{ height: `${30 + i * 10}%`, transform: `translateX(${i * 5}px)` }} />
                        ))}
                      </div>

                      {/* Туман */}
                      <motion.div 
                        animate={{ x: [-40, 40, -40], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-transparent pointer-events-none"
                      />

                      {/* Светлячки */}
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <motion.div
                          key={`firefly-${i}`}
                          animate={{ 
                            opacity: [0, 1, 0],
                            y: [0, -30, 0],
                            x: [0, Math.sin(i) * 15, 0],
                            scale: [1, 1.5, 1]
                          }}
                          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
                          className="absolute w-1 h-1 bg-yellow-200 rounded-full blur-[1px] shadow-[0_0_8px_rgba(254,240,138,0.8)]"
                          style={{ 
                            left: `${(i * 13) % 100}%`, 
                            top: `${(i * 17) % 100}%` 
                          }}
                        />
                      ))}

                      {/* Почва и трава */}
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#04140e] opacity-80" />
                      <div className="absolute bottom-0 left-0 right-0 h-12 flex items-end justify-between px-2 opacity-60">
                         {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                           <div key={`grass-${i}`} className="w-6 h-8 bg-[#04140e] rounded-t-full" style={{ transform: `rotate(${Math.sin(i) * 10}deg)` }} />
                         ))}
                      </div>

                      {/* Падающие листья */}
                      {[1, 2, 3, 4, 5].map(i => (
                        <motion.div
                          key={`leaf-${i}`}
                          initial={{ y: -20, x: Math.random() * 300, rotate: 0 }}
                          animate={{ 
                            y: 300, 
                            x: (Math.random() * 300) + Math.sin(i) * 50,
                            rotate: 360 
                          }}
                          transition={{ 
                            duration: 10 + Math.random() * 5, 
                            repeat: Infinity, 
                            delay: Math.random() * 10,
                            ease: "linear"
                          }}
                          className="absolute w-2 h-2 bg-emerald-700/40 rounded-full blur-[0.5px]"
                        />
                      ))}
                    </div>
                  ) : (
                    <RoomInterior room={pet.currentRoom} />
                  )}
                  {/* Ночной оверлей при сне */}
                  <AnimatePresence>
                    {pet.isSleeping && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-indigo-950/30 backdrop-blur-[1px] pointer-events-none z-10"
                      />
                    )}
                  </AnimatePresence>
                </div>

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
                  className="relative z-10 overflow-visible"
                >
                  <div className="w-40 h-40 sm:w-48 sm:h-48 relative overflow-visible">
                    <svg 
                      viewBox="-30 0 260 200" 
                      className="w-full h-full drop-shadow-2xl"
                      style={{ overflow: 'visible' }}
                    >
                      <defs>
                        <linearGradient id="foxFur" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#F3F4F6" />
                        </linearGradient>
                        <radialGradient id="foxFace" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#F9FAFB" />
                          <stop offset="100%" stopColor="#F3F4F6" />
                        </radialGradient>
                        <linearGradient id="foxBelly" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#E5E7EB" />
                        </linearGradient>
                        <radialGradient id="foxEyeIris" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#1E1B4B" />
                        </radialGradient>
                      </defs>

                      {/* Хвост - очень пушистый */}
                      <motion.g
                        animate={{ 
                          rotate: pet.isSleeping ? [0, 4, 0] : idleAnimation === 'tail' ? [0, 25, -15, 25, 0] : [0, 10, -5, 10, 0],
                          x: pet.isSleeping ? [0, 1, 0] : idleAnimation === 'tail' ? [0, 8, -4, 8, 0] : [0, 4, -2, 4, 0]
                        }}
                        transition={{ duration: idleAnimation === 'tail' ? 0.5 : 4, repeat: Infinity, ease: "easeInOut" }}
                        style={{ originX: "110px", originY: "145px" }}
                      >
                        <path
                          d="M110 145 C 160 150 175 80 150 50 C 130 30 100 70 110 115"
                          fill="url(#foxFur)"
                          stroke="#D1D5DB"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M150 50 C 165 65 170 90 155 100 C 140 90 130 75 150 50"
                          fill="white"
                        />
                      </motion.g>

                      {/* Тело - маленькое и круглое */}
                      <motion.g
                        animate={{ scale: pet.isSleeping ? [1, 1.06, 1] : [1, 1.02, 1] }}
                        transition={{ duration: pet.isSleeping ? 4 : 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <ellipse 
                          cx="80" cy="155" rx="48" ry="40" 
                          fill={pet.isAtForest ? "#9CA3AF" : "url(#foxFur)"} 
                          stroke={pet.isAtForest ? "#4B5563" : "#D1D5DB"} 
                          strokeWidth="1.5" 
                        />
                        <path d="M55 145 Q80 175 105 145 Q80 160 55 145" fill={pet.isAtForest ? "#A8A29E" : "url(#foxBelly)"} />
                        
                        {/* Грязь на теле в лесу */}
                        {pet.isAtForest && (
                          <g opacity="0.6">
                            <circle cx="60" cy="165" r="4" fill="#451A03" />
                            <circle cx="100" cy="170" r="3" fill="#451A03" />
                            <circle cx="80" cy="180" r="5" fill="#451A03" />
                            <path d="M50 170 Q55 175 60 170" stroke="#451A03" strokeWidth="2" fill="none" />
                          </g>
                        )}
                        
                        {/* Журчание живота при голоде */}
                        {pet.hunger === 0 && !pet.isSleeping && (
                          <motion.g>
                            {[0, 1, 2].map((i) => (
                              <motion.path
                                key={i}
                                d="M65 160 Q80 170 95 160"
                                stroke="#92400E"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                                initial={{ opacity: 0, scale: 0.8, y: 0 }}
                                animate={{ 
                                  opacity: [0, 0.6, 0],
                                  scale: [0.8, 1.2, 1.1],
                                  y: [0, 4, 8]
                                }}
                                transition={{ 
                                  duration: 2, 
                                  repeat: Infinity, 
                                  delay: i * 0.6,
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                            <motion.g
                              animate={{ 
                                x: [-1, 1, -1],
                                y: [-0.5, 0.5, -0.5]
                              }}
                              transition={{ duration: 0.1, repeat: Infinity }}
                            >
                              <path d="M60 155 Q80 170 100 155" stroke="#92400E" strokeWidth="1" fill="none" opacity="0.4" />
                            </motion.g>
                          </motion.g>
                        )}
                        
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

                      {/* Уши - большие и острые */}
                      <motion.g
                        animate={{ rotate: pet.isSleeping ? 0 : idleAnimation === 'ears' ? [0, 15, 0, 15, 0] : [0, 5, 0, -5, 0] }}
                        transition={{ duration: idleAnimation === 'ears' ? 0.4 : 4, repeat: Infinity, delay: 1 }}
                        style={{ originX: "45px", originY: "70px" }}
                      >
                        <path d="M45 70 L15 15 L70 55 Z" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" />
                        <path d="M45 70 L25 40 L60 55 Z" fill="#FFE4E6" />
                      </motion.g>
                      <motion.g
                        animate={{ rotate: pet.isSleeping ? 0 : idleAnimation === 'ears' ? [0, -15, 0, -15, 0] : [0, -5, 0, 5, 0] }}
                        transition={{ duration: idleAnimation === 'ears' ? 0.4 : 4, repeat: Infinity, delay: 1.5 }}
                        style={{ originX: "115px", originY: "70px" }}
                      >
                        <path d="M115 70 L155 15 L90 55 Z" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" />
                        <path d="M115 70 L135 40 L100 55 Z" fill="#FFE4E6" />
                      </motion.g>

                      {/* Голова - большая и круглая (Chibi style) */}
                      <path 
                        d="M25 105 Q15 80 40 65 Q80 45 120 65 Q145 80 135 105 Q145 125 125 145 Q80 165 35 145 Q15 125 25 105" 
                        fill={pet.isAtForest ? "#9CA3AF" : "url(#foxFace)"} 
                        stroke={pet.isAtForest ? "#4B5563" : "#D1D5DB"} 
                        strokeWidth="1.5" 
                      />
                      
                      {/* Грязь на голове в лесу */}
                      {pet.isAtForest && (
                        <g opacity="0.5">
                          <circle cx="40" cy="80" r="3" fill="#451A03" />
                          <circle cx="120" cy="85" r="4" fill="#451A03" />
                          <path d="M70 60 Q80 65 90 60" stroke="#451A03" strokeWidth="2" fill="none" />
                        </g>
                      )}
                      
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
                            style={{ originX: "52px", originY: "105px" }}
                          />
                        ) : (
                          <>
                            {pet.isSleeping ? (
                              <path 
                                d="M 42 105 Q 52 115 62 105" 
                                fill="none" 
                                stroke="#1E1B4B" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                              />
                            ) : (
                              <>
                                <motion.circle 
                                  cx="52" 
                                  cy="105" 
                                  r={11} 
                                  fill="url(#foxEyeIris)"
                                  animate={{ 
                                    scaleY: pet.hunger === 0 ? 0.8 : [1, 0.1, 1],
                                    x: idleAnimation === 'look' ? [-4, 4, 0] : 0 
                                  }}
                                  transition={{ 
                                    scaleY: { duration: 5, repeat: Infinity, times: [0, 0.96, 1] },
                                    x: { duration: 2, repeat: 0 }
                                  }}
                                />
                                {/* Слезы при голоде */}
                                {pet.hunger === 0 && (
                                  <motion.path
                                    d="M 52 110 Q 52 125 48 120"
                                    stroke="#38BDF8"
                                    strokeWidth="2"
                                    fill="none"
                                    animate={{ opacity: [0, 1, 0], y: [0, 5, 10] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                                <motion.circle 
                                  cx="48" cy="100" r="5" fill="white" opacity="0.9" 
                                  animate={{ x: idleAnimation === 'look' ? [-4, 4, 0] : 0 }}
                                  transition={{ duration: 2, repeat: 0 }}
                                />
                                <motion.circle 
                                  cx="58" cy="110" r="2.5" fill="white" opacity="0.6" 
                                  animate={{ x: idleAnimation === 'look' ? [-4, 4, 0] : 0 }}
                                  transition={{ duration: 2, repeat: 0 }}
                                />
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
                            style={{ originX: "108px", originY: "105px" }}
                          />
                        ) : (
                          <>
                            {pet.isSleeping ? (
                              <path 
                                d="M 98 105 Q 108 115 118 105" 
                                fill="none" 
                                stroke="#1E1B4B" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                              />
                            ) : (
                              <>
                                <motion.circle 
                                  cx="108" 
                                  cy="105" 
                                  r={11} 
                                  fill="url(#foxEyeIris)"
                                  animate={{ 
                                    scaleY: pet.hunger === 0 ? 0.8 : [1, 0.1, 1],
                                    x: idleAnimation === 'look' ? [-4, 4, 0] : 0 
                                  }}
                                  transition={{ 
                                    scaleY: { duration: 5, repeat: Infinity, times: [0, 0.96, 1] },
                                    x: { duration: 2, repeat: 0 }
                                  }}
                                />
                                {/* Слезы при голоде */}
                                {pet.hunger === 0 && (
                                  <motion.path
                                    d="M 108 110 Q 108 125 112 120"
                                    stroke="#38BDF8"
                                    strokeWidth="2"
                                    fill="none"
                                    animate={{ opacity: [0, 1, 0], y: [0, 5, 10] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                                  />
                                )}
                                <motion.circle 
                                  cx="104" cy="100" r="5" fill="white" opacity="0.9" 
                                  animate={{ x: idleAnimation === 'look' ? [-4, 4, 0] : 0 }}
                                  transition={{ duration: 2, repeat: 0 }}
                                />
                                <motion.circle 
                                  cx="114" cy="110" r="2.5" fill="white" opacity="0.6" 
                                  animate={{ x: idleAnimation === 'look' ? [-4, 4, 0] : 0 }}
                                  transition={{ duration: 2, repeat: 0 }}
                                />
                              </>
                            )}
                          </>
                        )}
                      </g>

                      {/* Носик - крошечный */}
                      <circle cx="80" cy="128" r="4" fill="#271105" />

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
                              {foodType === 'fish' && (
                                <>
                                  {/* Тело рыбки */}
                                  <path d="M65 140 Q80 130 95 140 Q80 150 65 140" fill="#94A3B8" />
                                  {/* Хвост */}
                                  <path d="M95 140 L105 135 L105 145 Z" fill="#64748B" />
                                  {/* Глаз */}
                                  <circle cx="70" cy="138" r="1" fill="black" />
                                </>
                              )}
                              {foodType === 'berry' && (
                                <>
                                  {/* Ягодка */}
                                  <circle cx="80" cy="140" r="8" fill="#EF4444" />
                                  {/* Блик */}
                                  <circle cx="77" cy="137" r="2" fill="white" opacity="0.6" />
                                  {/* Листик */}
                                  <path d="M80 132 Q82 125 85 130" stroke="#22C55E" strokeWidth="2" fill="none" />
                                </>
                              )}
                              {foodType === 'chicken' && (
                                <>
                                  {/* Косточка */}
                                  <rect x="75" y="135" width="15" height="10" rx="2" fill="#FDE68A" />
                                  <circle cx="75" cy="137" r="4" fill="#FDE68A" />
                                  <circle cx="75" cy="143" r="4" fill="#FDE68A" />
                                  {/* Мясо */}
                                  <path d="M85 130 Q105 130 105 140 Q105 150 85 150 Z" fill="#B45309" />
                                </>
                              )}
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
                          isSendingLove && !showBodyHearts
                            ? "M75 142 Q80 147 85 142"
                            : (pet.happiness < 35 || pet.hunger === 0 || pet.isAtForest)
                              ? "M72 145 Q80 138 88 145" // Грустный ротик
                              : "M72 142 Q76 148 80 142 Q84 148 88 142"
                        }
                        stroke="#451A03"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        animate={isFeeding ? { scaleY: [1, 1.08, 1], y: [0, 0.2, 0] } : { scaleY: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, repeat: isFeeding ? Infinity : 0 }}
                        style={{ originX: "80px", originY: isSendingLove && !showBodyHearts ? "142px" : pet.happiness < 35 ? "145px" : "142px" }}
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

                      {/* Облачко с просьбой еды */}
                      {pet.hunger === 0 && !pet.isSleeping && (
                        <motion.g
                          initial={{ opacity: 0, scale: 0, x: 25, y: 50 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <path d="M130 40 Q130 15 160 15 Q190 15 190 40 Q190 65 160 65 Q150 65 140 60 L125 68 L135 55 Q130 50 130 40 Z" fill="white" stroke="#E2E8F0" strokeWidth="1" />
                          <Utensils x="150" y="30" className="w-5 h-5 text-orange-400" />
                        </motion.g>
                      )}

                      {/* Анимация сна (Zzz) - Перенесено в конец для видимости поверх головы */}
                      {pet.isSleeping && (
                        <g>
                          <motion.text
                            x="60" y="60"
                            fill="#6366F1"
                            fontSize="16"
                            fontWeight="bold"
                            fontFamily="monospace"
                            animate={{ 
                              y: [60, 20],
                              x: [60, 75],
                              opacity: [0, 1, 0],
                              scale: [0.5, 1.2, 0.8]
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                          >
                            z
                          </motion.text>
                          <motion.text
                            x="75" y="50"
                            fill="#4F46E5"
                            fontSize="22"
                            fontWeight="bold"
                            fontFamily="monospace"
                            animate={{ 
                              y: [50, 0],
                              x: [75, 95],
                              opacity: [0, 1, 0],
                              scale: [0.5, 1.5, 1]
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                          >
                            z
                          </motion.text>
                          <motion.text
                            x="90" y="40"
                            fill="#4338CA"
                            fontSize="28"
                            fontWeight="bold"
                            fontFamily="monospace"
                            animate={{ 
                              y: [40, -20],
                              x: [90, 120],
                              opacity: [0, 1, 0],
                              scale: [0.5, 1.8, 1.2]
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                          >
                            Z
                          </motion.text>
                        </g>
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
              <>
                <ActionButton 
                  onClick={handleFeed}
                  icon={<Utensils />}
                  label={isFeeding ? "Кушаем..." : `Покормить (${pet.foodCount})`}
                  color="bg-orange-500"
                  disabled={pet.isSleeping || pet.foodCount <= 0 || isFeeding}
                />
              </>
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

function StatItem({ icon, value, color, onClick, label }: { icon: React.ReactNode, value: number, color: string, onClick?: () => void, label?: string }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white/80 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-white/50 flex flex-col items-center gap-1 transition-all hover:bg-white hover:scale-105 active:scale-95 group"
    >
      <div className={`${color} p-1.5 rounded-lg text-white group-hover:shadow-lg transition-all`}>
        {icon}
      </div>
      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${color}`}
        />
      </div>
      {label && <span className="text-[8px] font-bold uppercase tracking-tighter text-stone-400 mt-0.5">{label}</span>}
    </button>
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
        {/* Окно */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-20 bg-sky-100 rounded-xl border-4 border-amber-200 overflow-hidden shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-300 to-sky-100" />
          <div className="absolute top-2 left-2 w-10 h-8 bg-white/40 rounded-sm" />
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-emerald-400/30" />
          <div className="absolute inset-0 border-r-2 border-amber-200/50 left-1/2" />
          <div className="absolute inset-0 border-b-2 border-amber-200/50 top-1/2" />
        </div>

        {/* Плитка на стене */}
        <div className="absolute top-24 left-0 right-0 h-12 grid grid-cols-8 gap-1 px-2 opacity-30">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-full bg-amber-100 rounded-sm border border-amber-200" />
          ))}
        </div>

        {/* Полка */}
        <div className="absolute top-36 left-4 right-4 h-2 bg-amber-300 rounded-full shadow-sm" />
        <div className="absolute top-28 left-8 flex gap-3 items-end">
          <div className="w-4 h-8 bg-rose-400 rounded-t-lg shadow-sm" />
          <div className="w-5 h-6 bg-emerald-400 rounded-t-md shadow-sm" />
          <div className="w-3 h-4 bg-sky-400 rounded-full shadow-sm" />
        </div>

        {/* Холодильник */}
        <div className="absolute bottom-16 left-4 w-16 h-32 bg-stone-100 rounded-xl border-2 border-stone-200 shadow-lg">
          <div className="absolute top-4 right-2 w-1 h-8 bg-stone-300 rounded-full" />
          <div className="absolute top-16 left-0 right-0 h-[1px] bg-stone-200" />
          <div className="absolute bottom-4 right-2 w-1 h-12 bg-stone-300 rounded-full" />
        </div>

        {/* Стол */}
        <div className="absolute bottom-12 left-24 right-4 h-4 bg-amber-400 rounded-t-2xl shadow-md border-b-4 border-amber-500">
          <div className="absolute -top-6 left-4 flex gap-2">
            <div className="w-6 h-6 bg-white rounded-full border-2 border-stone-100 shadow-sm" />
            <div className="w-4 h-6 bg-rose-200 rounded-sm shadow-sm" />
          </div>
        </div>
      </>
    );
  }

  if (room === 'bedroom') {
    return (
      <>
        {/* Окно с ночным небом */}
        <div className="absolute top-6 left-10 w-32 h-24 bg-indigo-950 rounded-2xl border-4 border-indigo-200 overflow-hidden shadow-2xl">
          <div className="absolute top-4 left-6 w-1 h-1 bg-white rounded-full animate-pulse" />
          <div className="absolute top-10 left-20 w-1 h-1 bg-white rounded-full animate-pulse delay-700" />
          <div className="absolute top-16 left-8 w-1 h-1 bg-white rounded-full animate-pulse delay-1000" />
          <div className="absolute top-4 right-6 w-4 h-4 bg-amber-100 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
          <div className="absolute inset-0 border-r-2 border-indigo-200/30 left-1/2" />
          <div className="absolute inset-0 border-b-2 border-indigo-200/30 top-1/2" />
        </div>

        {/* Картина на стене */}
        <div className="absolute top-10 right-10 w-16 h-12 bg-rose-50 border-4 border-amber-800 rounded-sm shadow-md flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-gradient-to-tr from-emerald-200 to-sky-200 opacity-60" />
          <div className="absolute w-4 h-4 bg-amber-400 rounded-full -bottom-1 -left-1" />
        </div>

        {/* Тумбочка */}
        <div className="absolute bottom-16 left-6 w-16 h-16 bg-indigo-400 rounded-xl shadow-lg border-b-4 border-indigo-600">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-200 rounded-full" />
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-200 rounded-full" />
          {/* Лампа */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <div className="w-10 h-6 bg-amber-300 rounded-t-full shadow-sm" />
            <div className="w-2 h-4 bg-stone-400 mx-auto" />
          </div>
        </div>

        {/* Коврик */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-8 bg-indigo-200/50 rounded-full blur-sm" />
        
        {/* Кровать */}
        <div className="absolute bottom-12 right-6 left-24 h-16 bg-indigo-500 rounded-3xl shadow-2xl border-b-8 border-indigo-700">
          <div className="absolute -top-4 left-4 w-12 h-6 bg-indigo-100 rounded-t-2xl shadow-inner" />
          <div className="absolute inset-x-2 top-2 h-8 bg-indigo-400/30 rounded-2xl" />
        </div>
      </>
    );
  }

  if (room === 'bathroom') {
    return (
      <>
        {/* Плитка на всю стену */}
        <div className="absolute inset-0 bg-sky-50 grid grid-cols-10 grid-rows-6 opacity-40">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="border border-sky-200/40" />
          ))}
        </div>

        {/* Зеркало */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-32 bg-white/40 backdrop-blur-md rounded-full border-4 border-sky-200 shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-transparent via-white/30 to-transparent -rotate-45 translate-y-[-50%]" />
        </div>

        {/* Полотенцесушитель */}
        <div className="absolute top-10 left-6 w-12 h-24 flex flex-col gap-4">
          <div className="h-1 bg-sky-300 rounded-full shadow-sm" />
          <div className="h-1 bg-sky-300 rounded-full shadow-sm" />
          <div className="h-1 bg-sky-300 rounded-full shadow-sm" />
          {/* Полотенце */}
          <div className="absolute top-2 left-2 w-8 h-16 bg-rose-200 rounded-sm shadow-md border-b-4 border-rose-300" />
        </div>

        {/* Раковина */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-32 h-10 bg-white rounded-full border-b-4 border-stone-200 shadow-lg">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-8 bg-stone-300 rounded-t-full">
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-stone-400 rounded-full" />
          </div>
        </div>

        {/* Ванна */}
        <div className="absolute bottom-10 left-6 right-6 h-16 bg-white rounded-b-[40px] rounded-t-xl border-b-8 border-stone-200 shadow-2xl overflow-hidden">
          <div className="absolute inset-x-4 top-2 h-8 bg-sky-100/50 rounded-full shadow-inner" />
          {/* Пузырьки */}
          <div className="absolute top-1 left-10 w-4 h-4 bg-white/80 rounded-full" />
          <div className="absolute top-2 left-16 w-3 h-3 bg-white/80 rounded-full" />
          <div className="absolute top-1 right-12 w-5 h-5 bg-white/80 rounded-full" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Гирлянда */}
      <div className="absolute top-4 left-0 right-0 h-8 flex items-center justify-between px-4">
        <div className="w-full h-[2px] bg-amber-300/50 rounded-full" />
        <div className="absolute inset-x-4 top-1 flex justify-between">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-4 h-6 bg-rose-400 rounded-b-full shadow-sm" />
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} className="w-4 h-6 bg-emerald-400 rounded-b-full shadow-sm" />
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} className="w-4 h-6 bg-sky-400 rounded-b-full shadow-sm" />
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }} className="w-4 h-6 bg-violet-400 rounded-b-full shadow-sm" />
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 2 }} className="w-4 h-6 bg-amber-400 rounded-b-full shadow-sm" />
        </div>
      </div>

      {/* Постер на стене */}
      <div className="absolute top-16 left-10 w-20 h-24 bg-white p-1 shadow-lg -rotate-6 border border-stone-100">
        <div className="w-full h-full bg-amber-50 flex flex-col items-center justify-center gap-1">
          <Heart className="w-8 h-8 text-rose-300 fill-rose-100" />
          <div className="w-12 h-1 bg-stone-200 rounded-full" />
          <div className="w-8 h-1 bg-stone-200 rounded-full" />
        </div>
      </div>

      {/* Коробка с игрушками */}
      <div className="absolute bottom-16 right-6 w-24 h-20 bg-amber-700 rounded-xl shadow-xl border-b-8 border-amber-900 overflow-hidden">
        <div className="absolute -top-4 left-2 w-8 h-12 bg-rose-400 rounded-lg rotate-12 shadow-md" />
        <div className="absolute -top-2 right-4 w-10 h-10 bg-sky-400 rounded-full shadow-md" />
        <div className="absolute inset-x-0 top-0 h-4 bg-amber-800/50" />
      </div>

      {/* Мячик */}
      <motion.div 
        animate={{ x: [0, 20, 0], rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-12 left-10 w-10 h-10 bg-gradient-to-tr from-violet-500 to-violet-300 rounded-full shadow-lg border-2 border-white/20"
      >
        <div className="absolute top-2 left-2 w-3 h-3 bg-white/30 rounded-full" />
      </motion.div>

      {/* Большой ковер */}
      <div className="absolute bottom-10 left-6 right-6 h-12 bg-gradient-to-r from-rose-100 via-amber-100 to-sky-100 rounded-full shadow-inner border border-white/50 opacity-80" />
    </>
  );
}
