import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Send, Camera, Eye, Volume2, VolumeX, 
  Settings, Sparkles, RefreshCw, Trophy, Activity, 
  ShieldCheck, Terminal, UserCheck, MessageSquare, Zap
} from 'lucide-react';
import { ArcReactor } from './components/ArcReactor';
import { CameraModule } from './components/CameraModule';
import { ChessGame, PlayerColor, Difficulty } from './components/ChessGame';
import { jarvisVoice } from './utils/speech';
import { soundFx } from './utils/soundFx';

interface Message {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: string;
  mood?: string;
  visualNote?: string;
  isChess?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'jarvis',
      text: 'Xayrli kun, janob. Sizga qanday yordam bera olaman?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoVoiceReply, setAutoVoiceReply] = useState(true);
  const [soundMuted, setSoundMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'chess' | 'camera'>('console');
  
  // Customization & Titles
  const [userTitle, setUserTitle] = useState('janob');
  const [showSettings, setShowSettings] = useState(false);
  const [inputTitle, setInputTitle] = useState('janob');

  // Vision Snapshot
  const [latestSnapshot, setLatestSnapshot] = useState<string | null>(null);
  const [latestMood, setLatestMood] = useState<string>('Xotirjam');
  const [fatigueLevel, setFatigueLevel] = useState<string>('Past');
  const [ambientNote, setAmbientNote] = useState<string>('Sensorlar optimal holatda');

  // Chess Bridge
  const [chessMoveFromVoice, setChessMoveFromVoice] = useState<string | null>(null);

  // Time & Diagnostics
  const [currentTime, setCurrentTime] = useState<string>('');
  const [cpuUsage, setCpuUsage] = useState<number>(14);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastMoodCheckTimeRef = useRef<number>(0);

  // Live Clock & CPU Telemetry simulator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    const cpuTimer = setInterval(() => {
      setCpuUsage(Math.floor(12 + Math.random() * 8));
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(cpuTimer);
    };
  }, []);

  // Auto scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Handle Speech from JARVIS
  const speakJarvisText = useCallback(
    (text: string) => {
      if (!autoVoiceReply) return;
      setIsSpeaking(true);
      jarvisVoice.speak(text, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    [autoVoiceReply]
  );

  // Toggle Mute
  const toggleMute = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    soundFx.setMuted(nextMuted);
    if (nextMuted) {
      jarvisVoice.stopSpeaking();
      setIsSpeaking(false);
    }
  };

  // Send message to backend Gemini API
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt && !latestSnapshot) return;

    soundFx.playActivate();
    setInputText('');

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    // Check if user specifically requested chess
    const lowerPrompt = prompt.toLowerCase();
    if (
      lowerPrompt.includes('shaxmat') ||
      lowerPrompt.includes('shahmat') ||
      lowerPrompt.includes('chess')
    ) {
      setActiveTab('chess');
    }

    // Voice chess move detection (e.g. e4, e2-e4, ot f3)
    const isLikelyChessMove =
      lowerPrompt.match(/^[a-h][1-8][- \s]*[a-h][1-8]$/) ||
      lowerPrompt.match(/^(ot|fil|ruh|to'ra|farzin|vazir|shoh|piyoda)[\s]+[a-h][1-8]/) ||
      lowerPrompt.match(/^(n|b|r|q|k)?[a-h][1-8]$/);

    if (isLikelyChessMove && activeTab === 'chess') {
      setChessMoveFromVoice(prompt);
    }

    // Mood check logic: only ask occasionally (e.g., minimum 2 minutes apart unless user asks)
    const now = Date.now();
    const shouldCheckMood = now - lastMoodCheckTimeRef.current > 120000;

    try {
      // Build history for backend
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'jarvis' ? 'model' : 'user',
        text: m.text,
      }));

      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          image: latestSnapshot,
          history: historyPayload,
          userTitle: userTitle,
          shouldCheckMood: shouldCheckMood,
        }),
      });

      const resData = await res.json();
      const data = resData.data || {};
      const replyText = data.reply || resData.reply || 'Xizmatingizdaman, janob.';

      if (data.detectedMood) {
        setLatestMood(data.detectedMood);
        if (shouldCheckMood) {
          lastMoodCheckTimeRef.current = now;
        }
      }
      if (data.visualObservation) {
        setAmbientNote(data.visualObservation);
      }

      // Check for suggested chess move from Gemini
      if (data.chessSuggestion?.suggestedMove && activeTab === 'chess') {
        setChessMoveFromVoice(data.chessSuggestion.suggestedMove);
      }

      const jarvisMsg: Message = {
        id: `jrv-${Date.now()}`,
        sender: 'jarvis',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mood: data.detectedMood,
        visualNote: data.visualObservation,
      };

      setMessages((prev) => [...prev, jarvisMsg]);
      speakJarvisText(replyText);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'jarvis',
        text: 'Aloqa kanalida shovqin bor, janob. Iltimos takrorlang.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      speakJarvisText('Aloqa kanalida shovqin bor, janob. Iltimos takrorlang.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Voice Input (Speech Recognition)
  const toggleVoiceListening = () => {
    if (isListening) {
      jarvisVoice.stopListening();
      setIsListening(false);
    } else {
      soundFx.playActivate();
      jarvisVoice.startListening({
        onStart: () => setIsListening(true),
        onResult: (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            jarvisVoice.stopListening();
            setIsListening(false);
            handleSendMessage(transcript);
          }
        },
        onError: (err) => {
          console.warn('Speech error:', err);
          setIsListening(false);
        },
        onEnd: () => setIsListening(false),
      });
    }
  };

  // Ambient Vision Diagnostics Received
  const handleVisionDiagnostics = (diag: any) => {
    if (diag.estimatedMood) setLatestMood(diag.estimatedMood);
    if (diag.fatigueLevel) setFatigueLevel(diag.fatigueLevel);
    if (diag.environmentSummary) setAmbientNote(diag.environmentSummary);
  };

  // Physical board detected from camera
  const handleChessBoardDetected = (move: string, confirmation: string) => {
    setActiveTab('chess');
    if (move && move !== 'noma\'lum') {
      setChessMoveFromVoice(move);
    }
    const jarvisMsg: Message = {
      id: `chess-cam-${Date.now()}`,
      sender: 'jarvis',
      text: confirmation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isChess: true,
    };
    setMessages((prev) => [...prev, jarvisMsg]);
    speakJarvisText(confirmation);
  };

  return (
    <div className="relative min-h-screen bg-[#030712] text-cyan-100 flex flex-col overflow-hidden hud-grid selection:bg-cyan-500 selection:text-black">
      {/* Holographic Glowing Ambient Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* TOP HUD TELEMETRY BAR */}
      <header className="relative z-20 border-b border-cyan-500/30 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping absolute opacity-75" />
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
          </div>
          <div>
            <div className="font-display font-black tracking-widest text-cyan-300 text-sm sm:text-base flex items-center gap-2">
              <span>J.A.R.V.I.S.</span>
              <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                MARK VII OS
              </span>
            </div>
            <div className="text-[9px] font-mono text-cyan-600 tracking-wider">
              STARK INDUSTRIES // AI BUTLER SYSTEM
            </div>
          </div>
        </div>

        {/* Telemetry Chips */}
        <div className="hidden md:flex items-center gap-3 font-mono text-xs">
          <div className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>CPU: {cpuUsage}%</span>
          </div>

          <div className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/20 text-cyan-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Murojaat: <strong className="text-cyan-200">{userTitle}</strong></span>
          </div>

          <div className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/20 text-cyan-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protokol: HIMOYA</span>
          </div>

          <div className="text-[11px] text-cyan-500 font-mono">
            {currentTime}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoVoiceReply(!autoVoiceReply)}
            title={autoVoiceReply ? 'Ovozli javob yoqilgan' : 'Ovozli javob o\'chirilgan'}
            className={`p-2 rounded-lg border text-xs font-mono transition ${
              autoVoiceReply
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            onClick={toggleMute}
            title={soundMuted ? 'Ovoz effektlarini yoqish' : 'Effektlarni o\'chirish'}
            className={`p-2 rounded-lg border text-xs font-mono transition ${
              soundMuted
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-slate-900 border-cyan-500/30 text-cyan-400 hover:border-cyan-400'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Sozlamalar"
            className="p-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyan-500/20">
              <h3 className="font-display text-sm font-bold uppercase text-cyan-300 flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                JARVIS Tizim Sozlamalari
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white font-mono text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-cyan-400 mb-1.5">
                  JARVIS sizga qanday murojaat qilsin?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="Masalan: janob, Ismoil, Ser..."
                    className="flex-1 bg-slate-950 border border-cyan-500/40 rounded-lg px-3 py-2 text-cyan-200 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => {
                      setUserTitle(inputTitle || 'janob');
                      soundFx.playActivate();
                      speakJarvisText(`Tushunarli, ${inputTitle || 'janob'}. Murojaat uslubi yangilandi.`);
                    }}
                    className="px-3 py-2 bg-cyan-500 text-slate-950 rounded-lg font-bold hover:brightness-110 transition"
                  >
                    Saqlash
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Standart murojaat: "janob". Siz xohlagan ismingizni kiritishingiz mumkin.
                </p>
              </div>

              <div className="pt-2 border-t border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Avtomatik ovozli javob:</span>
                  <input
                    type="checkbox"
                    checked={autoVoiceReply}
                    onChange={(e) => setAutoVoiceReply(e.target.checked)}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Ovozli effektlar (SFX):</span>
                  <input
                    type="checkbox"
                    checked={!soundMuted}
                    onChange={() => toggleMute()}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-slate-800 border border-cyan-500/30 text-cyan-300 rounded-lg font-mono text-xs hover:border-cyan-400 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT LAYOUT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3 relative z-10">
        {/* LEFT / CENTER PANEL: Console Chat & Arc Reactor */}
        <div className="flex-1 flex flex-col bg-slate-950/70 border border-cyan-500/25 rounded-2xl overflow-hidden backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.1)]">
          {/* Module Switcher Tabs */}
          <div className="flex items-center border-b border-cyan-500/20 bg-slate-900/60 px-3 py-1.5 gap-2">
            <button
              onClick={() => {
                setActiveTab('console');
                soundFx.playActivate();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                activeTab === 'console'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Suhbat & Konsol
            </button>

            <button
              onClick={() => {
                setActiveTab('chess');
                soundFx.playActivate();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                activeTab === 'chess'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Taktik Shaxmat
            </button>

            <button
              onClick={() => {
                setActiveTab('camera');
                soundFx.playActivate();
              }}
              className={`lg:hidden px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Optik Kamera
            </button>
          </div>

          {/* TAB 1: CONSOLE / VOICE CHAT */}
          {activeTab === 'console' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Arc Reactor Centerpiece */}
              <div className="border-b border-cyan-500/20 bg-gradient-to-b from-slate-900/40 to-transparent py-2">
                <ArcReactor
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  onClick={() => toggleVoiceListening()}
                  statusText={
                    isSpeaking
                      ? 'JARVIS GAPIRMOQDA...'
                      : isListening
                      ? 'SIZNI TINGLAMOQDA...'
                      : 'JARVIS TAYYOR // MARK VII'
                  }
                />
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-mono uppercase text-cyan-500/80 font-semibold">
                        {msg.sender === 'user' ? userTitle : 'J.A.R.V.I.S.'}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">{msg.timestamp}</span>
                      {msg.sender === 'jarvis' && (
                        <button
                          onClick={() => speakJarvisText(msg.text)}
                          title="Qayta eshitish"
                          className="text-cyan-500 hover:text-cyan-300 transition"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 font-sans text-sm leading-relaxed backdrop-blur-sm ${
                        msg.sender === 'user'
                          ? 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 rounded-tr-none shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-900/90 border border-cyan-500/30 text-cyan-200 rounded-tl-none shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                      }`}
                    >
                      {msg.text}

                      {/* Vision / Mood Badges if present */}
                      {(msg.mood || msg.visualNote) && (
                        <div className="mt-2 pt-1.5 border-t border-cyan-500/20 flex flex-wrap gap-1.5 text-[10px] font-mono">
                          {msg.mood && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                              Kayfiyat: {msg.mood}
                            </span>
                          )}
                          {msg.visualNote && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-400">
                              Vizual: {msg.visualNote}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs animate-pulse p-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    JARVIS o'ylamoqda va signallarni tahlil qilmoqda...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="p-2 border-t border-cyan-500/15 bg-slate-950/80 flex items-center gap-2 overflow-x-auto text-xs font-mono">
                {[
                  'Shaxmat o\'ynaymiz',
                  'Kayfiyatimni bahola',
                  'Kameradan qara, nima ko\'ryapsan?',
                  'Bugun reja qanday?',
                  'Tizim holati',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSendMessage(chip)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat & Voice Input Bar */}
              <div className="p-3 border-t border-cyan-500/30 bg-slate-900/80 flex items-center gap-2">
                {/* Microphone Toggle Button */}
                <button
                  onClick={toggleVoiceListening}
                  className={`p-3 rounded-xl border transition flex items-center justify-center shrink-0 ${
                    isListening
                      ? 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse shadow-[0_0_20px_#f59e0b]'
                      : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  }`}
                  title={isListening ? 'Eshitishni to\'xtatish' : 'Mikrofon orqali gapirish'}
                >
                  {isListening ? <MicOff className="w-5 h-5 text-amber-300" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text input */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder={
                    isListening
                      ? 'Sizni tinglamoqdaman, gapiring...'
                      : 'JARVIS ga buyruq bering yoki mikrofondan gapiring...'
                  }
                  className="flex-1 bg-slate-950/90 border border-cyan-500/40 rounded-xl px-4 py-2.5 text-sm text-cyan-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)] font-mono"
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TACTICAL CHESSBOARD */}
          {activeTab === 'chess' && (
            <div className="flex-1 overflow-y-auto p-4">
              <ChessGame
                onJarvisSpeak={speakJarvisText}
                userTitle={userTitle}
                externalMove={chessMoveFromVoice}
                onClearExternalMove={() => setChessMoveFromVoice(null)}
              />
            </div>
          )}

          {/* TAB 3: OPTICAL CAMERA (Mobile view) */}
          {activeTab === 'camera' && (
            <div className="flex-1 overflow-y-auto p-4">
              <CameraModule
                onCaptureSnapshot={(data) => setLatestSnapshot(data)}
                onVisionDiagnostics={handleVisionDiagnostics}
                onChessBoardDetected={handleChessBoardDetected}
              />
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Live Optical Camera & Ambient Perception (Desktop persistent view) */}
        <div className="hidden lg:flex w-[380px] xl:w-[420px] flex-col gap-3 shrink-0">
          <CameraModule
            onCaptureSnapshot={(data) => setLatestSnapshot(data)}
            onVisionDiagnostics={handleVisionDiagnostics}
            onChessBoardDetected={handleChessBoardDetected}
          />

          {/* Ambient Intelligence Status Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AMBIENT INTELLEKT
              </span>
              <span className="text-[10px] text-cyan-600">LIVE SENSORS</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-cyan-500/20">
                <span className="text-slate-400">Taxminiy Kayfiyat:</span>
                <span className="text-emerald-300 font-bold capitalize">{latestMood}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-cyan-500/20">
                <span className="text-slate-400">Charchoq Darajasi:</span>
                <span className="text-amber-300 font-bold capitalize">{fatigueLevel}</span>
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-cyan-500/20">
                <span className="text-slate-400 block text-[10px] mb-1">Vizual Mulohaza:</span>
                <span className="text-cyan-200 text-[11px] leading-tight block">{ambientNote}</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 italic">
              * Eslatma: JARVIS Iron Man kabi muloyim, qisqa va aniq javob beradi. Sizning kayfiyatingiz va shaxmat harakatlaringizni kuzatib boradi.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
