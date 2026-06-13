import { create } from 'zustand';
import { Role, SessionStatus, MessageResponse } from '@vsp/shared';

interface User {
  id: string;
  email: string;
  role: Role;
  token: string;
}

interface AppState {
  user: User | null;
  activeSessionId: string | null;
  livekitToken: string | null;
  participantId: string | null;
  messages: MessageResponse[];
  isMuted: boolean;
  isCameraOff: boolean;
  isRecording: boolean;
  recordingId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  
  setUser: (user: User | null) => void;
  setActiveSession: (sessionId: string | null, livekitToken: string | null, participantId: string | null) => void;
  setMessages: (messages: MessageResponse[]) => void;
  addMessage: (message: MessageResponse) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  setRecording: (isRecording: boolean, recordingId: string | null) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
  resetCallState: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  activeSessionId: null,
  livekitToken: null,
  participantId: null,
  messages: [],
  isMuted: false,
  isCameraOff: false,
  isRecording: false,
  recordingId: null,
  connectionStatus: 'disconnected',

  setUser: (user) => set({ user }),
  setActiveSession: (activeSessionId, livekitToken, participantId) => 
    set({ activeSessionId, livekitToken, participantId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  setRecording: (isRecording, recordingId) => set({ isRecording, recordingId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  resetCallState: () => set({
    activeSessionId: null,
    livekitToken: null,
    participantId: null,
    messages: [],
    isMuted: false,
    isCameraOff: false,
    isRecording: false,
    recordingId: null,
    connectionStatus: 'disconnected',
  }),
}));
