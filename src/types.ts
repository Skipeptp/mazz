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
}

export interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
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
  items?: { id: string; text: string; completed: boolean }[];
}
