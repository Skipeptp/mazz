import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, signOut, db, doc, getDoc, setDoc } from './firebase';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Notes from './components/Notes';
import { MessageCircle, StickyNote, LogOut, Heart, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'chat' | 'notes' | 'profile';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Ensure user exists in Firestore
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            role: 'user'
          });
        }
        setUser(u);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
          label="Chat"
        />
        <NavButton 
          active={activeTab === 'notes'} 
          onClick={() => setActiveTab('notes')} 
          icon={<StickyNote className="w-5 h-5" />} 
          label="Notes"
        />
        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
          icon={<User className="w-5 h-5" />} 
          label="Me"
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
            {activeTab === 'profile' && (
              <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] shadow-xl border border-stone-100 text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-6 border-4 border-rose-50 shadow-lg overflow-hidden bg-rose-100 flex items-center justify-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-rose-300" />
                  )}
                </div>
                <h2 className="font-serif text-2xl mb-1">{user.displayName || 'User'}</h2>
                <p className="text-stone-400 text-sm mb-8">{user.email}</p>
                
                <div className="space-y-4">
                  <button
                    onClick={() => signOut(auth)}
                    className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
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
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-rose-500 scale-110' : 'text-stone-400 hover:text-stone-600'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-rose-500 rounded-full mt-0.5" />}
    </button>
  );
}
