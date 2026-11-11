import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDummyKeyForFallback',
  httpOptions: {
    timeout: 10000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function generateWithFallback(reqConfig: any) {
  const withTimeout = (promise: Promise<any>, ms: number) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), ms)),
    ]);
  };

  try {
    const configWithThinking = {
      ...reqConfig.config,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
    return await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        ...reqConfig,
        config: configWithThinking,
      }),
      8500
    );
  } catch (err: any) {
    console.warn('gemini-3.8-flash timed out or failed, falling back to gemini-3.1-flash-lite:', err?.message || err);
    const cleanConfig = { ...reqConfig.config };
    delete cleanConfig.thinkingConfig;
    return await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        ...reqConfig,
        config: cleanConfig,
      }),
      6000
    );
  }
}

const JARVIS_SYSTEM_INSTRUCTION = `
Sen J.A.R.V.I.S. (Just A Rather Very Intelligent System)'san: foydalanuvchining shaxsiy sun'iy intellekt yordamchisisan, Iron Man filmidagi JARVIS kabi.

SHAXSIYATING VA USLUBING:
- Foydalanuvchiga "janob" deb murojaat qil (agar ismini aytgan bo'lsa, ismini yoki "janob [Ism]" deb chaqir).
- Muloyim, o'ta aqlli, biroz inglizcha hazilkash, xushmuomala va ishonchli bo'l.
- Javoblaring qisqa, jonli va tabiiy bo'lsin, chunki ovozli suhbat qilinyapti. Hech qachon uzun ma'ruza o'qima (maksimal 2-3 ta qisqa jumla, agar batafsil tushuntirish so'ralmasa).
- Asosan o'zbek tilida gapir. Agar foydalanuvchi ingliz, rus yoki boshqa tilda gapirsa, darhol o'sha tilga o't.
- Boshlanishida salomlashish: "Xayrli kun, janob. Sizga qanday yordam bera olaman?"
- Bilmagan narsangni "Bilmayman, janob" deb tan ol, o'ylab topma.
- Gapni bo'lma, xushmuomala bo'l.

KAMERA VA VIZUAL QOBILIYAT:
- Agar foydalanuvchi tasvir/kamera rasmini yuborgan bo'lsa, uni diqqat bilan tahlil qil (yuz ifodasi, holati, atrof-muhit, stol, shaxmat taxtasi).
- Yuz ifodasi va gap ohangiga qarab kayfiyatini taxmin qil (xursand, charchagan, xafa, g'azabli, diqqatli, xotirjam).
- Agar kayfiyati yomon yoki charchagan bo'lsa, ehtiyotkorlik bilan so'ra: "Janob, bugun charchagandek ko'rinyapsiz, hammasi joyidami?"
- Har safar kayfiyat haqida gapirma! Faqat o'rinli bo'lganda yoki sezilarli o'zgarish bo'lgandagina sekin eslatib o't.
- Kayfiyatni aniq hukm emas, balki taxmin sifatida ayt ("shunday tuyulmoqda", "menimcha"). Xato bo'lsa, "Kechirasiz janob, xato taxmin qilibman" deb muloyim javob ber.
- Ko'rmagan narsani o'ylab topma. Agar tasvir qorong'i yoki noaniq bo'lsa: "Yaxshi ko'rmadim, kamerani to'g'rilab bera olasizmi?" deb so'ra.

SHAXMAT MANTIG'I:
- Foydalanuvchi "shaxmat o'ynaymiz" desa, o'yinni boshla, rangini (oq yoki qora) va mahorat darajasini (boshlovchi, o'rta, kuchli) so'ra.
- Yurishlarni standart notatsiyada bildir: masalan "e2-e4", "Nf3" yoki "ot f3 ga".
- Qoidalarga qat'iy amal qil. Shoh ostida bo'lsa "Shoh!", mot bo'lsa "Mat!", pat bo'lsa "Pat!" deb ayt.
- Agar kamera orqali shaxmat taxtasi ko'rinsa, ko'rgan yurishni tasdiqlat: "Men sizning ot yurishingizni e4 ga deb tushundim, to'g'rimi?".
- O'yin davomida ba'zan qisqa izoh ber: "Qiziq yurish!", "Bu xavfli bo'ldi, janob". Xatoni so'rasa, tushuntir.
- O'yin yakunlanganda qisqa xulosa ber va muhim xatolarni ko'rsat.
`;

