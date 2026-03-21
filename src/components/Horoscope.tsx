import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';
import { Sparkles, Moon, Sun, Star, RefreshCw, Heart, HelpCircle } from 'lucide-react';
import { db, doc, getDoc, setDoc } from '../firebase';

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

export default function Horoscope() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHoroscope = async () => {
    console.log("fetchHoroscope started");
    setLoading(true);
    setError(null);
    
    // Get local date in YYYY-MM-DD format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    console.log("Today's date:", today);
    
    try {
      // 1. Try to get from Firestore first
      const docRef = doc(db, 'horoscopes', today);
      console.log("Checking Firestore for doc:", today);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        console.log("Using cached horoscope for", today);
        setData(docSnap.data() as DailyData);
        setLoading(false);
        return;
      }

      // 2. If not found, fetch from Gemini
      console.log("Fetching new horoscope for", today);
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        console.error("Gemini API key is missing (checked GEMINI_API_KEY and API_KEY)");
        throw new Error("API ключ Gemini не настроен. Пожалуйста, убедитесь, что он добавлен в Secrets.");
      }

      const aiInstance = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      const randomSeed = Math.floor(Math.random() * 1000);
      const prompt = `Provide a detailed daily horoscope for today (${today}) for Virgo (Дева) and Aries (Овен) in Russian. 
      Also provide a special prediction for them as a couple (Дева + Овен).
      Also provide one unique, deep, and non-trivial question for the couple to discuss. 
      
      CRITICAL: The question must be highly diverse and different every time. 
      Random Seed: ${randomSeed}
      
      Rotate between these themes: 
      - Childhood memories and their impact.
      - Future dreams and "what if" scenarios.
      - Deep philosophical values.
      - Emotional intimacy and vulnerability.
      - Funny or absurd hypothetical situations.
      - Appreciation of small details in each other.
      Avoid clichés like "what is your favorite color" or "where do you see us in 5 years". 
      Make it something that sparks a real, 15-minute conversation.
      
      For each individual sign (Virgo and Aries), include:
      1. General prediction for the day.
      2. Lucky number.
      3. Lucky color.
      
      Return the data in JSON format:
      {
        "virgo": { "prediction": "...", "luckyNumber": "...", "luckyColor": "..." },
        "aries": { "prediction": "...", "luckyNumber": "...", "luckyColor": "..." },
        "couple": { "prediction": "..." },
        "question": "..."
      }`;

      console.log("Calling Gemini API...");
      const response = await aiInstance.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      console.log("Gemini raw response received");
      let result;
      try {
        result = JSON.parse(response.text || '{}');
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr, "Raw text:", response.text);
        throw new Error("Не удалось обработать ответ от звезд");
      }
      
      if (result.virgo && result.aries && result.couple && result.question) {
        const dailyData: DailyData = {
          date: today,
          virgo: { sign: 'Дева', ...result.virgo },
          aries: { sign: 'Овен', ...result.aries },
          couple: result.couple,
          question: result.question
        };
        
        console.log("Saving new horoscope to Firestore...");
        // Save to Firestore for everyone to see the same thing today
        await setDoc(docRef, dailyData);
        setData(dailyData);
      } else {
        console.error("Incomplete data from Gemini:", result);
        throw new Error("Не удалось получить полные данные гороскопа");
      }
    } catch (err) {
      console.error("Horoscope fetch error:", err);
      setError(err instanceof Error ? err.message : "Не удалось загрузить прогноз. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("Horoscope component mounted");
    fetchHoroscope();
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
          onClick={fetchHoroscope}
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
      <header className="text-center space-y-2">
        <h2 className="font-serif text-4xl text-stone-800">Звездный прогноз</h2>
        <p className="text-stone-500 italic">Обновляется раз в день • {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
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
