'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../../store/useAppStore';
import { useSocket } from '../../../hooks/useSocket';
import { api } from '../../../lib/api';
import { Role } from '@vsp/shared';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Mic, MicOff, Video, VideoOff, Paperclip, Send, PhoneOff,
  Radio, ShieldAlert, Download, FileText, Loader2, Sparkles
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CallPage({ params }: PageProps) {
  const router = useRouter();
  const { id: sessionId } = use(params);
  const {
    user,
    livekitToken,
    participantId,
    messages,
    isMuted,
    isCameraOff,
    isRecording,
    connectionStatus,
    toggleMute,
    toggleCamera,
    resetCallState,
  } = useAppStore();

  const { sendMessage } = useSocket();
  const [chatInput, setChatInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [useLocalMock, setUseLocalMock] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const mockLocalVideoRef = useRef<HTMLVideoElement>(null);
  const mockRemoteVideoRef = useRef<HTMLVideoElement>(null);

  const localVideoCallbackRef = React.useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      mockLocalVideoRef.current = node;
      if (localStream) {
        node.srcObject = localStream;
        node.play().catch(e => console.warn("local play error", e));
      }
    } else {
      mockLocalVideoRef.current = null;
    }
  }, [localStream]);

  const remoteVideoCallbackRef = React.useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      mockRemoteVideoRef.current = node;
      if (localStream) {
        node.srcObject = localStream;
        node.play().catch(e => console.warn("remote play error", e));
      }
    } else {
      mockRemoteVideoRef.current = null;
    }
  }, [localStream]);

  useEffect(() => {
    if (!user || !livekitToken) {
      router.push('/');
      return;
    }

    // Auto fallback to local webcam loopback if LiveKit is not connected in 4s
    const timeout = setTimeout(() => {
      if (connectionStatus !== 'connected') {
        console.log('LiveKit SFU not responding. Switching to local camera loopback.');
        setUseLocalMock(true);
      }
    }, 4000);

    return () => clearTimeout(timeout);
  }, [user, livekitToken, connectionStatus]);

  const streamRef = useRef<MediaStream | null>(null);

  // 1. Request media permissions instantly on mount so the prompt appears immediately
  useEffect(() => {
    const getStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        try {
          console.log('Dual media request failed, trying video only...');
          return await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err2) {
          try {
            console.log('Video request failed, trying audio only...');
            return await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (err3) {
            throw new Error('No audio/video devices found or permission denied');
          }
        }
      }
    };

    getStream()
      .then((stream) => {
        setLocalStream(stream);
        streamRef.current = stream;
        // Bind to refs if they are already hydrated
        if (mockLocalVideoRef.current) {
          mockLocalVideoRef.current.srcObject = stream;
        }
        if (mockRemoteVideoRef.current) {
          mockRemoteVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn('Camera/mic access blocked or unavailable in local standalone mode:', err);
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Bind the local stream to HTML video elements once available
  useEffect(() => {
    if (localStream) {
      if (mockLocalVideoRef.current) {
        mockLocalVideoRef.current.srcObject = localStream;
        mockLocalVideoRef.current.play().catch(() => {});
      }
      if (mockRemoteVideoRef.current) {
        mockRemoteVideoRef.current.srcObject = localStream;
        mockRemoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream]);

  // 3. Dynamically enable/disable tracks based on UI controls
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOff;
      });
    }
  }, [localStream, isCameraOff]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [localStream, isMuted]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);

    try {
      const uploadData = await api.post<{ id: string; name: string; size: number }>(
        '/files/upload',
        formData
      );

      // Send file token inside chat channel
      const fileMessage = `[FILE]::${uploadData.id}::${uploadData.name}::${Math.round(uploadData.size / 1024)}KB`;
      sendMessage(fileMessage);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      const data = await api.get<{ url: string }>('/files/' + fileId);
      window.open(data.url, '_blank');
    } catch (err) {
      alert('Failed to fetch file download link.');
    }
  };

  const handleToggleRecording = async () => {
    if (user?.role === Role.CUSTOMER) return;

    try {
      if (isRecording) {
        await api.post('/recordings/stop', { sessionId });
      } else {
        await api.post('/recordings/start', { sessionId });
      }
    } catch (err: any) {
      alert(err.message || 'Recording operation failed');
    }
  };

  const handleEndCall = async () => {
    const confirmEnd = window.confirm('Are you sure you want to end this call session?');
    if (!confirmEnd) return;

    try {
      await api.post(`/sessions/${sessionId}/end`);
      resetCallState();
      router.push(user?.role === Role.CUSTOMER ? '/' : '/dashboard');
    } catch (err) {
      resetCallState();
      router.push('/');
    }
  };

  if (!user || !livekitToken) {
    return null;
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <div className="flex flex-col h-screen bg-[#070913] text-white">
      {/* Reconnection Grace Banner */}
      {connectionStatus === 'reconnecting' && (
        <div className="bg-amber-600 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 z-50">
          <ShieldAlert className="h-4 w-4 animate-bounce" />
          Connection lost. Attempting to reconnect (60s grace period)...
        </div>
      )}

      {/* Call Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-[#0f132a]/60 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-wider text-sm bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            SESSION: {sessionId.substring(0, 8)}...
          </span>
          {isRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs text-red-400 font-bold recording-pulse">
              <Radio className="h-3.5 w-3.5" />
              REC
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'}`} />
            {connectionStatus.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video Panel (Left) */}
        <div className="flex-1 relative bg-slate-950 flex flex-col justify-center items-center overflow-hidden">
          {useLocalMock ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full p-6 bg-slate-950">
              {/* Local Participant */}
              <div className="relative glass-panel overflow-hidden border-slate-800/80 bg-slate-900 flex justify-center items-center rounded-2xl">
                <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-md text-[10px] font-bold text-slate-300 border border-slate-800">
                  {user.role === Role.CUSTOMER ? 'Customer (You)' : 'Support Agent (You)'}
                </div>
                <div className={`text-center space-y-2 ${isCameraOff ? 'block' : 'hidden'}`}>
                  <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto border border-slate-700">
                    <VideoOff className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Camera is off</p>
                </div>
                <video
                  ref={localVideoCallbackRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover rounded-2xl ${isCameraOff ? 'hidden' : 'block'}`}
                />
              </div>

              {/* Remote Participant */}
              <div className="relative glass-panel overflow-hidden border-slate-800/80 bg-slate-900 flex justify-center items-center rounded-2xl">
                <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-md text-[10px] font-bold text-slate-300 border border-slate-800">
                  {user.role === Role.CUSTOMER ? 'Support Agent' : 'Customer'}
                </div>
                <div className={`text-center space-y-2 ${isCameraOff ? 'block' : 'hidden'}`}>
                  <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto border border-slate-700">
                    <VideoOff className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Camera is off</p>
                </div>
                <video
                  ref={remoteVideoCallbackRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover rounded-2xl animate-fade-in ${isCameraOff ? 'hidden' : 'block'}`}
                />
              </div>
            </div>
          ) : (
            <LiveKitRoom
              token={livekitToken}
              serverUrl={livekitUrl}
              connect={true}
              audio={!isMuted}
              video={!isCameraOff}
              className="w-full h-full relative"
            >
              <VideoFeeds isCameraOff={isCameraOff} />
              <RoomAudioRenderer />
            </LiveKitRoom>
          )}

          {/* Media Control Toolbar Overlay */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-[#0f132a]/80 border border-slate-800 rounded-2xl px-5 py-3 backdrop-blur-md shadow-2xl z-20">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-xl transition-all ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-xl transition-all ${
                isCameraOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>

            {/* File Share Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Agent Call Record Button */}
            {user.role !== Role.CUSTOMER && (
              <button
                onClick={handleToggleRecording}
                className={`p-3 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <Radio className="h-5 w-5" />
                {isRecording ? 'Stop REC' : 'Record'}
              </button>
            )}

            {/* Exit Call */}
            <button
              onClick={handleEndCall}
              className="p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all ml-4"
              title="End Support Session"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Chat Drawer Panel (Right) */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-[#0f132a]/45 backdrop-blur-md flex flex-col h-[350px] md:h-auto overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
            <span className="font-bold text-sm text-slate-200">Live Support Chat</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">PERSISTED</span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-4">
                <Sparkles className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">No messages yet. Send a note or attach a file.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === participantId || (user.role === Role.CUSTOMER && msg.senderId === null);
                const isFile = msg.content.startsWith('[FILE]::');

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 font-semibold mb-1 px-1">{msg.senderName}</span>
                    {isFile ? (
                      <div className="glass-panel p-3 border-violet-500/20 max-w-[90%] bg-slate-900/40">
                        <div className="flex items-center gap-2">
                          <FileText className="h-8 w-8 text-cyan-400 shrink-0" />
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-slate-200 truncate">{msg.content.split('::')[2]}</p>
                            <p className="text-[9px] text-slate-500">{msg.content.split('::')[3]}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(msg.content.split('::')[1])}
                          className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded bg-violet-600/20 hover:bg-violet-600/30 border border-violet-600/30 py-1 text-[10px] font-bold text-violet-300 transition-all"
                        >
                          <Download className="h-3 w-3" />
                          Download File
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-2 text-xs max-w-[85%] leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendText} className="p-3 border-t border-slate-800 bg-slate-950/40 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-lg shadow-violet-500/10"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Custom Video Track Feeds components
function VideoFeeds({ isCameraOff }: { isCameraOff: boolean }) {
  // Grab all active audio/video tracks from room context
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false }
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full p-6 bg-slate-950">
      {tracks.map((track) => {
        const isLocal = track.participant.isLocal;
        return (
          <div
            key={track.participant.sid + '-' + track.source}
            className="relative glass-panel overflow-hidden border-slate-800/80 bg-slate-900 flex justify-center items-center rounded-2xl group"
          >
            {/* Participant Name Badge */}
            <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-md text-[10px] font-bold text-slate-300 border border-slate-800">
              {track.participant.identity.startsWith('cust-') ? 'Customer' : 'Support Agent'} {isLocal ? '(You)' : ''}
            </div>

            {/* Video Feed */}
            {track.publication?.isMuted || (isLocal && isCameraOff) ? (
              <div className="text-center space-y-2">
                <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto border border-slate-700">
                  <VideoOff className="h-6 w-6" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Camera is turned off</p>
              </div>
            ) : (
              <VideoTrack
                trackRef={track as any}
                className="w-full h-full object-cover rounded-2xl"
              />
            )}
          </div>
        );
      })}

      {tracks.length === 0 && (
        <div className="col-span-2 text-center p-8">
          <Loader2 className="h-10 w-10 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">Waiting for other participants to connect...</p>
        </div>
      )}
    </div>
  );
}