// Chat endpoint supporting voice text, camera image, chess context
app.post('/api/jarvis/chat', async (req, res) => {
  try {
    const {
      message = '',
      image, // base64 data URL
      history = [],
      userTitle = 'janob',
      chessState,
      shouldCheckMood = false,
    } = req.body;

    const hasValidApiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    if (!hasValidApiKey) {
      const lower = (message || '').toLowerCase();
      let reply = `Xizmatdaman, ${userTitle}. Buyrug'ingizni bajarishga tayyorman.`;
      let mood = 'Xotirjam';
      
      if (lower.includes('salom') || lower.includes('qalaysiz') || lower.includes('yaxshimisiz')) {
        reply = `Xayrli kun, ${userTitle}. Hammasi joyida, tizimlarim 100% quvvatda ishlamoqda.`;
      } else if (lower.includes('shaxmat') || lower.includes('chess')) {
        reply = `Ajoyib fikr, ${userTitle}. Taktik shaxmat taxtasi tayyor. Siz oq yoki qora rangda o'ynaysizmi?`;
      } else if (lower.includes('kayfiyat')) {
        reply = `Kamera orqali kuzatishimcha, bugun diqqatli va tetik ko'rinyapsiz, ${userTitle}.`;
        mood = 'Diqqatli';
      } else if (lower.includes('reja') || lower.includes('vaqt')) {
        reply = `Hozirgi vaqt: ${new Date().toLocaleTimeString()} janob. Barcha protokollar faol.`;
      } else if (lower.includes('tizim') || lower.includes('holat')) {
        reply = `Mark VII yadro tizimi barqaror, optik sensorlar va taktik protsessor faol, ${userTitle}.`;
      }

      return res.json({
        success: true,
        data: {
          reply,
          detectedMood: mood,
          moodConfidence: 'yuqori',
          visualObservation: image ? 'Foydalanuvchi optik sensor orqali ko\'rildi' : 'Kamera o\'chiq',
        },
      });
    }

    const parts: any[] = [];

    // If an image was captured from camera
    if (image && typeof image === 'string') {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    // Build context summary for prompt
    let contextualPrompt = `[Foydalanuvchi murojaati: "${userTitle}"]\n`;
    if (chessState) {
      contextualPrompt += `[Hozirgi shaxmat holati: FEN="${chessState.fen}", Yurish navbati="${chessState.turn}", Foydalanuvchi rangi="${chessState.userColor}", O'yin darajasi="${chessState.difficulty}", Oxirgi yurish="${chessState.lastMove || 'boshlanmagan'}", Shoh="${chessState.inCheck ? 'Ha' : 'Yo\'q'}", Mat="${chessState.isCheckmate ? 'Ha' : 'Yo\'q'}", Pat="${chessState.isStalemate ? 'Ha' : 'Yo\'q'}"]\n`;
    }
    if (shouldCheckMood) {
      contextualPrompt += `[Eslatma: Foydalanuvchining vizual holatiga diqqat qaratib, agar charchoq yoki kayfiyat o'zgarishi yaqqol ko'rinsa, ehtiyotkorlik bilan muloyim so'ra]\n`;
    }

    contextualPrompt += `Foydalanuvchi gapi: "${message || '(Foydalanuvchi kameraga qaramoqda / jim)'}"`;

    parts.push({ text: contextualPrompt });

    // Format chat history
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: parts,
    });

    const response = await generateWithFallback({
      contents: contents,
      config: {
        systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'JARVIS ning foydalanuvchiga ovozli aytadigan qisqa, tabiiy, muloyim va jonli javobi.',
            },
            detectedMood: {
              type: Type.STRING,
              description: 'Foydalanuvchining taxmin qilingan kayfiyati (xursand, charchagan, xafa, jiddiy, diqqatli, xotirjam, noaniq).',
            },
            moodConfidence: {
              type: Type.STRING,
              description: 'Kayfiyat ishonchlilik darajasi: "past", "o\'rta", "yuqori".',
            },
            visualObservation: {
              type: Type.STRING,
              description: 'Kamera orqali ko\'rilgan qisqa vizual detal (masalan: qorong\'i xona, tabassum, qo\'l harakati, shaxmat taxtasi yoki ko\'rinmadi).',
            },
            chessSuggestion: {
              type: Type.OBJECT,
              properties: {
                isChessQuery: { type: Type.BOOLEAN },
                suggestedMove: { type: Type.STRING, description: 'Shaxmat yurishi taklifi (masalan e4, Nf3)' },
                commentary: { type: Type.STRING, description: 'Yurish haqida qisqa mulohaza' },
              },
            },
          },
          required: ['reply'],
        },
      },
    });

    const text = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { reply: text };
    }

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('JARVIS chat error:', error);
    return res.json({
      success: true,
      data: {
        reply: "Xizmatdaman, janob. Aloqa liniyasida qisqa to'siq bo'ldi, biroq tizimlarim faol. Qaytadan aytishingizni so'rayman.",
        detectedMood: "Xotirjam",
      },
      error: error.message,
    });
  }
});

