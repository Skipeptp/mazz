export interface TierItem {
  id: string;
  label: string;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  mood?: string;
  status?: string;
  location?: string;
  tierList?: TierItem[];
  lastPoopedDate?: string; // YYYY-MM-DD
}

export interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
}

export interface NoteItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id?: string;
  title?: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: any;
  color?: string;
  type?: 'text' | 'list';
  items?: NoteItem[];
}

export interface PetState {
  hunger: number; // 0-100
  energy: number; // 0-100
  cleanliness: number; // 0-100
  happiness: number; // 0-100
  foodCount: number;
  name: string;
  lastAction: string;
  lastActionBy: string;
  isSleeping: boolean;
  currentRoom: 'kitchen' | 'bedroom' | 'bathroom' | 'playroom';
  lastUpdate: any;
  lastCleanupDate?: string; // YYYY-MM-DD
  isAtForest?: boolean;
  zeroStatsSince?: any; // Timestamp when any stat first hit zero
  aboveZeroStatsSince?: any; // Timestamp when all stats first became > 0
}
