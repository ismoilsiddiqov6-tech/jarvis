import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Eye, Scan, Sparkles, AlertCircle, RefreshCw, Grid } from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface CameraModuleProps {
  onCaptureSnapshot?: (dataUrl: string) => void;
  onVisionDiagnostics?: (diag: any) => void;
  onChessBoardDetected?: (move: string, confirmation: string) => void;
  currentFen?: string;
  isScanning?: boolean;
}

export const CameraModule: React.FC<CameraModuleProps> = ({
  onCaptureSnapshot,
  onVisionDiagnostics,
  onChessBoardDetected,
  currentFen,
  isScanning = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<{
    personDetected?: boolean;
    estimatedMood?: string;
    fatigueLevel?: string;
    lighting?: string;
    environmentSummary?: string;
    facialExpression?: string;
  } | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('Hali skanerlanmadi');

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      soundFx.playActivate();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Kameraga ulanish imkoni bo\'lmadi. Brauzer ruxsatini tekshiring.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Grab Base64 Snapshot
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onCaptureSnapshot?.(dataUrl);
    return dataUrl;
  }, [isCameraActive, onCaptureSnapshot]);

  // Periodic or manual ambient scan for mood and environment
  const analyzeEnvironment = async () => {
    const frame = captureFrame();
    if (!frame) return;

    setIsAnalyzing(true);
    soundFx.playScan();

    try {
      const res = await fetch('/api/jarvis/scan-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDiagnostics(data.data);
        onVisionDiagnostics?.(data.data);
        const now = new Date();
        setLastScanTime(now.toLocaleTimeString());
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Dedicated physical chess board scanner
  const scanPhysicalChessboard = async () => {
    const frame = captureFrame();
    if (!frame) return;

    setIsAnalyzing(true);
    soundFx.playScan();

    try {
      const res = await fetch('/api/jarvis/chess-board-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame, currentFen: currentFen }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        onChessBoardDetected?.(data.data.detectedMove, data.data.confirmationPhrase);
      }
    } catch (err) {
      console.error('Physical board scan error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="relative flex flex-col bg-slate-950/85 border border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.12)] backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-bold">
            OPTIK SENSOR // VIZUAL KO'RISH
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              isCameraActive
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {isCameraActive ? 'FAOL' : 'O\'CHIRILGAN'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="px-2.5 py-1 text-xs font-mono rounded bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 transition flex items-center gap-1.5"
            >
              <CameraOff className="w-3.5 h-3.5" />
              Kamerani yopish
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-2.5 py-1 text-xs font-mono rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60 transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
            >
              <Camera className="w-3.5 h-3.5" />
              Kamerani yoqish
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport with Iron Man HUD Reticle */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-cyan-500/40 flex items-center justify-center">
        {isCameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Stark HUD Holographic Overlays */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
              {/* Corner brackets */}
              <div className="flex justify-between w-full">
                <div className="w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
              </div>

              {/* Center Targeting Reticle */}
              <div className="self-center relative flex items-center justify-center">
                <div className="w-24 h-24 border border-cyan-400/40 rounded-full animate-spin-slow" />
                <div className="absolute w-28 h-28 border border-dashed border-cyan-400/30 rounded-full" />
                <div className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                <div className="absolute -top-6 font-mono text-[9px] text-cyan-400/80 tracking-widest uppercase">
                  VIZUAL IDENTIFIKATSIYA
                </div>
              </div>

              {/* Bottom brackets & Telemetry */}
              <div className="flex justify-between items-end w-full">
                <div className="w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
                <div className="text-[10px] font-mono text-cyan-400/80 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-500/30">
                  FOV: 84° // LOCK: AKTIV
                </div>
                <div className="w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>

            {/* Scanning Laser Animation */}
            {(isAnalyzing || isScanning) && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-scan pointer-events-none" />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6 text-slate-500">
            <Camera className="w-12 h-12 text-slate-700 stroke-[1.5]" />
            <div className="text-xs font-mono text-slate-400 max-w-xs">
              Optik ko'rish o'chiq. JARVIS sizni, yuz ifodangizni, kayfiyatingizni va shaxmat taxtangizni ko'rishi uchun kamerani faollashtiring.
            </div>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-lg font-mono text-xs bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 transition shadow-[0_0_12px_rgba(6,182,212,0.2)]"
            >
              Kamerani ulash
            </button>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <div className="text-xs font-mono text-red-300">{cameraError}</div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Diagnostics & Scan Actions */}
      {isCameraActive && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={analyzeEnvironment}
              disabled={isAnalyzing}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/60 hover:border-cyan-400 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Scan className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Kayfiyatni Skanerlash
            </button>

            <button
              onClick={scanPhysicalChessboard}
              disabled={isAnalyzing}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-slate-800 hover:border-cyan-400 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Grid className="w-3.5 h-3.5" />
              Doskani Skanerlash
            </button>
          </div>

          {/* Telemetry Readout */}
          {diagnostics && (
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-cyan-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-cyan-300">
              <div>
                <span className="text-cyan-500/70 block text-[9px] uppercase">Kayfiyat:</span>
                <span className="font-semibold text-emerald-300">{diagnostics.estimatedMood || 'Xotirjam'}</span>
              </div>
              <div>
                <span className="text-cyan-500/70 block text-[9px] uppercase">Yuz ifodasi:</span>
                <span className="font-semibold text-cyan-200">{diagnostics.facialExpression || 'Oddiy'}</span>
              </div>
              <div>
                <span className="text-cyan-500/70 block text-[9px] uppercase">Charchoq:</span>
                <span className="font-semibold text-amber-300">{diagnostics.fatigueLevel || 'Past'}</span>
              </div>
              <div>
                <span className="text-cyan-500/70 block text-[9px] uppercase">Yoritilganlik:</span>
                <span className="font-semibold text-cyan-200">{diagnostics.lighting || 'Yetarli'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
