import React, { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc, handleFirestoreError, OperationType } from '../firebase';
import { Note } from '../types';
import { format } from 'date-fns';
import { Plus, Trash2, X, Check, StickyNote, ListTodo, Square, CheckSquare, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const COLORS = [
  'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-sky-50', 'bg-violet-50', 'bg-stone-50'
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({ 
    title: '', 
    content: '', 
    color: COLORS[0], 
    type: 'text' as 'text' | 'list',
    items: [] as { id: string; text: string; completed: boolean }[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(nts);
    }, (error) => {
      console.error("Notes error:", error);
      handleFirestoreError(error, OperationType.LIST, 'notes');
    });
    return () => unsubscribe();
  }, []);

  const addNote = async () => {
    if (newNote.type === 'text' && !newNote.content.trim()) return;
    if (newNote.type === 'list' && newNote.items.length === 0) return;
    if (!auth.currentUser) return;

    setIsSaving(true);
    try {
      if (editingNoteId) {
        await updateDoc(doc(db, 'notes', editingNoteId), {
          ...newNote,
          timestamp: serverTimestamp() // Optional: update timestamp on edit
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          ...newNote,
          authorId: auth.currentUser.uid,
          authorName: auth.currentUser.displayName || 'Unknown',
          timestamp: serverTimestamp()
        });
      }
      setNewNote({ 
        title: '', 
        content: '', 
        color: COLORS[0], 
        type: 'text',
        items: []
      });
      setIsAdding(false);
      setEditingNoteId(null);
    } catch (error) {
      handleFirestoreError(error, editingNoteId ? OperationType.UPDATE : OperationType.CREATE, 'notes');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (note: Note) => {
    setNewNote({
      title: note.title || '',
      content: note.content || '',
      color: note.color || COLORS[0],
      type: note.type || 'text',
      items: note.items || []
    });
    setEditingNoteId(note.id || null);
    setIsAdding(true);
  };

  const closeAdding = () => {
    setIsAdding(false);
    setEditingNoteId(null);
    setNewNote({ 
      title: '', 
      content: '', 
      color: COLORS[0], 
      type: 'text',
      items: []
    });
  };

  const deleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const toggleItem = async (noteId: string, itemId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.items) return;

    const updatedItems = note.items.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    try {
      await updateDoc(doc(db, 'notes', noteId), { items: updatedItems });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${noteId}`);
    }
  };

  const addItemToNewNote = () => {
    if (!newItemText.trim()) return;
    setNewNote({
      ...newNote,
      items: [...newNote.items, { id: Math.random().toString(36).substr(2, 9), text: newItemText, completed: false }]
    });
    setNewItemText('');
  };

  const removeItemFromNewNote = (id: string) => {
    setNewNote({
      ...newNote,
      items: newNote.items.filter(item => item.id !== id)
    });
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
          <span>Создать</span>
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
                <div className="flex gap-2">
                  <button 
                    onClick={() => setNewNote({ ...newNote, type: 'text' })}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${newNote.type === 'text' ? 'bg-stone-800 text-white' : 'bg-black/5 text-stone-500'}`}
                  >
                    Заметка
                  </button>
                  <button 
                    onClick={() => setNewNote({ ...newNote, type: 'list' })}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${newNote.type === 'list' ? 'bg-stone-800 text-white' : 'bg-black/5 text-stone-500'}`}
                  >
                    Список
                  </button>
                </div>
                <button onClick={closeAdding} className="p-2 hover:bg-black/5 rounded-full">
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

              {newNote.type === 'text' ? (
                <textarea
                  placeholder="Напишите что-нибудь прекрасное..."
                  value={newNote.content}
                  onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 min-h-[200px] resize-none placeholder:opacity-50"
                />
              ) : (
                <div className="min-h-[200px] space-y-2">
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text"
                      placeholder="Добавить пункт..."
                      value={newItemText}
                      onChange={e => setNewItemText(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addItemToNewNote()}
                      className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-stone-400"
                    />
                    <button onClick={addItemToNewNote} className="p-2 bg-stone-800 text-white rounded-xl">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {newNote.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-white/50 p-2 rounded-xl group">
                        <span className="text-sm">{item.text}</span>
                        <button onClick={() => removeItemFromNewNote(item.id)} className="text-stone-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  disabled={isSaving}
                  className="px-6 py-2 bg-stone-800 text-white rounded-full flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
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
            
            <div className="flex-1">
              {note.type === 'list' ? (
                <div className="space-y-2 mb-4">
                  {note.items?.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => note.id && toggleItem(note.id, item.id)}
                      className={`flex items-center gap-3 cursor-pointer transition-all ${item.completed ? 'opacity-40' : 'opacity-100'}`}
                    >
                      {item.completed ? (
                        <CheckSquare className="w-4 h-4 text-stone-500" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-400" />
                      )}
                      <span className={`text-sm ${item.completed ? 'line-through' : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-stone-700 prose prose-sm prose-stone mb-4">
                  <ReactMarkdown>{note.content}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-black/5 flex justify-between items-center text-[10px] uppercase tracking-widest text-stone-400 font-bold">
              <div className="flex items-center gap-2">
                {note.type === 'list' ? <ListTodo className="w-3 h-3" /> : <StickyNote className="w-3 h-3" />}
                <span>{note.authorName} • {note.timestamp?.toDate ? format(note.timestamp.toDate(), 'd MMM') : '...'}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEditing(note)}
                  className="p-2 hover:bg-stone-100 hover:text-stone-800 rounded-full transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => note.id && deleteNote(note.id)}
                  className="p-2 hover:bg-rose-100 hover:text-rose-500 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
