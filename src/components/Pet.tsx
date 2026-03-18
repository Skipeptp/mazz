import React, { useState, useEffect } from 'react';
import { db, auth, doc, onSnapshot, updateDoc, setDoc, collection, addDoc, query, where, orderBy, limit, serverTimestamp, increment } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, Moon, Sun, HelpCircle, Send, Check, X, Home, TreePine, AlertCircle, Coffee, CheckCircle2, Cloud, Sparkles, Ghost, Waves, Fish } from 'lucide-react';
import { PetState, QuizQuestion } from '../types';

const HUNGER_DECAY_RATE = 2; // % per hour
const ENERGY_DECAY_RATE = 5; // % per hour
const SLEEP_RECOVERY_RATE = 15; // % per hour
const NEGLECT_THRESHOLD = 48; // hours without food or sleep before leaving

export default function Pet() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isAsking, setIsAsking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isEating, setIsEating] = useState(false);
  const [petPosition, setPetPosition] = useState<'center' | 'table' | 'bed'>('center');

  useEffect(() => {
    console.log("Pet component mounted, auth.currentUser:", auth.currentUser?.email);
    const unsub = auth.onAuthStateChanged((u) => {
      console.log("Auth state changed in Pet:", u?.email);
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  const partnerEmail = currentUser?.email?.toLowerCase() === 'glebkarpuhin8@gmail.com' 
    ? 'arhipovaaliena78@gmail.com' 
    : 'glebkarpuhin8@gmail.com';

  useEffect(() => {
    const petRef = doc(db, 'pet', 'frosh');
    const unsubPet = onSnapshot(petRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as PetState;
        setPet(data);
        calculateDecay(data);
      } else {
        // Initialize pet if doesn't exist
        const initialState: PetState = {
          name: 'Фрош',
          hunger: 80,
          energy: 80,
          isSleeping: false,
          isGone: false,
          foodAvailable: 0,
          lastFed: serverTimestamp(),
          lastSlept: serverTimestamp(),
          lastWokeUp: serverTimestamp(),
          hungerZeroStart: null,
          forestStayStart: null
        };
        setDoc(petRef, initialState);
      }
      setLoading(false);
    });

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsubQuizzes = onSnapshot(quizzesQuery, (snap) => {
      const qList = snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizQuestion));
      setQuizzes(qList);
    }, (err) => {
      console.error("Quizzes snapshot error:", err);
    });

    return () => {
      unsubPet();
      unsubQuizzes();
    };
  }, []);

  const calculateDecay = async (currentPet: PetState) => {
    const now = Date.now();
    const lastUpdate = currentPet.lastWokeUp?.toMillis?.() || currentPet.lastSlept?.toMillis?.() || now;
    const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);

    if (hoursPassed < 0.05 && !currentPet.isGone) return; // Update roughly every 3 mins unless gone

    let newHunger = currentPet.hunger;
    let newEnergy = currentPet.energy;
    let isGone = currentPet.isGone;
    let hungerZeroStart = currentPet.hungerZeroStart || null;
    let forestStayStart = currentPet.forestStayStart || null;

    if (!isGone) {
      newHunger = Math.max(0, currentPet.hunger - (HUNGER_DECAY_RATE * hoursPassed));
      
      if (currentPet.isSleeping) {
        newEnergy = Math.min(100, currentPet.energy + (SLEEP_RECOVERY_RATE * hoursPassed));
        if (newEnergy >= 100) {
          await updateDoc(doc(db, 'pet', 'frosh'), {
            energy: 100,
            isSleeping: false,
            lastWokeUp: serverTimestamp()
          });
          return;
        }
      } else {
        newEnergy = Math.max(0, currentPet.energy - (ENERGY_DECAY_RATE * hoursPassed));
      }

      // Forest logic: If hunger is 0 for 24 hours
      if (newHunger === 0) {
        if (!hungerZeroStart) {
          hungerZeroStart = serverTimestamp();
        } else {
          const zeroStartMillis = hungerZeroStart?.toMillis?.() || now;
          const hoursAtZero = (now - zeroStartMillis) / (1000 * 60 * 60);
          if (hoursAtZero >= 24) {
            isGone = true;
            forestStayStart = serverTimestamp();
          }
        }
      } else {
        hungerZeroStart = null;
      }
    } else {
      // If in forest, check if 24h cycle passed
      const stayStartMillis = forestStayStart?.toMillis?.() || now;
      const hoursInForest = (now - stayStartMillis) / (1000 * 60 * 60);

      if (hoursInForest >= 24) {
        if (currentPet.hunger > 0) {
          isGone = false;
          forestStayStart = null;
          hungerZeroStart = null;
        } else {
          // Stay for another 24h
          forestStayStart = serverTimestamp();
        }
      } else if (currentPet.hunger > 0) {
        // Return immediately if fed (as per "если его покормят он вернется обратно")
        isGone = false;
        forestStayStart = null;
        hungerZeroStart = null;
      }
    }

    await updateDoc(doc(db, 'pet', 'frosh'), {
      hunger: newHunger,
      energy: newEnergy,
      isGone,
      hungerZeroStart,
      forestStayStart
    });
  };

  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);

  const showStatus = (text: string, type: 'error' | 'success' = 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const submitQuestion = async () => {
    console.log("submitQuestion function started");
    console.log("Current state:", { newQuestion, newAnswer, currentUser: !!currentUser, isSubmitting });
    
    try {
      if (!newQuestion.trim()) {
        showStatus("Введите текст вопроса");
        return;
      }
      if (!newAnswer.trim()) {
        showStatus("Введите правильный ответ");
        return;
      }
      if (!currentUser) {
        showStatus("Ошибка: пользователь не найден. Попробуйте перезагрузить страницу.");
        return;
      }
      
      // Check cooldown
      const cooldownUntil = pet?.cooldownUntil;
      let cooldownTime = 0;
      if (cooldownUntil) {
        if (typeof cooldownUntil.toMillis === 'function') {
          cooldownTime = cooldownUntil.toMillis();
        } else if (cooldownUntil instanceof Date) {
          cooldownTime = cooldownUntil.getTime();
        } else if (cooldownUntil.seconds) {
          cooldownTime = cooldownUntil.seconds * 1000;
        }
      }

      if (cooldownTime > Date.now()) {
        const remainingMs = cooldownTime - Date.now();
        if (remainingMs > 60000) {
          const waitTime = Math.ceil(remainingMs / (1000 * 60));
          showStatus(`Нужно подождать еще ${waitTime} мин. перед следующим вопросом!`);
        } else {
          const waitTime = Math.ceil(remainingMs / 1000);
          showStatus(`Нужно подождать еще ${waitTime} сек. перед следующим вопросом!`);
        }
        return;
      }

      setIsSubmitting(true);
      const quizData = {
        text: newQuestion.trim(),
        answer: newAnswer.toLowerCase().trim(),
        fromId: currentUser.email?.toLowerCase() || '',
        toId: partnerEmail,
        status: 'pending',
        timestamp: serverTimestamp()
      };
      
      console.log("Sending to Firestore:", quizData);
      await addDoc(collection(db, 'quizzes'), quizData);

      // Set 1 second cooldown after submission
      await updateDoc(doc(db, 'pet', 'frosh'), {
        cooldownUntil: new Date(Date.now() + 1000)
      });

      setNewQuestion('');
      setNewAnswer('');
      setIsAsking(false);
      showStatus("Вопрос отправлен!", 'success');
      console.log("Submission successful");
    } catch (e) {
      console.error("Critical error in submitQuestion:", e);
      showStatus("Ошибка при отправке: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAnswer = async (quiz: QuizQuestion) => {
    const input = answerInputs[quiz.id!] || '';
    if (!input.trim()) return;

    const isCorrect = input.toLowerCase().trim() === quiz.answer;
    const quizRef = doc(db, 'quizzes', quiz.id!);

    if (isCorrect) {
      await updateDoc(quizRef, { status: 'correct' });
      await updateDoc(doc(db, 'pet', 'frosh'), {
        foodAvailable: increment(1)
      });
      setAnswerInputs(prev => {
        const next = { ...prev };
        delete next[quiz.id!];
        return next;
      });
    } else {
      await updateDoc(quizRef, { status: 'incorrect' });
      // Set cooldown: 1 second
      await updateDoc(doc(db, 'pet', 'frosh'), {
        cooldownUntil: new Date(Date.now() + 1000)
      });
      setAnswerInputs(prev => {
        const next = { ...prev };
        delete next[quiz.id!];
        return next;
      });
      alert("Неправильно! Фрош расстроен, придется подождать.");
    }
  };

  const feedPet = async () => {
    if (!pet || pet.foodAvailable <= 0 || pet.isSleeping || isEating) return;
    
    setIsEating(true);
    if (!pet.isGone) setPetPosition('table');
    
    // Update hunger after 3 seconds of eating
    setTimeout(async () => {
      const newHunger = Math.min(100, pet.hunger + 30);
      const updateData: any = {
        hunger: newHunger,
        foodAvailable: increment(-1),
        lastFed: serverTimestamp()
      };

      // If was gone and now fed, return home
      if (pet.isGone && newHunger > 0) {
        updateData.isGone = false;
        updateData.forestStayStart = null;
        updateData.hungerZeroStart = null;
        updateData.energy = 50; // Give some energy on return
      }

      await updateDoc(doc(db, 'pet', 'frosh'), {
        ...updateData
      });
      setIsEating(false);
      setPetPosition('center');
    }, 3000);
  };

  const toggleSleep = async () => {
    if (!pet || isEating) return;
    const newIsSleeping = !pet.isSleeping;
    
    if (newIsSleeping) {
      setPetPosition('bed');
    } else {
      setPetPosition('center');
    }

    await updateDoc(doc(db, 'pet', 'frosh'), {
      isSleeping: newIsSleeping,
      lastSlept: newIsSleeping ? serverTimestamp() : pet.lastSlept,
      lastWokeUp: !newIsSleeping ? serverTimestamp() : pet.lastWokeUp
    });
  };

  useEffect(() => {
    if (pet?.isSleeping) {
      setPetPosition('bed');
    } else if (!isEating) {
      setPetPosition('center');
    }
  }, [pet?.isSleeping]);

  const returnHome = async () => {
    if (!pet?.isGone) return;
    
    const now = Date.now();
    const stayStartMillis = pet.forestStayStart?.toMillis?.() || now;
    const hoursInForest = (now - stayStartMillis) / (1000 * 60 * 60);

    if (hoursInForest < 24 && pet.hunger === 0) {
      alert(`Фрош еще слишком обижен и не хочет возвращаться. Попробуйте покормить его или подождать (прошло ${Math.floor(hoursInForest)}ч из 24ч).`);
      return;
    }

    await updateDoc(doc(db, 'pet', 'frosh'), {
      isGone: false,
      hunger: Math.max(20, pet.hunger),
      energy: 50,
      lastFed: serverTimestamp(),
      lastSlept: serverTimestamp(),
      forestStayStart: null,
      hungerZeroStart: null
    });
  };

  if (loading) return null;

  const getEmotion = () => {
    if (!pet) return 'happy';
    if (pet.isGone) return 'sad';
    if (pet.isSleeping) return 'sleeping';
    if (pet.hunger < 30) return 'hungry';
    if (pet.energy < 30) return 'tired';
    return 'happy';
  };

  const emotion = getEmotion();

  return (
    <div className={`min-h-screen transition-colors duration-1000 ${pet?.isSleeping ? 'bg-indigo-950' : pet?.isGone ? 'bg-emerald-900' : 'bg-amber-50'} p-4 flex flex-col items-center`}>
      {/* Debug Button - Temporary for testing */}
      <button 
        onClick={async () => {
          await updateDoc(doc(db, 'pet', 'frosh'), {
            isGone: true,
            hunger: 0,
            forestStayStart: serverTimestamp()
          });
        }}
        className="fixed top-20 right-4 z-[9999] p-4 bg-red-600 text-white text-xs rounded-2xl uppercase font-black shadow-2xl border-4 border-white animate-pulse"
      >
        В ЛЕС (DEBUG)
      </button>
      {/* Stats with Glassmorphism */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-10 px-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/30 backdrop-blur-2xl p-6 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/40 relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100/50 rounded-2xl">
                <Utensils className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500/80">Сытость</span>
            </div>
            <div className="h-3 bg-stone-200/30 rounded-full overflow-hidden border border-white/20 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pet?.hunger}%` }}
                className={`h-full ${pet?.hunger! < 30 ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 'bg-gradient-to-r from-orange-300 to-orange-500'} transition-all duration-1000`}
              />
            </div>
            <div className="mt-4 flex justify-between items-end">
              <span className="text-3xl font-black text-stone-800 tracking-tighter">{Math.round(pet?.hunger!)}%</span>
              <div className="flex items-center gap-1 bg-white/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/40 shadow-sm">
                <span className="text-[10px] font-black text-orange-600">{pet?.foodAvailable}</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/30 backdrop-blur-2xl p-6 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/40 relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-indigo-100/50 rounded-2xl">
                <Moon className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500/80">Энергия</span>
            </div>
            <div className="h-3 bg-stone-200/30 rounded-full overflow-hidden border border-white/20 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pet?.energy}%` }}
                className={`h-full ${pet?.energy! < 30 ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-600'} transition-all duration-1000`}
              />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-stone-800 tracking-tighter">{Math.round(pet?.energy!)}%</span>
            </div>
          </motion.div>
        </div>

      {/* Environment */}
      <div className="relative w-full max-w-4xl h-[650px] flex items-center justify-center overflow-hidden rounded-[48px] shadow-2xl border-[12px] border-white/90 backdrop-blur-sm">
        <AnimatePresence mode="wait">
          {pet?.isGone ? (
            <motion.div 
              key="forest"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#020617] flex flex-col overflow-hidden"
            >
              {/* Realistic Wild Forest Background */}
              <div className="absolute inset-0">
                {/* Sky */}
                <div className={`absolute inset-0 bg-gradient-to-b ${pet?.isSleeping ? 'from-[#020617] via-[#000000] to-[#000000]' : 'from-sky-300 via-emerald-400 to-emerald-800'} transition-colors duration-1000`} />
                
                {/* Sky Elements (Sun/Moon) */}
                <AnimatePresence mode="wait">
                  {!pet?.isSleeping ? (
                    <motion.div 
                      key="sun"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 50 }}
                      className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none"
                    >
                      <Sun className="w-20 h-20 text-yellow-300/40 blur-[1px]" />
                      <motion.div 
                        animate={{ x: [-20, 100] }} 
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }} 
                        className="absolute top-10 -left-40"
                      >
                        <Cloud className="w-16 h-16 text-white/40" />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="moon"
                      initial={{ opacity: 0, y: -50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      <Moon className="absolute top-12 left-1/2 -translate-x-1/2 w-16 h-16 text-yellow-100/20 blur-[2px]" />
                      <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 3, repeat: Infinity }} className="absolute top-20 left-1/4"><Sparkles className="w-4 h-4 text-yellow-100/20" /></motion.div>
                      <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-32 right-1/4"><Sparkles className="w-3 h-3 text-yellow-100/10" /></motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Night Overlay for Forest */}
                <motion.div 
                  animate={{ opacity: pet?.isSleeping ? 0.4 : 0 }}
                  className="absolute inset-0 bg-indigo-950/60 pointer-events-none z-50"
                />
                
                {/* Mist/Fog Layer */}
                <motion.div 
                  animate={{ x: [-200, 200] }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-white/5 blur-[80px] pointer-events-none"
                />

                {/* Distant Trees (Layer 1) */}
                <div className={`absolute bottom-64 inset-x-0 flex justify-around ${pet?.isSleeping ? 'opacity-10' : 'opacity-30'} transition-opacity duration-1000 pointer-events-none`}>
                  {[...Array(15)].map((_, i) => (
                    <div key={i} className="relative">
                      <TreePine 
                        fill="currentColor"
                        className={`w-32 h-32 ${pet?.isSleeping ? 'text-black' : 'text-emerald-900'} -mb-10 transform scale-${(i % 4 + 1) * 60}`} 
                      />
                      <div className="absolute top-0 left-1/2 w-1 h-20 bg-black/40 -translate-x-1/2 blur-sm" />
                    </div>
                  ))}
                </div>

                {/* Mid Trees (Layer 2) */}
                <div className={`absolute bottom-56 inset-x-0 flex justify-around ${pet?.isSleeping ? 'opacity-20' : 'opacity-50'} transition-opacity duration-1000 pointer-events-none`}>
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="relative">
                      <TreePine 
                        fill="currentColor"
                        className={`w-40 h-40 ${pet?.isSleeping ? 'text-[#050C07]' : 'text-emerald-950'} -mb-10 transform scale-${(i % 3 + 1) * 90}`} 
                      />
                      <div className="absolute top-4 left-1/2 w-2 h-24 bg-black/60 -translate-x-1/2 blur-md" />
                    </div>
                  ))}
                </div>

                {/* Bats Animation (Night only) */}
                <AnimatePresence>
                  {pet?.isSleeping && [...Array(6)].map((_, i) => (
                    <motion.div
                      key={`bat-${i}`}
                      initial={{ x: -100, y: 50 + Math.random() * 250, opacity: 0 }}
                      animate={{ 
                        x: [ -100, 1000 ],
                        y: [ 50 + Math.random() * 250, 150 + Math.random() * 150, 50 + Math.random() * 250 ],
                        opacity: 1
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ 
                        duration: 8 + Math.random() * 12, 
                        repeat: Infinity, 
                        delay: i * 3,
                        ease: "linear"
                      }}
                      className="absolute z-10 pointer-events-none"
                    >
                      <motion.div
                        animate={{ rotateY: [0, 180, 0], scaleY: [1, 0.4, 1] }}
                        transition={{ duration: 0.25, repeat: Infinity }}
                      >
                        <svg width="30" height="15" viewBox="0 0 24 12" className="text-black fill-current opacity-90">
                          <path d="M12 2c-2 0-4 2-6 2-2 0-4-2-6-2 0 4 2 8 6 8 2 0 4-2 6-2s4 2 6 2c4 0 6-4 6-8-2 0-4 2-6 2z" />
                        </svg>
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Ground */}
                <div className={`absolute bottom-0 inset-x-0 h-48 ${pet?.isSleeping ? 'bg-[#020617]' : 'bg-[#064e3b]'} border-t-8 ${pet?.isSleeping ? 'border-[#050C07]' : 'border-[#065f46]'} transition-colors duration-1000`}>
                  <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")' }} />
                  {/* Grass Tufts */}
                  <div className="absolute top-0 inset-x-0 flex justify-around">
                    {[...Array(30)].map((_, i) => (
                      <div key={i} className={`w-1.5 h-6 ${pet?.isSleeping ? 'bg-[#0A1A0F]' : 'bg-[#065f46]'} rounded-full -mt-3 opacity-60 rotate-[15deg] transition-colors duration-1000`} />
                    ))}
                  </div>
                </div>

                {/* River (Table Replacement) */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={feedPet}
                  disabled={pet?.foodAvailable === 0 || pet?.isSleeping || isEating}
                  className="absolute bottom-6 right-12 w-72 h-36 group cursor-pointer disabled:opacity-50 z-20"
                >
                  {/* River Water */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 rounded-[100%] border-4 border-blue-400/20 shadow-2xl overflow-hidden">
                    <motion.div 
                      animate={{ x: [-150, 150] }} 
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 opacity-20"
                    >
                      <Waves className="w-full h-full text-blue-300" />
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  
                  {/* Fish jumping animation when food available */}
                  <AnimatePresence>
                    {pet?.foodAvailable! > 0 && !isEating && (
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }} animate={{ y: [20, -30, 20], opacity: 1 }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="absolute top-0 left-1/2 -translate-x-1/2"
                      >
                        <Fish className="w-10 h-10 text-blue-200 drop-shadow-lg" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] text-white font-bold uppercase tracking-widest border border-white/10">
                    Поймать рыбу
                  </div>
                </motion.button>

                {/* Hay Wagon (Bed Replacement) */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleSleep}
                  className="absolute bottom-6 left-12 w-72 h-44 group cursor-pointer z-20"
                >
                  {/* Wagon Base */}
                  <div className="absolute bottom-2 w-full h-20 bg-[#2D1B18] rounded-lg border-b-4 border-black/60 shadow-2xl overflow-hidden">
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
                  </div>
                  {/* Wheels */}
                  <div className="absolute bottom-0 left-6 w-14 h-14 bg-[#1A0F0E] rounded-full border-4 border-[#2D1B18] flex items-center justify-center">
                    <div className="w-1.5 h-full bg-[#2D1B18] rotate-45" />
                    <div className="w-1.5 h-full bg-[#2D1B18] -rotate-45" />
                  </div>
                  <div className="absolute bottom-0 right-6 w-14 h-14 bg-[#1A0F0E] rounded-full border-4 border-[#2D1B18] flex items-center justify-center">
                    <div className="w-1.5 h-full bg-[#2D1B18] rotate-45" />
                    <div className="w-1.5 h-full bg-[#2D1B18] -rotate-45" />
                  </div>
                  
                  {/* Realistic Hay Pile */}
                  <div className="absolute bottom-12 left-2 right-2 h-32 bg-[#FCD34D] rounded-t-[80%] border-t-4 border-[#F59E0B] shadow-inner overflow-hidden">
                    {/* Hay Texture - Individual Strands */}
                    <div className="absolute inset-0 opacity-70">
                      {[...Array(60)].map((_, i) => (
                        <div 
                          key={i} 
                          className="absolute bg-[#B45309] opacity-30"
                          style={{
                            width: '1.5px',
                            height: `${15 + Math.random() * 25}px`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            transform: `rotate(${Math.random() * 360}deg)`
                          }}
                        />
                      ))}
                    </div>
                    {/* Highlights */}
                    <div className="absolute top-3 left-1/4 w-1/2 h-6 bg-white/30 blur-xl rounded-full" />
                    <div className="absolute bottom-0 w-full h-1/2 bg-black/20" />
                  </div>

                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] text-white font-bold uppercase tracking-widest border border-white/10">
                    Отдохнуть в сене
                  </div>
                </motion.button>

                {/* Floating Particles/Fireflies */}
                {[...Array(15)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -40, 0], 
                      x: [0, 20, 0],
                      opacity: [0.1, 0.6, 0.1] 
                    }}
                    transition={{ 
                      duration: 4 + Math.random() * 3, 
                      repeat: Infinity, 
                      delay: Math.random() * 5 
                    }}
                    className="absolute w-1.5 h-1.5 bg-yellow-100 rounded-full blur-[2px]"
                    style={{ 
                      top: `${10 + Math.random() * 70}%`, 
                      left: `${Math.random() * 100}%` 
                    }}
                  />
                ))}
              </div>

              {/* Forest UI Overlays */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none">
                <p className="text-xl font-black text-white drop-shadow-lg uppercase tracking-tighter">Дикий лес</p>
                <div className="flex gap-2 mt-2">
                  <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                    <Utensils className="w-3 h-3 text-orange-400" />
                    <span className="text-[10px] font-bold text-white">{pet?.foodAvailable}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="house"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col"
            >
              {/* Realistic Room Background with Perspective */}
              <div className={`flex-1 ${pet?.isSleeping ? 'bg-slate-900' : 'bg-[#FDF6E3]'} relative transition-colors duration-1000 overflow-hidden`}>
                {/* Volumetric Lighting from Window */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[600px] bg-gradient-to-b ${pet?.isSleeping ? 'from-indigo-500/10' : 'from-yellow-400/20'} to-transparent rotate-[15deg] blur-3xl pointer-events-none`} />
                
                {/* Wall Texture */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/pinstripe.png")' }} />
                
                {/* Side Walls for Volume */}
                <div className="absolute inset-y-0 left-0 w-12 bg-black/5" />
                <div className="absolute inset-y-0 right-0 w-12 bg-black/5" />
                
                {/* Picture Frame */}
                <div className="absolute top-20 left-16 w-24 h-32 bg-stone-800 p-2 rounded-sm shadow-xl rotate-[-2deg]">
                  <div className="w-full h-full bg-gradient-to-t from-emerald-400 to-sky-300 rounded-sm overflow-hidden relative">
                    <div className="absolute bottom-0 w-full h-1/2 bg-emerald-600/40" />
                    <div className="absolute top-4 right-4 w-4 h-4 bg-yellow-100 rounded-full blur-[1px]" />
                  </div>
                </div>

                {/* Wall Clock */}
                <div className="absolute top-24 right-20 w-20 h-20 bg-white rounded-full border-4 border-stone-800 shadow-lg flex items-center justify-center">
                  {/* Hour Hand */}
                  <div className="w-1.5 h-6 bg-stone-800 rounded-full absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom rotate-[45deg]" />
                  {/* Minute Hand */}
                  <div className="w-1 h-8 bg-stone-800 rounded-full absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom rotate-[190deg]" />
                  {/* Center Dot */}
                  <div className="w-3 h-3 bg-stone-800 rounded-full z-10" />
                </div>

                {/* Ceiling Lamp */}
                <div className="absolute top-0 left-1/3 -translate-x-1/2 w-1 h-20 bg-stone-800">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-10 bg-stone-700 rounded-t-full shadow-xl">
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-4 ${pet?.isSleeping ? 'bg-indigo-300/20' : 'bg-yellow-200/60'} rounded-full blur-sm`} />
                  </div>
                </div>

                {/* Bookshelf */}
                <div className="absolute bottom-40 left-6 w-20 h-64 bg-[#5D4037] rounded-t-lg shadow-2xl border-r-4 border-black/10 z-0">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
                  {/* Shelves */}
                  {[40, 100, 160, 220].map((top) => (
                    <div key={top} style={{ top: `${top}px` }} className="absolute left-0 right-0 h-2 bg-black/20">
                      {/* Books */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <div className="w-2 h-10 bg-rose-500 rounded-sm" />
                        <div className="w-3 h-12 bg-indigo-500 rounded-sm" />
                        <div className="w-2 h-8 bg-emerald-500 rounded-sm" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Window */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-40 bg-white rounded-t-full border-4 border-stone-800 overflow-hidden shadow-inner z-0">
                  <div className={`absolute inset-0 ${pet?.isSleeping ? 'bg-indigo-950' : 'bg-sky-400'} transition-colors duration-1000`}>
                    {pet?.isSleeping ? (
                      <>
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity }} className="absolute top-4 right-4"><Sparkles className="w-4 h-4 text-yellow-200" /></motion.div>
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute bottom-10 left-4"><Sparkles className="w-2 h-2 text-yellow-200" /></motion.div>
                        <Moon className="absolute top-10 left-1/2 -translate-x-1/2 w-12 h-12 text-yellow-100" />
                      </>
                    ) : (
                      <>
                        <Sun className="absolute top-6 left-1/2 -translate-x-1/2 w-12 h-12 text-yellow-400" />
                        <motion.div animate={{ x: [-20, 100] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-10 -left-20"><Cloud className="w-12 h-12 text-white/80" /></motion.div>
                      </>
                    )}
                  </div>
                  {/* Window Frame */}
                  <div className="absolute inset-0 border-t-4 border-stone-800/20" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-stone-800/20" />
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-800/20" />
                </div>
              </div>

              {/* Floor with Perspective */}
              <div className="h-48 bg-[#D2B48C] relative border-t-4 border-stone-800 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
                {/* Wood Grain Texture */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
                
                {/* Rug */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-80 h-24 bg-rose-400/80 backdrop-blur-sm rounded-[100%] border-2 border-white/20 shadow-2xl" />

                {/* Plant */}
                <div className="absolute -top-12 right-12 w-16 h-20 z-0">
                  <div className="absolute bottom-0 w-full h-12 bg-[#A0522D] rounded-b-xl border-b-4 border-black/20" />
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24">
                    <motion.div 
                      animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 4, repeat: Infinity }}
                      className="w-full h-full relative"
                    >
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-16 bg-emerald-800" />
                      <div className="absolute top-0 left-0 w-12 h-12 bg-emerald-500 rounded-full blur-[2px] opacity-80" />
                      <div className="absolute top-4 right-0 w-10 h-10 bg-emerald-600 rounded-full blur-[1px] opacity-80" />
                    </motion.div>
                  </div>
                </div>

                {/* Bed on Floor */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleSleep}
                  className="absolute -bottom-6 left-8 w-56 h-40 group cursor-pointer z-20"
                >
                  {/* Bed Shadow */}
                  <div className="absolute bottom-0 left-6 right-6 h-8 bg-black/20 rounded-full blur-md" />
                  
                  {/* Bed Base - Wooden texture */}
                  <div className="absolute bottom-2 w-full h-20 bg-[#8B4513] rounded-2xl border-b-4 border-black/30 shadow-lg overflow-hidden">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
                  </div>
                  
                  {/* Mattress/Blanket - Soft and textured */}
                  <div className="absolute bottom-8 left-2 right-2 h-20 bg-indigo-500 rounded-xl border-t-2 border-indigo-300 shadow-inner overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/fabric-of-squares.png")' }} />
                    {/* Folded part of blanket */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-600 rounded-l-3xl border-l-2 border-indigo-400" />
                  </div>
                  
                  {/* Pillow */}
                  <div className="absolute top-4 left-4 w-16 h-12 bg-white rounded-2xl border-b-4 border-stone-200 shadow-sm rotate-[-5deg]" />
                  
                  <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Moon className="w-8 h-8 text-indigo-200 drop-shadow-md" />
                  </div>
                </motion.button>

                {/* Table on Floor */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={feedPet}
                  disabled={pet?.foodAvailable === 0 || pet?.isSleeping || isEating}
                  className="absolute -bottom-6 right-12 w-44 h-36 group cursor-pointer disabled:opacity-50 z-20"
                >
                  {/* Table Shadow */}
                  <div className="absolute bottom-0 left-6 right-6 h-6 bg-black/20 rounded-full blur-md" />
                  
                  {/* Table Legs */}
                  <div className="absolute bottom-2 left-8 w-4 h-20 bg-[#5D4037] rounded-full border-r-2 border-black/20" />
                  <div className="absolute bottom-2 right-8 w-4 h-20 bg-[#5D4037] rounded-full border-l-2 border-black/20" />
                  
                  {/* Table Top - Wooden */}
                  <div className="absolute bottom-20 w-full h-8 bg-[#795548] rounded-2xl border-b-4 border-black/30 shadow-xl overflow-hidden">
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }} />
                  </div>
                  
                  {/* Plate */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-6 bg-white rounded-full border-b-4 border-stone-200 shadow-md" />
                  
                  {/* Food on table */}
                  <AnimatePresence>
                    {pet?.foodAvailable! > 0 && !isEating && (
                      <motion.div 
                        initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}
                        className="absolute -top-12 left-1/2 -translate-x-1/2"
                      >
                        <div className="relative">
                          <div className="absolute -inset-2 bg-orange-100/50 rounded-full blur-md" />
                          <Utensils className="w-12 h-12 text-orange-500 relative z-10 p-1 drop-shadow-lg" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pet Character */}
        {!pet?.isGone && (
          <motion.div
            animate={{ 
              x: pet?.isGone 
                ? (petPosition === 'table' ? 220 : petPosition === 'bed' ? -220 : 0)
                : (petPosition === 'table' ? 180 : petPosition === 'bed' ? -180 : 0),
              y: pet?.isGone
                ? 180
                : (petPosition === 'bed' ? 140 : 120),
              scale: pet?.isSleeping ? 0.85 : 1,
              rotate: pet?.isSleeping ? -5 : 0
            }}
            transition={{ 
              type: "spring",
              stiffness: 70,
              damping: 18
            }}
            className="absolute left-1/2 -translate-x-1/2 z-30"
          >
            {/* Pet Shadow on Floor */}
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black/20 rounded-full blur-md -z-10 transition-opacity duration-500 ${pet?.isSleeping ? 'opacity-0' : 'opacity-100'}`} />
            
            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 backdrop-blur-md px-4 py-1.5 rounded-full shadow-2xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap z-40 border-2 transition-colors duration-500 ${
              pet?.isGone 
                ? 'bg-black/60 text-white border-white/30' 
                : 'bg-white/80 text-stone-800 border-stone-800'
            }`}>
              Фрош
            </div>
            <PetSVG emotion={emotion} isEating={isEating} isDirty={pet?.isGone} />
          </motion.div>
        )}
        
        {/* Forest Pet Character (When isGone) */}
        {pet?.isGone && (
          <motion.div
            animate={{ 
              x: petPosition === 'table' ? 220 : petPosition === 'bed' ? -220 : 0,
              y: petPosition === 'bed' ? 100 : 180,
              scale: pet?.isSleeping ? 0.85 : 1,
              rotate: pet?.isSleeping ? -5 : 0
            }}
            transition={{ 
              type: "spring",
              stiffness: 70,
              damping: 18
            }}
            className="absolute left-1/2 -translate-x-1/2 z-30"
          >
            {/* Pet Shadow on Floor */}
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black/20 rounded-full blur-md -z-10 transition-opacity duration-500 ${pet?.isSleeping ? 'opacity-0' : 'opacity-100'}`} />
            
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-5 py-1.5 rounded-full shadow-2xl text-[12px] font-black uppercase tracking-[0.3em] text-white border-2 border-white/30 whitespace-nowrap z-40">
              Фрош
            </div>
            <PetSVG emotion={emotion} isEating={isEating} isDirty={true} />
          </motion.div>
        )}
      </div>

      {/* Actions (Removed old buttons, only Quiz remains) */}

      {/* Status Message */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2 whitespace-nowrap ${
              statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz Section */}
      <div className="w-full max-w-md mt-8 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Добыть еду</h3>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  await updateDoc(doc(db, 'pet', 'frosh'), {
                    cooldownUntil: new Date(0)
                  });
                  showStatus("Кулдаун сброшен!", 'success');
                }}
                className="text-[10px] uppercase tracking-widest text-stone-400 font-bold hover:text-stone-600"
              >
                Сбросить таймер
              </button>
              <button 
                onClick={() => setIsAsking(!isAsking)}
                className="text-[10px] uppercase tracking-widest text-rose-500 font-bold hover:underline"
              >
                {isAsking ? 'Отмена' : 'Задать вопрос'}
              </button>
            </div>
          </div>

          {isAsking && (
            <div className="bg-white p-6 rounded-[32px] shadow-lg border border-stone-100 relative z-20 mt-4">
              <div className="space-y-4">
                <input 
                  placeholder="Твой вопрос..."
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-200"
                />
                <input 
                  placeholder="Правильный ответ..."
                  value={newAnswer}
                  onChange={e => setNewAnswer(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button 
                  type="button"
                  onClick={() => {
                    console.log("Button clicked manually - Send Question");
                    submitQuestion();
                  }}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-stone-800 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer relative z-30 shadow-lg"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSubmitting ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Quizzes */}
          {quizzes.filter(q => q.toId === currentUser?.email?.toLowerCase()).map(quiz => (
            <motion.div
              key={quiz.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-[32px] shadow-lg border border-stone-100 space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-500">
                <HelpCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Вопрос от партнера</span>
              </div>
              <p className="font-serif text-lg text-stone-800 italic">«{quiz.text}»</p>
              <div className="flex gap-2">
                <input 
                  placeholder="Твой ответ..."
                  value={answerInputs[quiz.id!] || ''}
                  onChange={e => setAnswerInputs(prev => ({ ...prev, [quiz.id!]: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button 
                  onClick={() => submitAnswer(quiz)}
                  className="p-3 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-all"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}

          {quizzes.length === 0 && !isAsking && (
            <div className="text-center py-8 text-stone-400 italic text-sm">
              Нет активных вопросов. Задай один, чтобы получить еду!
            </div>
          )}
      </div>
    </div>
  );
}

function PetSVG({ emotion, isEating, isDirty }: { emotion: string, isEating?: boolean, isDirty?: boolean }) {
  const isSleeping = emotion === 'sleeping';

  return (
    <svg width="220" height="220" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="furGradient" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stopColor="#FDE68A" /> {/* Ginger cat color */}
          <stop offset="100%" stopColor="#D97706" />
        </radialGradient>
        <radialGradient id="mudGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4B2C20" />
          <stop offset="100%" stopColor="#2D1B13" />
        </radialGradient>
        <radialGradient id="earGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FECACA" />
          <stop offset="100%" stopColor="#F87171" />
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="2" dy="4" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tail - Fluffy and expressive */}
      <motion.path
        d="M140 140C165 140 190 110 185 80C180 50 160 60 155 80"
        stroke="url(#furGradient)"
        strokeWidth="14"
        strokeLinecap="round"
        filter="url(#softShadow)"
        animate={{ 
          rotate: isSleeping ? [0, 5, 0] : [0, 15, -10, 0],
          scale: isSleeping ? 0.9 : 1
        }}
        transition={{ duration: isSleeping ? 4 : 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Body - More feline shape */}
      <motion.path 
        d={isSleeping 
          ? "M50 150C50 120 150 120 150 150C150 180 50 180 50 150Z" // Curled up
          : "M60 130C60 100 140 100 140 130C140 170 60 170 60 130Z"
        }
        fill="url(#furGradient)" 
        filter="url(#softShadow)"
        animate={{ 
          scaleY: isEating ? [1, 1.05, 1] : isSleeping ? [1, 1.03, 1] : [1, 1.02, 1],
          d: isSleeping 
            ? "M50 150C50 120 150 120 150 150C150 180 50 180 50 150Z" 
            : "M60 130C60 100 140 100 140 130C140 170 60 170 60 130Z"
        }}
        transition={{ 
          duration: isEating ? 0.4 : isSleeping ? 3 : 2, 
          repeat: Infinity,
          ease: isSleeping ? "easeInOut" : "linear"
        }}
      />

      {/* Mud Spots on Body */}
      {isDirty && (
        <>
          <circle cx="80" cy="140" r="8" fill="url(#mudGradient)" opacity="0.6" />
          <circle cx="120" cy="150" r="5" fill="url(#mudGradient)" opacity="0.5" />
          <circle cx="100" cy="160" r="6" fill="url(#mudGradient)" opacity="0.4" />
        </>
      )}

      {/* Legs - Tucked in when sleeping */}
      {!isSleeping && (
        <>
          <rect x="75" y="160" width="12" height="15" rx="6" fill="#B45309" />
          <rect x="113" y="160" width="12" height="15" rx="6" fill="#B45309" />
        </>
      )}
      
      {/* Arms/Front Paws */}
      <motion.rect 
        x={isSleeping ? "70" : "65"} y={isSleeping ? "145" : "135"} 
        width="14" height="20" rx="7" fill="#B45309"
        animate={{ 
          rotate: isEating ? [-20, -40, -20] : isSleeping ? 10 : 0,
          y: isEating ? [135, 125, 135] : isSleeping ? 145 : 135
        }}
      />
      <motion.rect 
        x={isSleeping ? "115" : "121"} y={isSleeping ? "145" : "135"} 
        width="14" height="20" rx="7" fill="#B45309"
        animate={{ 
          rotate: isEating ? [20, 40, 20] : isSleeping ? -10 : 0,
          y: isEating ? [135, 125, 135] : isSleeping ? 145 : 135
        }}
      />
      
      {/* Head */}
      <motion.g
        animate={{ 
          y: isEating ? [-4, 4, -4] : isSleeping ? [15, 17, 15] : 0,
          x: isSleeping ? 5 : 0,
          rotate: isSleeping ? 5 : emotion === 'happy' ? [0, 2, -2, 0] : 0
        }}
        transition={{ 
          duration: isEating ? 0.4 : isSleeping ? 3 : 2, 
          repeat: Infinity,
          ease: isSleeping ? "easeInOut" : "linear"
        }}
      >
        {/* Ears - Triangular and detailed */}
        <path d="M65 65L50 20L95 55Z" fill="url(#furGradient)" />
        <path d="M70 60L60 35L85 55Z" fill="url(#earGradient)" opacity="0.6" />
        
        <path d="M135 65L150 20L105 55Z" fill="url(#furGradient)" />
        <path d="M130 60L140 35L115 55Z" fill="url(#earGradient)" opacity="0.6" />

        {/* Face */}
        <circle cx="100" cy="75" r="45" fill="url(#furGradient)" filter="url(#softShadow)" />
        
        {/* Mud Spots on Face */}
        {isDirty && (
          <>
            <circle cx="70" cy="55" r="4" fill="url(#mudGradient)" opacity="0.5" />
            <circle cx="130" cy="85" r="6" fill="url(#mudGradient)" opacity="0.4" />
          </>
        )}

        {/* Eyes */}
        {isSleeping ? (
          <>
            <path d="M75 75C75 75 82 70 90 75" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
            <path d="M110 75C110 75 117 70 125 75" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="80" cy="70" r="12" fill="white" />
            <motion.circle 
              cx="80" cy="70" r="7" fill="#111"
              animate={{ x: isEating ? [0, 1, -1, 0] : [0, 2, 0, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <circle cx="80" cy="66" r="3" fill="white" opacity="0.8" />
            
            <circle cx="120" cy="70" r="12" fill="white" />
            <motion.circle 
              cx="120" cy="70" r="7" fill="#111"
              animate={{ x: isEating ? [0, 1, -1, 0] : [0, 2, 0, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <circle cx="120" cy="66" r="3" fill="white" opacity="0.8" />
          </>
        )}

        {/* Nose */}
        <path d="M97 85C97 85 100 90 103 85" stroke="#F87171" strokeWidth="3" strokeLinecap="round" />

        {/* Muzzle/Cheeks */}
        <circle cx="92" cy="92" r="8" fill="white" fillOpacity="0.2" />
        <circle cx="108" cy="92" r="8" fill="white" fillOpacity="0.2" />

        {/* Whiskers - Long and thin */}
        <path d="M70 90H30" stroke="#451A03" strokeWidth="0.5" strokeOpacity="0.4" />
        <path d="M70 95H35" stroke="#451A03" strokeWidth="0.5" strokeOpacity="0.4" />
        <path d="M130 90H170" stroke="#451A03" strokeWidth="0.5" strokeOpacity="0.4" />
        <path d="M130 95H165" stroke="#451A03" strokeWidth="0.5" strokeOpacity="0.4" />

        {/* Mouth */}
        {emotion === 'happy' && !isEating && (
          <path d="M90 95C90 95 100 105 110 95" stroke="#451A03" strokeWidth="2" strokeLinecap="round" />
        )}
        {(emotion === 'sad' || emotion === 'hungry' || emotion === 'tired') && (
          <path d="M90 105C90 105 100 95 110 105" stroke="#451A03" strokeWidth="2" strokeLinecap="round" />
        )}
        {isEating && (
          <motion.circle 
            cx="100" cy="100" r="6" fill="#451A03"
            animate={{ scale: [1, 1.5, 1] }}
          />
        )}
      </motion.g>

      {/* Sleeping Zs */}
      {isSleeping && (
        <motion.g
          animate={{ opacity: [0, 1, 0], y: [0, -40], x: [0, 20] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <text x="160" y="50" fill="#D97706" className="text-2xl font-black italic">Z</text>
          <text x="175" y="30" fill="#D97706" className="text-xl font-black italic">z</text>
        </motion.g>
      )}
    </svg>
  );
}
