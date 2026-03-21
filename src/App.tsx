import React, { useState, useEffect, useRef } from 'react';
import { auth, onAuthStateChanged, signOut, db, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, handleFirestoreError, OperationType, getDocFromServer } from './firebase';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Notes from './components/Notes';
import Horoscope from './components/Horoscope';
import Pet from './components/Pet';
import { MessageCircle, StickyNote, LogOut, Heart, User, Smile, Edit3, List, Plus, Trash2, X, MapPin, Check, Sparkles, Ghost } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TierItem } from './types';

type Tab = 'chat' | 'notes' | 'profile' | 'horoscope' | 'pet';

const MOODS = ['😊', '🥰', '😴', '🤔', '😢', '😤', '🥳', '🤒', '😇', '😎'];
const TIERS: TierItem['tier'][] = ['S', 'A', 'B', 'C', 'D'];

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};


export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusInput, setStatusInput] = useState('');
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [viewingPartnerTierList, setViewingPartnerTierList] = useState(false);
  const [tierItemLabel, setTierItemLabel] = useState('');
  const [tierItemLevel, setTierItemLevel] = useState<TierItem['tier']>('S');

  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const unsubUserRef = useRef<(() => void) | null>(null);
  const unsubPartnerRef = useRef<(() => void) | null>(null);

  // Sync inputs with user data ONLY when starting to edit
  const startEditingStatus = () => {
    setStatusInput(user?.status || '');
    setIsEditingStatus(true);
  };

  const startEditingLocation = () => {
    setLocationInput(user?.location || '');
    setIsEditingLocation(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // Cleanup previous listeners if any
      unsubUserRef.current?.();
      unsubPartnerRef.current?.();
      unsubUserRef.current = null;
      unsubPartnerRef.current = null;

      if (u) {
        // Test connection when authenticated
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          console.log("Firestore connection test successful (authenticated)");
        } catch (error) {
          console.error("Firestore connection test failed (authenticated):", error);
        }
        const email = u.email?.toLowerCase();
        const WHITELIST = ['glebkarpuhin8@gmail.com', 'arhipovaaliena78@gmail.com'];
        if (!email || !WHITELIST.includes(email)) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', email);
        const legacyUserRef = doc(db, 'users', u.uid);
        
        // Migration & Initialization
        const setupUser = async () => {
          try {
            const emailDoc = await getDoc(userRef);
            if (!emailDoc.exists()) {
              const legacyDoc = await getDoc(legacyUserRef);
              if (legacyDoc.exists()) {
                console.log("Migrating legacy UID doc to email doc");
                await setDoc(userRef, { ...legacyDoc.data(), email });
                // We keep the legacy doc for a bit just in case, or delete it
                // await deleteDoc(legacyUserRef); 
              } else {
                console.log("Creating new email-based user doc");
                const systemAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
                await setDoc(userRef, {
                  email: email,
                  displayName: u.displayName || 'Пользователь',
                  photoURL: systemAvatar,
                  role: 'user',
                  mood: '😊',
                  status: '',
                  tierList: []
                });
              }
            } else {
              // Ensure email field exists even in email-based doc
              if (!emailDoc.data()?.email) {
                await updateDoc(userRef, { email });
              }
            }
          } catch (e) {
            console.error("User setup error:", e);
            handleFirestoreError(e, OperationType.WRITE, `users/${email}`);
          }
        };

        setupUser();

        // Listen to own profile (email-based)
        unsubUserRef.current = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const systemAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
            
            setUser({ 
              uid: docSnap.id, 
              ...data,
              displayName: data.displayName || u.displayName || 'Пользователь',
              photoURL: systemAvatar
            } as UserProfile);
          }
          setLoading(false);
        }, (e) => {
          console.error("User snapshot error:", e);
          handleFirestoreError(e, OperationType.GET, `users/${email}`);
          setLoading(false);
        });

        // Listen to partner profile (email-based)
        const partnerEmail = email === 'glebkarpuhin8@gmail.com' 
          ? 'arhipovaaliena78@gmail.com' 
          : 'glebkarpuhin8@gmail.com';
        
        console.log("Setting up direct listener for partner:", partnerEmail);
        const partnerRef = doc(db, 'users', partnerEmail);
        unsubPartnerRef.current = onSnapshot(partnerRef, (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data();
            console.log("Partner data found directly:", pData.displayName);
            const pSystemAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerEmail}`;
            setPartner({ 
              uid: docSnap.id, 
              ...pData,
              photoURL: pSystemAvatar
            } as UserProfile);
          } else {
            console.log("Partner document not found at", partnerEmail);
            setPartner(null);
          }
        }, (e) => {
          console.error("Partner snapshot error:", e);
          // Show error even if it's permission-denied to help debug
          handleFirestoreError(e, OperationType.GET, `users/${partnerEmail}`);
        });
      } else {
        setUser(null);
        setPartner(null);
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      unsubUserRef.current?.();
      unsubPartnerRef.current?.();
    };
  }, []);

  const updateMood = async (mood: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { mood });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateStatus = async () => {
    if (!user) return;
    setIsSavingStatus(true);
    const newStatus = statusInput;
    try {
      await updateDoc(doc(db, 'users', user.uid), { status: newStatus });
      setIsEditingStatus(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const updateLocation = async () => {
    if (!user) return;
    setIsSavingLocation(true);
    const newLocation = locationInput;
    try {
      await updateDoc(doc(db, 'users', user.uid), { location: newLocation });
      setIsEditingLocation(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const togglePooped = async () => {
    if (!user) return;
    const today = getTodayStr();
    const newDate = user.lastPoopedDate === today ? '' : today;
    try {
      await updateDoc(doc(db, 'users', user.uid), { lastPoopedDate: newDate });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addTierItem = async () => {
    if (!user || !tierItemLabel.trim()) return;
    const newItem: TierItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: tierItemLabel,
      tier: tierItemLevel
    };
    const newList = [...(user.tierList || []), newItem];
    setTierItemLabel('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { tierList: newList });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const removeTierItem = async (id: string) => {
    if (!user) return;
    const newList = (user.tierList || []).filter(item => item.id !== id);
    try {
      await updateDoc(doc(db, 'users', user.uid), { tierList: newList });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Heart className="w-12 h-12 text-rose-500 fill-rose-500" />
        </motion.div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-stone-800 font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-white/50 flex items-center gap-8">
        <NavButton 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')} 
          icon={<MessageCircle className="w-5 h-5" />} 
          label="Чат"
        />
        <NavButton 
          active={activeTab === 'notes'} 
          onClick={() => setActiveTab('notes')} 
          icon={<StickyNote className="w-5 h-5" />} 
          label="Заметки"
        />
        <NavButton 
          active={activeTab === 'horoscope'} 
          onClick={() => setActiveTab('horoscope')} 
          icon={<Sparkles className="w-5 h-5" />} 
          label="Звезды"
        />
        <NavButton 
          active={activeTab === 'pet'} 
          onClick={() => setActiveTab('pet')} 
          icon={<Smile className="w-5 h-5" />} 
          label="Лисёнок"
        />

        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
          icon={<User className="w-5 h-5" />} 
          label="Профиль"
        />
      </nav>

      {/* Main Content */}
      <main className="pt-6 pb-28 px-4 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="h-full"
          >
            {activeTab === 'chat' && <Chat />}
            {activeTab === 'notes' && <Notes />}
            {activeTab === 'horoscope' && <Horoscope />}
            {activeTab === 'pet' && <Pet />}
            {activeTab === 'profile' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Partner Status Card */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-4">
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block">Профиль партнера</label>
                    {!partner && <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest animate-pulse">Ожидание подключения...</span>}
                  </div>
                  {partner ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white p-6 rounded-[32px] shadow-sm border border-stone-100 flex items-center gap-4"
                    >
                      <div className="relative">
                        <img src={partner.photoURL} alt={partner.displayName} className="w-16 h-16 rounded-full border-2 border-rose-100" />
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm text-xl">
                          {partner.mood || '😊'}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg">{partner.displayName} сейчас...</h3>
                          <div className="flex items-center gap-2">
                            {partner.lastPoopedDate === getTodayStr() && (
                              <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-full">
                                💩 Да!
                              </div>
                            )}
                            {partner.location && (
                              <div className="flex items-center gap-1 text-rose-400 text-[10px] font-bold uppercase tracking-wider bg-rose-50 px-2 py-1 rounded-full">
                                <MapPin className="w-3 h-3" />
                                {partner.location}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-stone-500 italic text-sm">
                          {partner.status || 'Просто наслаждается моментом'}
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-stone-100/50 p-8 rounded-[32px] border border-stone-200 border-dashed flex flex-col items-center justify-center text-stone-400 text-center">
                      <Heart className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm italic">Партнер еще не вошел в приложение или профиль не найден</p>
                    </div>
                  )}
                </div>

                {/* My Profile Card */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold px-4 block">Мой профиль</label>
                  <div className="bg-white p-8 rounded-[40px] shadow-xl border border-stone-100">
                    <div className="text-center mb-8">
                      <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-rose-50 shadow-lg overflow-hidden bg-rose-100 flex items-center justify-center">
                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                      </div>
                      <h2 className="font-serif text-2xl mb-1">{user.displayName}</h2>
                      <p className="text-stone-400 text-sm">{user.email}</p>
                    </div>

                    <div className="space-y-6">
                      {/* Mood Selection */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-3 block">Мое настроение</label>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {MOODS.map(m => (
                            <button
                              key={m}
                              onClick={() => updateMood(m)}
                              className={`text-2xl p-2 rounded-xl transition-all ${user.mood === m ? 'bg-rose-50 scale-110 shadow-inner' : 'hover:bg-stone-50'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status Editing */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-3 block">Чего я хочу сейчас</label>
                        {isEditingStatus ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={statusInput}
                              onChange={(e) => setStatusInput(e.target.value)}
                              className="flex-1 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-200"
                              placeholder="Напиши свое желание..."
                              autoFocus
                            />
                            <button 
                              type="button"
                              onClick={updateStatus} 
                              disabled={isSavingStatus}
                              className="p-3 bg-stone-800 text-white rounded-xl hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center min-w-[44px] disabled:opacity-50"
                            >
                              <Check className={`w-5 h-5 ${isSavingStatus ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={startEditingStatus}
                            className="p-4 bg-stone-50 rounded-2xl flex items-center justify-between cursor-pointer group"
                          >
                            <p className="text-stone-600 italic">{user.status || 'Нажми, чтобы добавить статус...'}</p>
                            <Edit3 className="w-4 h-4 text-stone-300 group-hover:text-rose-400 transition-colors" />
                          </div>
                        )}
                      </div>

                      {/* Location Editing */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-3 block">Где я сейчас</label>
                        {isEditingLocation ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={locationInput}
                              onChange={(e) => setLocationInput(e.target.value)}
                              className="flex-1 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-200"
                              placeholder="Введи свое местоположение..."
                              autoFocus
                            />
                            <button 
                              type="button"
                              onClick={updateLocation} 
                              disabled={isSavingLocation}
                              className="p-3 bg-stone-800 text-white rounded-xl hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center min-w-[44px] disabled:opacity-50"
                            >
                              <Check className={`w-5 h-5 ${isSavingLocation ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={startEditingLocation}
                            className="p-4 bg-stone-50 rounded-2xl flex items-center justify-between cursor-pointer group"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-4 h-4 ${user.location ? 'text-rose-400' : 'text-stone-300'}`} />
                              <p className="text-stone-600 italic">{user.location || 'Нажми, чтобы добавить местоположение...'}</p>
                            </div>
                            <Edit3 className="w-4 h-4 text-stone-300 group-hover:text-rose-400 transition-colors" />
                          </div>
                        )}
                      </div>

                      {/* Pooped Status */}
                      <div className="pt-6 border-t border-stone-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block">Покакал(а) сегодня?</label>
                          </div>
                          <button 
                            type="button"
                            onClick={togglePooped}
                            className={`px-6 py-2 rounded-2xl font-bold transition-all active:scale-95 ${user.lastPoopedDate === getTodayStr() ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
                          >
                            {user.lastPoopedDate === getTodayStr() ? 'Да! ✨' : 'Нет'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tier List Section */}
                <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-xl border border-stone-100">
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-serif text-2xl">
                        {viewingPartnerTierList ? `Тир-лист ${partner?.displayName || 'партнера'}` : 'Мой тир-лист'}
                      </h3>
                      <button 
                        onClick={() => setViewingPartnerTierList(!viewingPartnerTierList)}
                        className={`p-2 px-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewingPartnerTierList ? 'bg-rose-500 text-white' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                      >
                        <List className="w-4 h-4" />
                        {viewingPartnerTierList ? 'Показать мой' : `Показать ${partner?.displayName || 'её'}`}
                      </button>
                    </div>
                    
                    {!viewingPartnerTierList && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text" 
                          placeholder="Что добавим?"
                          value={tierItemLabel}
                          onChange={e => setTierItemLabel(e.target.value)}
                          className="flex-1 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        <div className="flex gap-2">
                          <select 
                            value={tierItemLevel}
                            onChange={e => setTierItemLevel(e.target.value as TierItem['tier'])}
                            className="flex-1 sm:flex-none bg-stone-50 border border-stone-100 rounded-xl text-sm px-3 py-2 outline-none"
                          >
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <button onClick={addTierItem} className="p-2 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-colors">
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {TIERS.map(tier => {
                      const items = (viewingPartnerTierList ? partner?.tierList : user.tierList)?.filter(i => i.tier === tier) || [];
                      return (
                        <div key={tier} className="flex gap-4 items-center">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm shrink-0
                            ${tier === 'S' ? 'bg-rose-500' : tier === 'A' ? 'bg-orange-400' : tier === 'B' ? 'bg-amber-400' : tier === 'C' ? 'bg-emerald-400' : 'bg-sky-400'}`}>
                            {tier}
                          </div>
                          <div className="flex-1 flex flex-wrap gap-2">
                            {items.map(item => (
                              <div key={item.id} className="px-3 py-1 bg-stone-50 border border-stone-100 rounded-full text-sm flex items-center gap-2 group">
                                {item.label}
                                {!viewingPartnerTierList && (
                                  <button onClick={() => removeTierItem(item.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {items.length === 0 && <span className="text-stone-300 text-xs italic py-2">Пусто...</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Logout Section */}
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex justify-center">
                  <button
                    onClick={() => signOut(auth)}
                    className="flex items-center gap-2 text-stone-400 hover:text-rose-500 transition-colors text-sm font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти из аккаунта
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-rose-500 scale-110' : 'text-stone-400 hover:text-stone-600'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-rose-500 rounded-full mt-0.5" />}
    </button>
  );
}
