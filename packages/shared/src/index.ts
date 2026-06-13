export enum Role {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  CUSTOMER = 'CUSTOMER',
}

export enum SessionStatus {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

export enum RecordingStatus {
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
}

export interface SessionResponse {
  id: string;
  status: SessionStatus;
  inviteToken: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantResponse {
  id: string;
  sessionId: string;
  userId: string | null;
  role: Role;
  joinedAt: string;
  leftAt: string | null;
  durationSec: number | null;
}

export interface MessageResponse {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderName: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface RecordingResponse {
  id: string;
  sessionId: string;
  status: RecordingStatus;
  storagePath: string | null;
  durationSec: number | null;
  createdAt: string;
}

export interface FileResponse {
  id: string;
  sessionId: string;
  userId: string | null;
  name: string;
  path: string;
  type: string;
  size: number;
  createdAt: string;
}

// Socket Events Definition
export const SocketEvents = {
  // Client -> Server
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  SEND_MESSAGE: 'send_message',
  TYPING: 'typing',
  
  // Server -> Client
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  MESSAGE_RECEIVED: 'message_received',
  SESSION_ENDED: 'session_ended',
  RECORDING_STARTED: 'recording_started',
  RECORDING_READY: 'recording_ready',
  USER_TYPING: 'user_typing',
} as const;