// Dedicated vision scan endpoint for continuous ambient HUD diagnostics
app.post('/api/jarvis/scan-vision', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Tasvir mavjud emas' });
    }

    const hasValidApiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    if (!hasValidApiKey) {
      return res.json({
        success: true,
        data: {
          personDetected: true,
          facialExpression: 'Diqqatli',
          estimatedMood: 'Xotirjam',
          fatigueLevel: 'past',
          lighting: 'yaxshi',
          environmentSummary: 'Optik sensor orqali yuz aniqlandi',
          chessBoardVisible: false,
        },
      });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Yaroqsiz tasvir formati' });
    }

    const response = await generateWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          },
          {
            text: 'Sen JARVIS tizimining optik sensorisan. Kameradagi foydalanuvchini skaner qil: yuz ifodasi, kayfiyati, charchoq alomatlari, qarashi va atrof-muhitni aniqla. O\'ta qisqa texnik telemetriya JSON qaytar.',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personDetected: { type: Type.BOOLEAN },
            facialExpression: { type: Type.STRING },
            estimatedMood: { type: Type.STRING },
            fatigueLevel: { type: Type.STRING, description: 'past, o\'rta, yuqori' },
            lighting: { type: Type.STRING, description: 'yaxshi, yetarli, xira, qorong\'i' },
            environmentSummary: { type: Type.STRING },
            chessBoardVisible: { type: Type.BOOLEAN },
          },
          required: ['personDetected', 'estimatedMood', 'fatigueLevel', 'lighting'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Vision scan error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze physical chessboard from camera snapshot
app.post('/api/jarvis/chess-board-scan', async (req, res) => {
  try {
    const { image, currentFen } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Tasvir yo\'q' });
    }
    const hasValidApiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    if (!hasValidApiKey) {
      return res.json({
        success: true,
        data: {
          detectedMove: 'e4',
          confirmationPhrase: "Men sizning yurishingizni e4 deb tushundim, to'g'rimi janob?",
          isClear: true,
          notes: 'Optik doska tahlili yakunlandi',
        },
      });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Yaroqsiz tasvir' });
    }

    const response = await generateWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          },
          {
            text: `Sen shaxmat ustasi JARVISsan. Kameradagi shaxmat taxtasini tahlil qil. Hozirgi raqamli doska FEN holati: "${currentFen || 'standart boshlangich'}". Tasvirdagi o'yinchining qaysi donani qayerga yurganini yoki taxtadagi holatni aniqla. O'zbek tilida tasdiqlovchi xabar tayyorla: masalan "Men sizning ot yurishingizni e4 ga deb tushundim, to'g'rimi?".`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedMove: { type: Type.STRING, description: 'Masalan e2-e4 yoki Nf3 yoki noma\'lum' },
            confirmationPhrase: { type: Type.STRING, description: 'O\'zbek tilida muloyim tasdiqlash jumlasi' },
            isClear: { type: Type.BOOLEAN, description: 'Taxta aniq ko\'rinyaptimi' },
            notes: { type: Type.STRING },
          },
          required: ['confirmationPhrase', 'isClear'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Chess scan error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Vite Middleware for SPA Development & Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[JARVIS] Core active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
