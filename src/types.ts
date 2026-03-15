export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
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
}
