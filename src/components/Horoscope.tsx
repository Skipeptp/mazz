import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';
import { Sparkles, Moon, Sun, Star, RefreshCw, Heart, HelpCircle } from 'lucide-react';
import { db, auth, doc, getDoc, setDoc } from '../firebase';

interface HoroscopeData {
  sign: string;
  prediction: string;
  luckyNumber: string;
  luckyColor: string;
}

interface DailyData {
  date: string;
  virgo: HoroscopeData;
  aries: HoroscopeData;
  couple: {
    prediction: string;
  };
  question: string;
}

const QUESTIONS = [
  "Если бы мы могли прожить один день из нашего прошлого снова, какой бы ты выбрал(а)?",
  "Какое твое самое яркое воспоминание о нас из самого начала отношений?",
  "Если бы мы выиграли в лотерею завтра, что бы мы изменили в нашей жизни в первую очередь?",
  "Какое качество во мне ты ценишь больше всего, но редко об этом говоришь?",
  "Если бы мы могли переехать в любую точку мира на год, куда бы мы отправились?",
  "Что для тебя значит 'идеальный вечер' со мной?",
  "Какую суперсилу ты бы выбрал(а) для нас двоих?",
  "Если бы мы писали книгу о нашей любви, как бы называлась первая глава?",
  "О чем ты мечтаешь, когда не можешь уснуть?",
  "Какое маленькое действие с моей стороны заставляет тебя чувствовать себя любимым(ой)?",
  "Если бы мы могли пригласить любого исторического персонажа на ужин, кого бы мы выбрали?",
  "Что в наших отношениях делает тебя сильнее как личность?",
  "Какое приключение мы обязательно должны совершить в ближайшие 5 лет?",
  "Если бы мы могли обменяться телами на один день, что бы ты сделал(а) первым делом?",
  "Какое твое любимое место, где мы когда-либо были вместе?",
  "Если бы мы могли создать свой собственный праздник, как бы он назывался и как бы мы его отмечали?",
  "Что в нашем будущем пугает тебя меньше всего?",
  "Какую песню ты бы выбрал(а) как саундтрек к нашей сегодняшней неделе?",
  "Если бы мы могли научиться чему-то новому вместе за одну ночь, что бы это было?",
  "Какое твое любимое качество в нашем 'мы'?"
];

const COUPLE_PREDICTIONS = [
  "Сегодня идеальный день для того, чтобы просто побыть рядом. Звезды советуют отложить дела и насладиться тишиной вдвоем.",
  "Ваша энергия сегодня находится в полной гармонии. Любое совместное начинание принесет радость и успех.",
  "Маленький сюрприз или неожиданный комплимент сегодня сделают ваш вечер по-настоящему волшебным.",
  "Звезды предсказывают глубокий и важный разговор, который поможет вам стать еще ближе друг к другу.",
  "Сегодня отличный день для планирования будущего. Ваши мечты начинают обретать реальные очертания.",
  "Романтика витает в воздухе. Даже обычный ужин может превратиться в незабываемое свидание.",
  "Ваша поддержка друг друга сегодня будет особенно важна. Будьте внимательны к чувствам партнера.",
  "Звезды советуют добавить немного спонтанности в ваши отношения сегодня. Сделайте что-то необычное!",
  "Сегодня вы — отличная команда. Любые бытовые вопросы решатся легко и с улыбкой.",
  "Ваша связь сегодня крепче, чем когда-либо. Наслаждайтесь этим чувством защищенности и тепла."
];

