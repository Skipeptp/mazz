import React, { useState, useEffect } from 'react';
import { db, auth, doc, onSnapshot, updateDoc, setDoc, collection, addDoc, query, where, orderBy, limit, serverTimestamp, increment } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, Moon, Sun, HelpCircle, Send, Check, X, Home, TreePine, AlertCircle, Coffee, CheckCircle2 } from 'lucide-react';
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
          lastWokeUp: serverTimestamp()
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
    if (currentPet.isGone) return;

    const now = Date.now();
    const lastUpdate = currentPet.lastWokeUp?.toMillis?.() || currentPet.lastSlept?.toMillis?.() || now;
    const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);

    if (hoursPassed < 0.1) return; // Only update every 6 mins

    let newHunger = Math.max(0, currentPet.hunger - (HUNGER_DECAY_RATE * hoursPassed));
    let newEnergy = currentPet.energy;

    if (currentPet.isSleeping) {
      newEnergy = Math.min(100, currentPet.energy + (SLEEP_RECOVERY_RATE * hoursPassed));
      if (newEnergy >= 100) {
        // Wake up automatically if fully rested
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

    // Check for neglect
    const lastFedTime = currentPet.lastFed?.toMillis?.() || now;
    const lastSleptTime = currentPet.lastSlept?.toMillis?.() || now;
    const hoursSinceFed = (now - lastFedTime) / (1000 * 60 * 60);
    const hoursSinceSlept = (now - lastSleptTime) / (1000 * 60 * 60);

    let isGone = currentPet.isGone;
    if (hoursSinceFed > NEGLECT_THRESHOLD || hoursSinceSlept > NEGLECT_THRESHOLD) {
      isGone = true;
    }

    await updateDoc(doc(db, 'pet', 'frosh'), {
      hunger: newHunger,
      energy: newEnergy,
      isGone
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
    if (!pet || pet.foodAvailable <= 0 || pet.isGone || pet.isSleeping) return;
    await updateDoc(doc(db, 'pet', 'frosh'), {
      hunger: Math.min(100, pet.hunger + 30),
      foodAvailable: increment(-1),
      lastFed: serverTimestamp()
    });
  };

  const toggleSleep = async () => {
    if (!pet || pet.isGone) return;
    const newIsSleeping = !pet.isSleeping;
    await updateDoc(doc(db, 'pet', 'frosh'), {
      isSleeping: newIsSleeping,
      lastSlept: newIsSleeping ? serverTimestamp() : pet.lastSlept,
      lastWokeUp: !newIsSleeping ? serverTimestamp() : pet.lastWokeUp
    });
  };

  const returnHome = async () => {
    if (!pet?.isGone) return;
    await updateDoc(doc(db, 'pet', 'frosh'), {
      isGone: false,
      hunger: 50,
      energy: 50,
      lastFed: serverTimestamp(),
      lastSlept: serverTimestamp()
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
    <div className={`min-h-screen transition-colors duration-1000 ${pet?.isGone ? 'bg-emerald-900' : pet?.isSleeping ? 'bg-indigo-950' : 'bg-amber-50'} p-4 flex flex-col items-center`}>
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Utensils className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white">{Math.round(pet?.hunger || 0)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Coffee className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-white">{Math.round(pet?.energy || 0)}%</span>
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 text-white font-bold">
          Еда: {pet?.foodAvailable || 0}
        </div>
      </div>

      {/* Environment */}
      <div className="relative w-full max-w-md h-80 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {pet?.isGone ? (
            <motion.div 
              key="forest"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-emerald-100"
            >
              <TreePine className="w-64 h-64 opacity-20 absolute" />
              <p className="text-xl font-serif italic mb-4">Фрош ушел в лес...</p>
              <button 
                onClick={returnHome}
                className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full border border-white/30 backdrop-blur-md transition-all"
              >
                Позвать домой
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="house"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Home className="w-64 h-64 opacity-10 text-stone-800" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pet Character */}
        {!pet?.isGone && (
          <motion.div
            animate={{ 
              y: pet?.isSleeping ? 10 : [0, -10, 0],
              scale: pet?.isSleeping ? 0.9 : 1
            }}
            transition={{ 
              y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            className="relative z-10"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold uppercase tracking-widest">
              Фрош
            </div>
            <PetSVG emotion={emotion} />
          </motion.div>
        )}
      </div>

      {/* Actions */}
      {!pet?.isGone && (
        <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-8">
          <button
            onClick={feedPet}
            disabled={pet?.foodAvailable === 0 || pet?.isSleeping}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-[32px] shadow-lg border border-stone-100 hover:bg-stone-50 transition-all disabled:opacity-50"
          >
            <Utensils className="w-8 h-8 text-orange-400 mb-2" />
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Покормить</span>
          </button>
          <button
            onClick={toggleSleep}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-[32px] shadow-lg border border-stone-100 hover:bg-stone-50 transition-all"
          >
            {pet?.isSleeping ? (
              <>
                <Sun className="w-8 h-8 text-amber-400 mb-2" />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Разбудить</span>
              </>
            ) : (
              <>
                <Moon className="w-8 h-8 text-indigo-400 mb-2" />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Уложить спать</span>
              </>
            )}
          </button>
        </div>
      )}

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
      {!pet?.isGone && (
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
      )}
    </div>
  );
}

function PetSVG({ emotion }: { emotion: string }) {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <motion.ellipse 
        cx="80" cy="100" rx="60" ry="50" 
        fill="#4ADE80" 
        animate={{ ry: emotion === 'sleeping' ? 45 : 50 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Eyes */}
      {emotion === 'sleeping' ? (
        <>
          <path d="M50 80C50 80 55 75 60 80" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
          <path d="M100 80C100 80 105 75 110 80" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="55" cy="75" r="12" fill="white" />
          <motion.circle 
            cx="55" cy="75" r="5" fill="black"
            animate={{ x: emotion === 'sad' ? 0 : [0, 2, 0, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <circle cx="105" cy="75" r="12" fill="white" />
          <motion.circle 
            cx="105" cy="75" r="5" fill="black"
            animate={{ x: emotion === 'sad' ? 0 : [0, 2, 0, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </>
      )}

      {/* Mouth */}
      {emotion === 'happy' && (
        <path d="M65 110C65 110 80 125 95 110" stroke="#166534" strokeWidth="4" strokeLinecap="round" />
      )}
      {emotion === 'sad' && (
        <path d="M65 120C65 120 80 110 95 120" stroke="#166534" strokeWidth="4" strokeLinecap="round" />
      )}
      {emotion === 'hungry' && (
        <circle cx="80" cy="115" r="8" stroke="#166534" strokeWidth="3" />
      )}
      {emotion === 'tired' && (
        <path d="M70 115H90" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      )}
      {emotion === 'sleeping' && (
        <motion.text 
          x="120" y="60" fill="#166534" className="text-xl font-bold"
          animate={{ opacity: [0, 1, 0], y: [0, -20] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Z
        </motion.text>
      )}

      {/* Cheeks */}
      {emotion === 'happy' && (
        <>
          <circle cx="40" cy="95" r="6" fill="#F87171" fillOpacity="0.4" />
          <circle cx="120" cy="95" r="6" fill="#F87171" fillOpacity="0.4" />
        </>
      )}
    </svg>
  );
}
