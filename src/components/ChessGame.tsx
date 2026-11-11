import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { 
  Trophy, RotateCcw, Volume2, ShieldAlert, Zap, 
  Cpu, ArrowRight, Camera, HelpCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { soundFx } from '../utils/soundFx';

export type Difficulty = 'boshlovchi' | 'o\'rta' | 'kuchli';
export type PlayerColor = 'w' | 'b';

interface ChessGameProps {
  onJarvisSpeak: (text: string) => void;
  onSendMoveToJarvis?: (moveSan: string, fen: string) => void;
  userTitle: string;
  externalMove?: string | null;
  onClearExternalMove?: () => void;
}

// Piece values for Minimax evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// SVG Piece icons for high-tech holographic board
const PieceIcon: React.FC<{ piece: { type: string; color: string } }> = ({ piece }) => {
  const isWhite = piece.color === 'w';
  const strokeColor = isWhite ? '#38bdf8' : '#f87171';
  const fillColor = isWhite ? 'rgba(56, 189, 248, 0.25)' : 'rgba(248, 113, 113, 0.25)';

  switch (piece.type) {
    case 'p': // Pawn
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <path
            d="M22.5 9c-2.2 0-4 1.8-4 4 0 1.2.5 2.2 1.3 3-.7.7-1.3 1.8-1.3 3 0 1.2.6 2.3 1.5 3-2 1.2-4.5 4-4.5 9h14c0-5-2.5-7.8-4.5-9 .9-.7 1.5-1.8 1.5-3 0-1.2-.6-2.3-1.3-3 .8-.8 1.3-1.8 1.3-3 0-2.2-1.8-4-4-4z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <path
            d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm1.5-4l1.5-16h15l1.5 16H13.5zM11 14h4v3h3v-3h4v3h3v-3h4v3h3v-3h4v-3H11v3z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <path
            d="M22 10c-5.5 0-10 4-10 9 0 2 .7 4 2 5.5l-2.5 4.5h6l1-2 3 1.5c4 2 8 0 8-5 0-3-1.5-6-4.5-8-2-1.3-4-2-7-5z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <path
            d="M9 36h27v-3H9v3zm13.5-30c-3 0-6 4-6 9 0 3 1.5 6 3 8-3 2-5 5-5 9h16c0-4-2-7-5-9 1.5-2 3-5 3-8 0-5-3-9-6-9z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]">
          <path
            d="M9 36h27v-3H9v3zm1.5-5l2-16 6 7 4-11 4 11 6-7 2 16H10.5z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]">
          <path
            d="M22.5 6v5m-2.5-2.5h5M9 36h27v-3H9v3zm3-3c0-7 4-11 7-14l3.5 4 3.5-4c3 3 7 7 7 14H12z"
            fill={fillColor}
            stroke={isWhite ? '#fbbf24' : '#f87171'}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
};

export const ChessGame: React.FC<ChessGameProps> = ({
  onJarvisSpeak,
  userTitle,
  externalMove,
  onClearExternalMove,
}) => {
  const [chess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(chess.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [difficulty, setDifficulty] = useState<Difficulty>('o\'rta');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<string>('O\'yin boshlanishga tayyor, janob.');
  const [capturedPieces, setCapturedPieces] = useState<{ w: string[]; b: string[] }>({ w: [], b: [] });
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState<boolean>(true);

  // Sync external moves from voice or camera recognition
  useEffect(() => {
    if (externalMove) {
      handleExternalVoiceMove(externalMove);
      onClearExternalMove?.();
    }
  }, [externalMove]);

  // Evaluate board material & simple positioning
  const evaluateBoard = (game: Chess): number => {
    let totalScore = 0;
    const board = game.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const val = PIECE_VALUES[piece.type] || 0;
          // Center control bonus
          const centerBonus = (r >= 2 && r <= 5 && c >= 2 && c <= 5) ? 15 : 0;
          const pieceVal = val + centerBonus;
          if (piece.color === 'w') {
            totalScore += pieceVal;
          } else {
            totalScore -= pieceVal;
          }
        }
      }
    }
    return totalScore;
  };

  // Minimax with Alpha-Beta Pruning for AI moves
  const minimax = (
    game: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): { score: number; bestMove?: Move } => {
    if (depth === 0 || game.isGameOver()) {
      return { score: evaluateBoard(game) };
    }

    const legalMoves = game.moves({ verbose: true });
    if (legalMoves.length === 0) {
      if (game.isCheckmate()) {
        return { score: isMaximizing ? -99999 : 99999 };
      }
      return { score: 0 };
    }

    let bestMove: Move = legalMoves[0];

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of legalMoves) {
        game.move(move);
        const evalScore = minimax(game, depth - 1, alpha, beta, false).score;
        game.undo();
        if (evalScore > maxEval) {
          maxEval = evalScore;
          bestMove = move;
        }
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return { score: maxEval, bestMove };
    } else {
      let minEval = Infinity;
      for (const move of legalMoves) {
        game.move(move);
        const evalScore = minimax(game, depth - 1, alpha, beta, true).score;
        game.undo();
        if (evalScore < minEval) {
          minEval = evalScore;
          bestMove = move;
        }
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return { score: minEval, bestMove };
    }
  };

  // Calculate captured pieces
  const updateCapturedPieces = () => {
    const history = chess.history({ verbose: true });
    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];

    history.forEach((m) => {
      if (m.captured) {
        if (m.color === 'w') {
          // White captured a black piece
          blackCaptured.push(m.captured);
        } else {
          // Black captured a white piece
          whiteCaptured.push(m.captured);
        }
      }
    });

    setCapturedPieces({ w: whiteCaptured, b: blackCaptured });
    setMoveHistory(history.map(m => m.san));
  };

  // Check state alerts
  const checkGameConditions = () => {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'Qora' : 'Oq';
      const isUserWinner = (winner === 'Oq' && playerColor === 'w') || (winner === 'Qora' && playerColor === 'b');
      const text = isUserWinner 
        ? `Mat! Tabriklayman ${userTitle}, ajoyib strategik g'alaba qozondingiz!` 
        : `Mat! O'yin yakunlandi, ${userTitle}. Mudofaadagi kamchiliklar oqibatida g'alaba menga nasib qildi.`;
      setGameStatus(text);
      soundFx.playCheckAlert();
      onJarvisSpeak(text);
      return;
    }

    if (chess.isStalemate()) {
      const text = `Pat! Durang natija qayd etildi, ${userTitle}. Hech kimda qonuniy yurish qolmadi.`;
      setGameStatus(text);
      onJarvisSpeak(text);
      return;
    }

    if (chess.isDraw()) {
      const text = `O'yin durang bilan tugadi, ${userTitle}.`;
      setGameStatus(text);
      onJarvisSpeak(text);
      return;
    }

    if (chess.isCheck()) {
      soundFx.playCheckAlert();
      onJarvisSpeak(`Shoh, ${userTitle}!`);
      setGameStatus(`Shoh!`);
    }
  };

  // Trigger JARVIS (AI) Move
  const makeJarvisMove = useCallback(() => {
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return;

    setIsAiThinking(true);

    setTimeout(() => {
      let chosenMove: Move | undefined;

      if (difficulty === 'boshlovchi') {
        // Beginner: random with light capture bias
        const captures = legalMoves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() < 0.4) {
          chosenMove = captures[Math.floor(Math.random() * captures.length)];
        } else {
          chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
      } else if (difficulty === 'o\'rta') {
        // Intermediate: 2-ply depth
        const isWhite = chess.turn() === 'w';
        const result = minimax(chess, 2, -Infinity, Infinity, isWhite);
        chosenMove = result.bestMove || legalMoves[0];
      } else {
        // Advanced (kuchli): 3-ply depth
        const isWhite = chess.turn() === 'w';
        const result = minimax(chess, 3, -Infinity, Infinity, isWhite);
        chosenMove = result.bestMove || legalMoves[0];
      }

      if (chosenMove) {
        const moveResult = chess.move(chosenMove);
        soundFx.playChessMove();
        setFen(chess.fen());
        setLastMove({ from: chosenMove.from, to: chosenMove.to });
        updateCapturedPieces();

        // Convert move to spoken Uzbek notation
        const pieceNamesUz: Record<string, string> = {
          p: 'piyoda',
          n: 'ot',
          b: 'fil',
          r: 'to\'ra',
          q: 'farzin',
          k: 'shoh',
        };
        const pieceUz = pieceNamesUz[chosenMove.piece] || '';
        const announceText = chosenMove.san === 'O-O' 
          ? `Qisqa rokirovka` 
          : chosenMove.san === 'O-O-O' 
          ? `Uzun rokirovka`
          : `Mening yurishim: ${pieceUz} ${chosenMove.to} ga (${chosenMove.san})`;

        // Occasional witty commentary
        const wittyRemarks = [
          'Qiziq yurish, janob.',
          'Pozitsiyani mustahkamlaymiz.',
          'Markazni nazoratga olish muhim, janob.',
          'Sizningcha bu yaxshi mudofaami?',
        ];
        const remark = Math.random() > 0.65 ? ' ' + wittyRemarks[Math.floor(Math.random() * wittyRemarks.length)] : '';

        onJarvisSpeak(`${announceText}.${remark}`);
        setGameStatus(`JARVIS: ${chosenMove.san}`);
        checkGameConditions();
      }

      setIsAiThinking(false);
    }, 600);
  }, [chess, difficulty, onJarvisSpeak, userTitle]);

  // Handle Square Click by Player
  const handleSquareClick = (square: Square) => {
    if (isAiThinking) return;
    if (chess.isGameOver()) return;

    // Check if it's player's turn
    const isPlayerTurn = chess.turn() === playerColor;
    if (!isPlayerTurn) {
      return;
    }

    const piece = chess.get(square);

    // If a square is already selected, try to move there
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      const move = validMoves.find(m => m.to === square);
      if (move) {
        // Execute move
        const moveResult = chess.move({
          from: selectedSquare,
          to: square,
          promotion: 'q', // auto-queen for streamlined UX
        });

        if (moveResult) {
          soundFx.playChessMove();
          setFen(chess.fen());
          setLastMove({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setValidMoves([]);
          updateCapturedPieces();
          setGameStatus(`Sizning yurishingiz: ${moveResult.san}`);

          checkGameConditions();

          // Trigger AI turn if game is not over
          if (!chess.isGameOver()) {
            makeJarvisMove();
          }
          return;
        }
      }
    }

    // Selecting a piece
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = chess.moves({ square, verbose: true });
      setValidMoves(moves);
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  // Parse voice move e.g., "e2-e4", "e4", "ot f3", "fil c4"
  const handleExternalVoiceMove = (input: string) => {
    const clean = input.toLowerCase().trim();
    const legalMoves = chess.moves({ verbose: true });

    // 1. Direct SAN match (e.g., "e4", "Nf3", "Qxd4")
    let targetMove = legalMoves.find(m => m.san.toLowerCase() === clean);

    // 2. Square to square (e.g. "e2-e4", "e2 e4", "e2 to e4")
    if (!targetMove) {
      const match = clean.match(/([a-h][1-8])[- \s]+([a-h][1-8])/);
      if (match) {
        targetMove = legalMoves.find(m => m.from === match[1] && m.to === match[2]);
      }
    }

    // 3. Uzbek piece name + destination (e.g. "ot f3", "fil c4", "piyoda e4")
    if (!targetMove) {
      const uZMatch = clean.match(/(ot|fil|ruh|to'ra|tora|farzin|vazir|shoh|piyoda)[\s]+([a-h][1-8])/);
      if (uZMatch) {
        const pieceTypeMap: Record<string, string> = {
          'ot': 'n',
          'fil': 'b',
          'ruh': 'r',
          "to'ra": 'r',
          'tora': 'r',
          'farzin': 'q',
          'vazir': 'q',
          'shoh': 'k',
          'piyoda': 'p',
        };
        const pType = pieceTypeMap[uZMatch[1]];
        const dest = uZMatch[2];
        targetMove = legalMoves.find(m => m.piece === pType && m.to === dest);
      }
    }

    if (targetMove) {
      chess.move(targetMove);
      soundFx.playChessMove();
      setFen(chess.fen());
      setLastMove({ from: targetMove.from, to: targetMove.to });
      updateCapturedPieces();
      onJarvisSpeak(`Sizning ${targetMove.san} yurishingiz qabul qilindi, ${userTitle}.`);
      checkGameConditions();
      if (!chess.isGameOver()) {
        makeJarvisMove();
      }
    } else {
      onJarvisSpeak(`Kechirasiz ${userTitle}, "${input}" yurishini doskada topa olmadim yoki bu noqonuniy yurish. Qayta urinib ko'ring.`);
    }
  };

  // Start new game
  const startNewGame = (color: PlayerColor, diff: Difficulty) => {
    chess.reset();
    setFen(chess.fen());
    setPlayerColor(color);
    setDifficulty(diff);
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setCapturedPieces({ w: [], b: [] });
    setMoveHistory([]);
    setShowConfig(false);

    const greeting = color === 'w'
      ? `Ajoyib, ${userTitle}. Siz oq donalarda o'ynaysiz. Birinchi yurish sizdan. Muvaffaqiyat tilayman!`
      : `Tushunarli, ${userTitle}. Siz qora donalarda o'ynaysiz. Birinchi yurishni men boshlayman.`;
    
    setGameStatus(greeting);
    onJarvisSpeak(greeting);

    if (color === 'b') {
      setTimeout(() => {
        makeJarvisMove();
      }, 500);
    }
  };

  // Render 8x8 Board
  const ranks = playerColor === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = playerColor === 'w' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  return (
    <div className="relative flex flex-col bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-md">
      {/* Top Header & Telemetry */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-cyan-500/20 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-bold">
            JARVIS TACTICAL CHESS V4.2
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-500/40 text-cyan-300">
            {difficulty.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:border-cyan-400 transition"
          >
            {showConfig ? 'O\'yinga qaytish' : 'Sozlamalar'}
          </button>
          <button
            onClick={() => startNewGame(playerColor, difficulty)}
            title="Qayta boshlash"
            className="p-1.5 rounded bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:text-white hover:border-cyan-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Game Config Overlay (if active) */}
      {showConfig && (
        <div className="p-4 mb-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-100 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm font-semibold">
            <Zap className="w-4 h-4 text-amber-400" />
            O'yin Parametrlari (Rang va Mahorat darajasi)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-cyan-400/80 mb-1.5">Sizning rangingiz:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPlayerColor('w')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono border transition flex items-center justify-center gap-1.5 ${
                    playerColor === 'w'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-cyan-200" />
                  Oq (Birinchi yurish)
                </button>
                <button
                  onClick={() => setPlayerColor('b')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono border transition flex items-center justify-center gap-1.5 ${
                    playerColor === 'b'
                      ? 'bg-red-500/20 border-red-400 text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.3)]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  Qora (JARVIS boshlaydi)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-cyan-400/80 mb-1.5">JARVIS ning darajasi:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['boshlovchi', 'o\'rta', 'kuchli'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2 px-2 text-center rounded-lg text-xs font-mono border capitalize transition ${
                      difficulty === d
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => startNewGame(playerColor, difficulty)}
            className="w-full py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            O'yinni Boshlash
          </button>
        </div>
      )}

      {/* Main Board & Status */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-center">
        {/* Holographic Chessboard */}
        <div className="relative p-2.5 bg-slate-900/90 rounded-xl border border-cyan-500/40 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]">
          {/* Coordinates indicator corners */}
          <div className="grid grid-cols-8 gap-0.5 w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] border border-cyan-500/50 rounded-lg overflow-hidden relative">
            {ranks.map((rank) =>
              files.map((file) => {
                const square = `${file}${rank}` as Square;
                const piece = chess.get(square);
                const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 1;
                const isSelected = selectedSquare === square;
                const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
                const isValidDest = validMoves.some(m => m.to === square);

                return (
                  <div
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    className={`relative flex items-center justify-center select-none cursor-pointer transition-colors duration-150 ${
                      isLight ? 'bg-slate-800/80' : 'bg-slate-950/90'
                    } ${
                      isSelected
                        ? '!bg-cyan-500/40 ring-2 ring-cyan-300 ring-inset shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                        : isLastMoveSquare
                        ? '!bg-cyan-900/30 ring-1 ring-cyan-500/50 ring-inset'
                        : ''
                    }`}
                  >
                    {/* Destination marker dot */}
                    {isValidDest && (
                      <div className={`absolute z-10 rounded-full transition-transform ${
                        piece 
                          ? 'w-full h-full border-2 border-amber-400/80 bg-amber-400/20' 
                          : 'w-3 h-3 bg-cyan-400/80 shadow-[0_0_8px_#22d3ee]'
                      }`} />
                    )}

                    {/* Coordinate labels on edges */}
                    {file === files[0] && (
                      <span className="absolute left-1 top-0.5 text-[9px] font-mono text-cyan-600 font-bold pointer-events-none">
                        {rank}
                      </span>
                    )}
                    {rank === ranks[7] && (
                      <span className="absolute right-1 bottom-0.5 text-[9px] font-mono text-cyan-600 font-bold pointer-events-none">
                        {file}
                      </span>
                    )}

                    {/* Chess Piece */}
                    {piece && (
                      <div className="relative z-0 flex items-center justify-center w-full h-full hover:scale-105 transition-transform">
                        <PieceIcon piece={piece} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* AI Thinking Overlay */}
          {isAiThinking && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 rounded-xl border border-cyan-400/50">
              <Cpu className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-cyan-300 tracking-wider animate-pulse">
                JARVIS HISOBLAMOQDA...
              </span>
            </div>
          )}
        </div>

        {/* Side Panel: Game Log, Captured Pieces, Voice Instructions */}
        <div className="flex-1 w-full lg:max-w-[280px] flex flex-col gap-3">
          {/* Status Alert Card */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-start gap-2.5">
            <Volume2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-cyan-200">
              <div className="text-[10px] uppercase text-cyan-500 font-bold">JARVIS Holati:</div>
              {gameStatus}
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/20 text-xs font-mono">
            <span className="text-slate-400">Yurish navbati:</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${chess.turn() === 'w' ? 'bg-cyan-300 shadow-[0_0_6px_#67e8f9]' : 'bg-red-400 shadow-[0_0_6px_#f87171]'}`} />
              <span className={chess.turn() === playerColor ? 'text-emerald-400 font-bold' : 'text-cyan-300'}>
                {chess.turn() === playerColor ? 'Sizning navbatingiz' : 'JARVIS navbati'}
              </span>
            </div>
          </div>

          {/* Captured Pieces */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/20 text-xs font-mono flex flex-col gap-1.5">
            <div className="text-[10px] text-cyan-400/70 uppercase">Urib olingan donalar:</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Oq donalar:</span>
              <span className="text-cyan-300 text-[11px] font-bold">
                {capturedPieces.w.join(' ').toUpperCase() || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Qora donalar:</span>
              <span className="text-red-300 text-[11px] font-bold">
                {capturedPieces.b.join(' ').toUpperCase() || '—'}
              </span>
            </div>
          </div>

          {/* Move History / PGN */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/20 text-xs font-mono flex flex-col gap-1">
            <div className="text-[10px] text-cyan-400/70 uppercase">Yurishlar tarixi ({moveHistory.length}):</div>
            <div className="h-24 overflow-y-auto pr-1 text-[11px] text-cyan-200 flex flex-wrap gap-1 font-mono">
              {moveHistory.length === 0 && <span className="text-slate-500">Hali yurish qilinmadi</span>}
              {moveHistory.map((m, idx) => (
                <span key={idx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-cyan-900 text-cyan-300">
                  {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ''}{m}
                </span>
              ))}
            </div>
          </div>

          {/* Voice Command Hint */}
          <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 flex items-start gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-200">Ovoz orqali yurish:</span> Mikrofondan "e2-e4", "ot f3" yoki "fil c4 ga" deb ayting!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