export default function Horoscope() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const FALLBACK_TEXT = "Звезды сегодня благоволят вашим начинаниям. Прислушайтесь к интуиции — она подскажет верный путь к гармонии и успеху.";

  const generateHoroscopeWithAI = async (sign: string, isLove: boolean = false, apiKey: string): Promise<string> => {
    const signRu = sign === 'virgo' ? 'Дева' : 'Овен';
    const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    const tryGenerate = async (useSearch: boolean) => {
      const aiInstance = new GoogleGenAI({ apiKey });
      const model = "gemini-3.1-flash-lite-preview";
      
      const prompt = `Напиши актуальный гороскоп для знака ${signRu} на сегодня (${dateStr}). 
      ${isLove ? 'Это должен быть любовный гороскоп.' : 'Это должен быть общий гороскоп.'}
      Напиши вдохновляющий и реалистичный прогноз на русском языке.
      Объем: 2-3 предложения. Стиль: теплый, мудрый, немного загадочный.
      ${useSearch ? 'Используй поиск в интернете для получения актуальных данных о положении звезд.' : 'Основывайся на типичных чертах знака и общих астрологических тенденциях.'}`;

      const config: any = {};
      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await aiInstance.models.generateContent({
        model: model,
        contents: prompt,
        config: config
      });
      
      return response.text?.trim() || "";
    };

    try {
      // Сначала пробуем с поиском
      let text = await tryGenerate(true);
      if (text && text.length > 20) return text;
      
      // Если не вышло, пробуем без поиска
      text = await tryGenerate(false);
      if (text && text.length > 20) return text;
      
      throw new Error("Empty or short response from Gemini");
    } catch (err) {
      console.error(`Gemini generation failed for ${sign}:`, err);
      return FALLBACK_TEXT;
    }
  };

  const generateLuckyData = (sign: string, date: string) => {
    // Детерминированный рандом на основе даты и знака
    const seed = sign + date;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    
    const colors = ["Бирюзовый", "Изумрудный", "Золотистый", "Нежно-розовый", "Глубокий синий", "Лавандовый", "Терракотовый", "Серебристый", "Лимонный", "Коралловый"];
    const luckyNumber = (Math.abs(hash) % 99) + 1;
    const luckyColor = colors[Math.abs(hash) % colors.length];
    
    return { luckyNumber: String(luckyNumber), luckyColor };
  };

  const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    // Не пробрасываем ошибку дальше, чтобы не ломать UI, но логируем
  };

  const fetchHoroscope = async (forceRefresh: boolean = false) => {
    console.log("fetchHoroscope started", { forceRefresh });
    setLoading(true);
    setError(null);
    
    // Используем локальную дату для ключа, чтобы пользователи видели прогноз на свой "сегодня"
    const now = new Date();
    const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    try {
      // 1. Сначала проверяем Firestore (если не форсируем обновление)
      const docRef = doc(db, 'horoscopes', today);
      
      if (!forceRefresh) {
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (err) {
          handleFirestoreError(err, 'get', `horoscopes/${today}`);
        }
        
        if (docSnap && docSnap.exists()) {
          const existingData = docSnap.data() as DailyData;
          // Проверяем, что это не пустой объект и не заглушка
          if (existingData.virgo?.prediction && existingData.virgo.prediction !== FALLBACK_TEXT) {
            setData(existingData);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Если нет в базе или данные неполные, генерируем через Gemini
      console.log("Generating new horoscope for today...");
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      if (!apiKey) {
        throw new Error("API Key is missing. Пожалуйста, настройте ключи в Settings.");
      }

      const [virgoText, ariesText] = await Promise.all([
        generateHoroscopeWithAI('virgo', false, apiKey),
        generateHoroscopeWithAI('aries', false, apiKey)
      ]);

      const virgoLucky = generateLuckyData('virgo', today);
      const ariesLucky = generateLuckyData('aries', today);
      
      let finalCouplePrediction = "";
      let finalQuestion = "";

      try {
        const aiInstance = new GoogleGenAI({ apiKey });
        const model = "gemini-3.1-flash-lite-preview";
        const prompt = `На основе этих двух гороскопов:
        Дева: ${virgoText}
        Овен: ${ariesText}
        
        1. Напиши короткий (2-3 предложения) вдохновляющий прогноз для этой пары (Дева + Овен) на сегодня.
        2. Придумай один глубокий, необычный вопрос для их обсуждения сегодня, который поможет им стать ближе.
        
        Верни JSON: {"couple": "...", "question": "..."}`;

        const response = await aiInstance.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        
        const result = JSON.parse(response.text || '{}');
        finalCouplePrediction = result.couple || COUPLE_PREDICTIONS[Math.floor(Math.random() * COUPLE_PREDICTIONS.length)];
        finalQuestion = result.question || QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      } catch (aiErr) {
        console.warn("Gemini couple generation failed", aiErr);
        finalCouplePrediction = COUPLE_PREDICTIONS[Math.floor(Math.random() * COUPLE_PREDICTIONS.length)];
        finalQuestion = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      }

      const dailyData: DailyData = {
        date: today,
        virgo: { sign: 'Дева', prediction: virgoText, ...virgoLucky },
        aries: { sign: 'Овен', prediction: ariesText, ...ariesLucky },
        couple: { prediction: finalCouplePrediction },
        question: finalQuestion
      };
      
      // Сохраняем в Firestore только если мы получили реальные данные (не заглушки)
      if (virgoText !== FALLBACK_TEXT && ariesText !== FALLBACK_TEXT) {
        try {
          await setDoc(docRef, dailyData);
        } catch (dbErr) {
          handleFirestoreError(dbErr, 'write', `horoscopes/${today}`);
        }
      }
      
      setData(dailyData);

    } catch (err) {
      console.error("Horoscope fetch error:", err);
      setError(err instanceof Error ? err.message : "Не удалось загрузить прогноз.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("Horoscope component mounted");
    fetchHoroscope();

    // Проверка смены даты каждые 30 минут для автоматического обновления
    const interval = setInterval(() => {
      const now = new Date();
      const today = now.toLocaleDateString('en-CA');
      // Если компонент смонтирован и дата изменилась, обновляем
      setData(prev => {
        if (prev && prev.date !== today) {
          fetchHoroscope();
        }
        return prev;
      });
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-amber-400" />
        </motion.div>
        <p className="text-stone-500 font-serif italic">Звезды выстраиваются в ряд...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-rose-500 mb-4">{error || "Что-то пошло не так"}</p>
        <button 
          onClick={() => fetchHoroscope()}
          className="flex items-center gap-2 mx-auto px-6 py-2 bg-stone-800 text-white rounded-full hover:bg-stone-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 pb-12">
      <header className="text-center space-y-2 relative">
        <h2 className="font-serif text-4xl text-stone-800">Звездный прогноз</h2>
        <p className="text-stone-500 italic">Обновляется раз в день • {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
        <button 
          onClick={() => fetchHoroscope(true)}
          className="absolute top-0 right-0 p-2 text-stone-400 hover:text-amber-500 transition-colors"
          title="Обновить прогноз"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Individual Predictions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Virgo Card */}
        <HoroscopeCard data={data.virgo} icon={<Moon className="w-6 h-6 text-indigo-400" />} color="bg-indigo-50" />
        
        {/* Aries Card */}
        <HoroscopeCard data={data.aries} icon={<Sun className="w-6 h-6 text-orange-400" />} color="bg-orange-50" />
      </div>

      {/* Couple Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-rose-50 to-rose-100 p-8 rounded-[40px] shadow-xl border border-rose-200 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Heart className="w-24 h-24 text-rose-500 fill-rose-500" />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-white rounded-2xl shadow-sm">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          </div>
          <div>
            <h3 className="font-serif text-2xl text-stone-800">Для нас двоих</h3>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Общий путь сегодня</p>
          </div>
        </div>
        
        <p className="text-stone-700 leading-relaxed italic text-lg relative z-10">
          {data.couple.prediction}
        </p>
      </motion.div>

      {/* Question of the Day */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-8 rounded-[40px] shadow-lg border border-stone-100 flex flex-col items-center text-center space-y-4"
      >
        <div className="p-3 bg-amber-50 rounded-full">
          <HelpCircle className="w-6 h-6 text-amber-500" />
        </div>
        <h4 className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Вопрос дня для вас</h4>
        <p className="font-serif text-xl text-stone-800 italic">
          «{data.question}»
        </p>
      </motion.div>

      <footer className="text-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-stone-100 text-[10px] uppercase tracking-widest text-stone-400 font-bold">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>Звезды на вашей стороне</span>
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
        </div>
      </footer>
    </div>
  );
}

function HoroscopeCard({ data, icon, color }: { data: HoroscopeData, icon: React.ReactNode, color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-8 rounded-[40px] shadow-xl border border-white/50 ${color} relative overflow-hidden group`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-2xl shadow-sm">
          {icon}
        </div>
        <div>
          <h3 className="font-serif text-2xl text-stone-800">{data.sign}</h3>
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Личный прогноз</p>
        </div>
      </div>

      <div className="space-y-6">
        <p className="text-stone-700 leading-relaxed italic">
          {data.prediction}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/60 rounded-2xl backdrop-blur-sm">
            <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-1">Цвет дня</p>
            <p className="text-sm font-medium text-stone-700">{data.luckyColor}</p>
          </div>
          <div className="p-4 bg-white/60 rounded-2xl backdrop-blur-sm">
            <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-1">Число удачи</p>
            <p className="text-sm font-medium text-stone-700">{data.luckyNumber}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
