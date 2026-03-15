import React, { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from '../firebase';
import { Note } from '../types';
import { format } from 'date-fns';
import { Plus, Trash2, X, Check, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const COLORS = [
  'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-sky-50', 'bg-violet-50', 'bg-stone-50'
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', color: COLORS[0] });

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(nts);
    }, (error) => {
      console.error("Notes error:", error);
      // Log detailed error for debugging
      console.error('Firestore Error Info:', JSON.stringify({
        error: error.message,
        operation: 'list',
        path: 'notes',
        userId: auth.currentUser?.uid
      }));
    });
    return () => unsubscribe();
  }, []);

  const addNote = async () => {
    if (!newNote.content.trim() || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'notes'), {
        ...newNote,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Unknown',
        timestamp: serverTimestamp()
      });
      setNewNote({ title: '', content: '', color: COLORS[0] });
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="font-serif text-3xl text-stone-800">Наши воспоминания</h2>
          <p className="text-stone-500 italic">Заметки, мечты и всякие мелочи...</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
        >
          <Plus className="w-4 h-4" />
          <span>Новая заметка</span>
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <div className={`w-full max-w-lg p-6 rounded-3xl shadow-2xl ${newNote.color} border border-white/50`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-xl">Создать заметку</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Заголовок (необязательно)"
                value={newNote.title}
                onChange={e => setNewNote({ ...newNote, title: e.target.value })}
                className="w-full bg-transparent border-none focus:ring-0 text-xl font-medium mb-4 placeholder:opacity-50"
              />
              <textarea
                placeholder="Напишите что-нибудь прекрасное..."
                value={newNote.content}
                onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                className="w-full bg-transparent border-none focus:ring-0 min-h-[200px] resize-none placeholder:opacity-50"
              />
              <div className="flex justify-between items-center mt-6">
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewNote({ ...newNote, color: c })}
                      className={`w-6 h-6 rounded-full border-2 ${c} ${newNote.color === c ? 'border-stone-800' : 'border-transparent'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={addNote}
                  className="px-6 py-2 bg-stone-800 text-white rounded-full flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map(note => (
          <motion.div
            layout
            key={note.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl shadow-sm border border-black/5 flex flex-col ${note.color || 'bg-white'}`}
          >
            {note.title && <h4 className="font-serif text-xl mb-2 text-stone-800">{note.title}</h4>}
            <div className="flex-1 text-stone-700 prose prose-sm prose-stone">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
            <div className="mt-6 pt-4 border-t border-black/5 flex justify-between items-center text-[10px] uppercase tracking-widest text-stone-400 font-bold">
              <span>{note.authorName} • {note.timestamp?.toDate ? format(note.timestamp.toDate(), 'd MMM') : '...'}</span>
              <button
                onClick={() => note.id && deleteNote(note.id)}
                className="p-2 hover:bg-rose-100 hover:text-rose-500 rounded-full transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      
      {notes.length === 0 && (
        <div className="text-center py-20 opacity-30">
          <StickyNote className="w-16 h-16 mx-auto mb-4" />
          <p className="font-serif text-xl">Заметок пока нет. Начните делиться воспоминаниями!</p>
        </div>
      )}
    </div>
  );
}
