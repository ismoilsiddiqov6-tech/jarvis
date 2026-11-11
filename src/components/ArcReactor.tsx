import React from 'react';
import { Zap } from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface ArcReactorProps {
  isSpeaking: boolean;
  isListening: boolean;
  onClick?: () => void;
  statusText?: string;
}

export const ArcReactor: React.FC<ArcReactorProps> = ({
  isSpeaking,
  isListening,
  onClick,
  statusText = 'JARVIS ONLAYN',
}) => {
  const handleClick = () => {
    soundFx.playReactorHum();
    onClick?.();
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Interactive Arc Reactor Core */}
      <div
        onClick={handleClick}
        className="relative w-44 h-44 sm:w-52 sm:h-52 cursor-pointer flex items-center justify-center group select-none"
        title="Arc Reactor Core // Bosish orqali rezonans berish"
      >
        {/* Outer ambient glow */}
        <div
          className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none ${
            isSpeaking
              ? 'bg-cyan-400/40 scale-110'
              : isListening
              ? 'bg-amber-400/35 scale-105'
              : 'bg-cyan-500/20 scale-95 group-hover:bg-cyan-400/30'
          }`}
        />

        {/* Outer Mechanical Ring */}
        <div className="absolute inset-1 rounded-full border-2 border-cyan-500/40 group-hover:border-cyan-400/80 transition-colors">
          {/* Circular ticks */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-3 bg-cyan-400/60 top-0 left-1/2 -translate-x-1/2 origin-[50%_100px] sm:origin-[50%_120px]"
              style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
            />
          ))}
        </div>

        {/* Rotating Outer Segment */}
        <div
          className={`absolute inset-4 rounded-full border border-dashed border-cyan-400/50 ${
            isSpeaking ? 'animate-spin-fast' : 'animate-spin-slow'
          }`}
        />

        {/* Counter-rotating Inner Segment */}
        <div
          className={`absolute inset-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 border-b-cyan-400 ${
            isSpeaking ? 'animate-reverse-spin-fast' : 'animate-reverse-spin-slow'
          }`}
        />

        {/* Inner Core Housing */}
        <div className="absolute inset-12 rounded-full bg-slate-950 border-2 border-cyan-400/80 shadow-[inset_0_0_20px_#06b6d4] flex items-center justify-center overflow-hidden">
          {/* Triangular Arc Reactor Nodes */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* 3 Power Triangles */}
            {[0, 120, 240].map((deg) => (
              <div
                key={deg}
                className="absolute w-7 h-10 border border-cyan-300 bg-cyan-400/20 transform origin-bottom transition-all"
                style={{
                  transform: `rotate(${deg}deg) translateY(-8px)`,
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                }}
              />
            ))}

            {/* Central Pure Arc Glow */}
            <div
              className={`w-8 h-8 rounded-full bg-white shadow-[0_0_25px_#22d3ee,0_0_50px_#06b6d4] transition-transform duration-300 ${
                isSpeaking ? 'scale-125 animate-pulse' : isListening ? 'scale-110 bg-amber-200 shadow-[0_0_25px_#fbbf24]' : 'scale-100'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Reactive Audio Frequency Bars */}
      <div className="flex items-center gap-1 mt-4 h-6 px-4">
        {[40, 70, 30, 90, 50, 80, 20, 100, 60, 85, 45, 95, 35, 75, 55].map((height, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-150 ${
              isSpeaking
                ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                : isListening
                ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                : 'bg-cyan-900/40'
            }`}
            style={{
              height: isSpeaking
                ? `${Math.max(6, Math.round(height * Math.random()))}px`
                : isListening
                ? `${Math.max(4, Math.round(height * 0.6 * Math.random()))}px`
                : '4px',
            }}
          />
        ))}
      </div>

      {/* Status Label */}
      <div className="mt-2 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
          {statusText}
        </span>
        <div className="text-[10px] font-mono text-cyan-600 tracking-wider">
          MARK VII // STARK NEURAL CORE
        </div>
      </div>
    </div>
  );
};
