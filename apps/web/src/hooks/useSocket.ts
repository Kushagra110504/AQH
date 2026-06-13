import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents, MessageResponse } from '@vsp/shared';
import { useAppStore } from '../store/useAppStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    user,
    activeSessionId,
    participantId,
    addMessage,
    setConnectionStatus,
    setRecording,
    resetCallState,
  } = useAppStore();

  useEffect(() => {
    if (!user || !activeSessionId || !participantId) {
      return;
    }

    const socketUrl = API_URL;
    const socket = io(socketUrl, {
      auth: {
        token: user.token,
      },
      transports: ['websocket'],
    });

    socketRef.current = socket;
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      console.log('Socket connected, joining session:', activeSessionId);
      setConnectionStatus('connected');
      
      // Emit room join event
      socket.emit(SocketEvents.JOIN_SESSION, {
        sessionId: activeSessionId,
        participantId: participantId,
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        setConnectionStatus('disconnected');
      } else {
        // Auto-reconnecting by Socket.io client
        setConnectionStatus('reconnecting');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnectionStatus('disconnected');
    });

    // Handle chat message updates
    socket.on(SocketEvents.MESSAGE_RECEIVED, (message: MessageResponse) => {
      addMessage(message);
    });

    // Handle presence updates
    socket.on(SocketEvents.PARTICIPANT_JOINED, (data) => {
      console.log('Participant joined:', data);
    });

    socket.on(SocketEvents.PARTICIPANT_LEFT, (data) => {
      console.log('Participant left:', data);
    });

    // Handle call controls
    socket.on(SocketEvents.SESSION_ENDED, () => {
      console.log('Session has been ended by another participant.');
      socket.disconnect();
      resetCallState();
      alert('The call session has been ended.');
      window.location.href = user.role === 'CUSTOMER' ? '/' : '/dashboard';
    });

    socket.on(SocketEvents.RECORDING_STARTED, (data) => {
      console.log('Recording started:', data.recordingId);
      setRecording(true, data.recordingId);
    });

    socket.on(SocketEvents.RECORDING_READY, (data) => {
      console.log('Recording ready:', data.recordingId, 'Url:', data.url);
      setRecording(false, null);
      alert('The call recording is processed and ready for download.');
    });

    return () => {
      if (socket) {
        socket.emit(SocketEvents.LEAVE_SESSION, {
          sessionId: activeSessionId,
          participantId: participantId,
        });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [user, activeSessionId, participantId]);

  const sendMessage = (content: string) => {
    if (socketRef.current && activeSessionId) {
      socketRef.current.emit(SocketEvents.SEND_MESSAGE, {
        sessionId: activeSessionId,
        content,
      });
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (socketRef.current && activeSessionId) {
      socketRef.current.emit(SocketEvents.TYPING, {
        sessionId: activeSessionId,
        isTyping,
      });
    }
  };

  return {
    sendMessage,
    sendTyping,
    socket: socketRef.current,
  };
}
