import React, { useState, useEffect, useRef } from 'react';
import { auth, db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, getDocs, where, deleteDoc, doc, writeBatch, handleFirestoreError, OperationType } from '../firebase';
import { Message } from '../types';
import { format, startOfDay } from 'date-fns';
import { Send, Heart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = startOfDay(new Date());
    
    // Cleanup old messages (older than today)
    const cleanupOldMessages = async () => {
      try {
        const qOld = query(collection(db, 'messages'), where('timestamp', '<', today));
        const snapshot = await getDocs(qOld);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((d) => {
            batch.delete(d.ref);
          });
          await batch.commit();
          console.log('Old messages cleaned up');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'messages');
      }
    };

    cleanupOldMessages();

    // Listen only to today's messages
    const q = query(
      collection(db, 'messages'), 
      where('timestamp', '>=', today),
      orderBy('timestamp', 'asc'), 
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    }, (error) => {
      console.error("Chat error:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Unknown',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white/50 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border border-white/20">
      <div className="p-4 border-bottom border-black/5 bg-white/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
          <Heart className="text-rose-500 w-5 h-5 fill-rose-500" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-medium text-stone-800">Наш чат</h2>
          <p className="text-xs text-stone-500">Приватно и безопасно</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-rose-500 text-white rounded-tr-none' 
                    : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
                }`}>
                  {!isMe && <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{msg.senderName}</p>}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className={`text-[9px] mt-1 text-right opacity-60`}>
                    {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'HH:mm') : '...'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-white/80 border-t border-black/5 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Напишите что-нибудь приятное..."
          className="flex-1 px-4 py-2 rounded-full bg-stone-100 border-none focus:ring-2 focus:ring-rose-300 text-sm transition-all"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-rose-500 transition-colors shadow-lg shadow-rose-200"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
