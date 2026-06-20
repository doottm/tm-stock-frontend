/**
 * Real-Time Face-to-Face Translation and Guidance - Client Application
 */

// --- Global Application State ---
let audioContext = null;
let micStream = null;
let mediaStreamSource = null; // Prevent Safari GC
let audioWorkletNode = null;
let ws = null;

let currentStaffTurnText = "";
let currentCustomerTurnText = "";

let isRecordingStaff = false;
let isRecordingCustomer = false;
let isPTTMode = true; // Default to Push-to-Talk (Checked)
let targetLanguage = 'en';
let lastActiveSpeaker = 'staff'; // Track speaker turn independently of mic state

let rawAudioBuffer = [];
let nextPlaybackTime = 0;

// Web Speech API TTS global state to prevent Garbage Collection issues
let ttsUtterance = null;

// Warm-up/preload browser voices for speechSynthesis
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      console.log('[TTS] Web Speech voices updated. Count:', window.speechSynthesis.getVoices().length);
    };
  }
}

// Conversation Scripts Log (for Google Sheets Database)
const conversationHistory = {
  staff: [],
  customer: []
};

// --- DOM Elements ---
const welcomeOverlay = document.getElementById('welcome-overlay');
const btnStartApp = document.getElementById('btn-start-app');
const selectLanguage = document.getElementById('select-language');
const toggleMicMode = document.getElementById('toggle-mic-mode');
const btnMicStaff = document.getElementById('btn-mic-staff');
const btnMicCustomer = document.getElementById('btn-mic-customer');
const btnSaveLog = document.getElementById('btn-save-log');

// Stop timeouts for push-to-talk release delay
let staffStopTimeout = null;
let customerStopTimeout = null;

const staffSubtitleSource = document.getElementById('staff-subtitle-source');
const staffSubtitleTarget = document.getElementById('staff-subtitle-target');
const customerSubtitleTarget = document.getElementById('customer-subtitle-target');
const customerSubtitleSource = document.getElementById('customer-subtitle-source');

const customerStatus = document.getElementById('customer-status');
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');
const toastContainer = document.getElementById('toast-container');
const btnAddPhrase = document.getElementById('btn-add-phrase');
const quickPhrasesContainer = document.getElementById('quick-phrases-container');
const customerBadge = document.getElementById('customer-badge');

// --- Customer Localization Dictionary ---
const customerTranslations = {
  en: {
    customerBadge: "Customer",
    statusReady: "Ready to speak",
    statusSpeaking: "Speaking",
    placeholderTarget: "Your translation will appear here.",
    placeholderSource: "(What you speak will appear here)",
    btnPTT: "Press to Speak",
    btnToggleOff: "Mic Off",
    btnToggleOn: "Mic On",
    btnListening: "Listening..."
  },
  ja: {
    customerBadge: "お客様",
    statusReady: "話す準備가 되었습니다", // Wait, in Japanese: 話す準備ができました
    statusSpeaking: "話し中...",
    placeholderTarget: "ここに翻訳が表示されます。",
    placeholderSource: "(話した内容がここに表示されます)",
    btnPTT: "押して話す",
    btnToggleOff: "マイク：オフ",
    btnToggleOn: "マイク：オン",
    btnListening: "聞き取り中..."
  },
  'zh-CN': {
    customerBadge: "顾客",
    statusReady: "准备说话",
    statusSpeaking: "正在说话...",
    placeholderTarget: "翻译内容将在此处显示。",
    placeholderSource: "(您说的话将在此处显示)",
    btnPTT: "按住说话",
    btnToggleOff: "麦克风：关闭",
    btnToggleOn: "麦克风：开启",
    btnListening: "正在聆听..."
  },
  'zh-TW': {
    customerBadge: "顧客",
    statusReady: "準備說話",
    statusSpeaking: "正在說話...",
    placeholderTarget: "翻譯內容將在此處顯示。",
    placeholderSource: "(您說的話將在此處顯示)",
    btnPTT: "按住說話",
    btnToggleOff: "麥克風：關閉",
    btnToggleOn: "麥克風：開啟",
    btnListening: "正在聆聽..."
  },
  es: {
    customerBadge: "Cliente",
    statusReady: "Listo para hablar",
    statusSpeaking: "Hablando...",
    placeholderTarget: "Su traducción aparecerá aquí.",
    placeholderSource: "(Lo que hable aparecerá aquí)",
    btnPTT: "Presiona para hablar",
    btnToggleOff: "Micrófono apagado",
    btnToggleOn: "Micrófono encendido",
    btnListening: "Escuchando..."
  },
  fr: {
    customerBadge: "Client",
    statusReady: "Prêt à parler",
    statusSpeaking: "Parle...",
    placeholderTarget: "Votre traduction apparaîtra ici.",
    placeholderSource: "(Ce que vous dites apparaîtra ici)",
    btnPTT: "Appuyez pour parler",
    btnToggleOff: "Micro désactivé",
    btnToggleOn: "Micro activé",
    btnListening: "Écoute..."
  },
  vi: {
    customerBadge: "Khách hàng",
    statusReady: "Sẵn sàng nói",
    statusSpeaking: "Đang nói...",
    placeholderTarget: "Bản dịch của bạn sẽ hiển thị ở đây.",
    placeholderSource: "(Những gì bạn nói sẽ hiển thị ở đây)",
    btnPTT: "Nhấn để nói",
    btnToggleOff: "Tắt mic",
    btnToggleOn: "Bật mic",
    btnListening: "Đang lắng nghe..."
  },
  ru: {
    customerBadge: "Клиент",
    statusReady: "Готов говорить",
    statusSpeaking: "Говорит...",
    placeholderTarget: "Ваш перевод появится здесь.",
    placeholderSource: "(То, что вы говорите, появится здесь)",
    btnPTT: "Удерживайте, чтобы говорить",
    btnToggleOff: "Микр. выкл.",
    btnToggleOn: "Микр. вкл.",
    btnListening: "Слушаю..."
  },
  th: {
    customerBadge: "ลูกค้า",
    statusReady: "พร้อมพูด",
    statusSpeaking: "กำลังพูด...",
    placeholderTarget: "คำแปลของคุณจะปรากฏที่นี่",
    placeholderSource: "(สิ่งที่คุณพูดจะปรากฏที่นี่)",
    btnPTT: "กดเพื่อพูด",
    btnToggleOff: "ปิดไมค์",
    btnToggleOn: "เปิดไมค์",
    btnListening: "กำลังฟัง..."
  }
};

// Fix typo in Japanese statusReady
customerTranslations.ja.statusReady = "話す準備ができました";

// Dynamic Localization for Customer Panel
function updateCustomerUILanguage() {
  const lang = targetLanguage;
  const translations = customerTranslations[lang] || customerTranslations['en'];
  
  // 1. Customer Badge text
  if (customerBadge) {
    customerBadge.textContent = `${translations.customerBadge} (고객)`;
  }
  
  // 2. Subtitle placeholders (only update if they are currently displaying default placeholders)
  if (customerSubtitleTarget) {
    if (customerSubtitleTarget.classList.contains('placeholder-text') || 
        customerSubtitleTarget.textContent.trim() === 'Your translation will appear here.' || 
        Object.values(customerTranslations).some(t => t.placeholderTarget === customerSubtitleTarget.textContent.trim())) {
      customerSubtitleTarget.textContent = translations.placeholderTarget;
      customerSubtitleTarget.classList.add('placeholder-text');
    }
  }
  
  if (customerSubtitleSource) {
    if (customerSubtitleSource.classList.contains('placeholder-text') || 
        customerSubtitleSource.textContent.trim() === '(이곳에 번역된 텍스트가 표시됩니다)' || 
        Object.values(customerTranslations).some(t => t.placeholderSource === customerSubtitleSource.textContent.trim())) {
      customerSubtitleSource.textContent = translations.placeholderSource;
    }
  }
  
  // 3. Customer mic button label and status text
  if (customerStatus && btnMicCustomer) {
    const labelEl = btnMicCustomer.querySelector('.mic-label');
    if (!isRecordingCustomer) {
      customerStatus.textContent = translations.statusReady;
      if (labelEl) {
        labelEl.textContent = isPTTMode ? translations.btnPTT : translations.btnToggleOff;
      }
    } else {
      customerStatus.textContent = translations.statusSpeaking;
      if (labelEl) {
        labelEl.textContent = translations.btnListening;
      }
    }
  }
}

// --- Staff Canned Quick Phrases Feature ---
let quickPhrases = []; // Array of objects: [{ id, text }]

async function initQuickPhrases() {
  try {
    const response = await fetch(`${getBackendHttpUrl()}/api/phrases`);
    if (!response.ok) throw new Error('서버 응답 오류');
    quickPhrases = await response.json();
  } catch (e) {
    console.error('[Quick Phrases] Error loading phrases from server:', e);
    // Fallback in case of server connection failure
    quickPhrases = [
      { id: '1', text: "안녕하세요. 무엇을 도와드릴까요?" },
      { id: '2', text: "이쪽에 서명해 주세요." },
      { id: '3', text: "여권을 보여주시겠어요?" },
      { id: '4', text: "결제가 완료되었습니다. 감사합니다." },
      { id: '5', text: "잠시만 기다려 주세요." }
    ];
  }
  renderPhrases();
}

function renderPhrases() {
  if (!quickPhrasesContainer) return;
  quickPhrasesContainer.innerHTML = '';
  
  quickPhrases.forEach((phraseObj) => {
    const chip = document.createElement('div');
    chip.className = 'phrase-chip';
    
    // Label span
    const labelSpan = document.createElement('span');
    labelSpan.textContent = phraseObj.text;
    chip.appendChild(labelSpan);
    
    // Click listener to send text
    labelSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      sendTextMessage(phraseObj.text);
    });
    
    // Delete cross
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'btn-delete-phrase';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = '삭제';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePhrase(phraseObj.id);
    });
    chip.appendChild(deleteBtn);
    
    quickPhrasesContainer.appendChild(chip);
  });
}

async function addPhrase(text) {
  if (!text || !text.trim()) return;
  
  try {
    const response = await fetch(`${getBackendHttpUrl()}/api/phrases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text.trim() })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '상용구 추가 실패');
    }
    
    const result = await response.json();
    quickPhrases.push(result.phrase);
    renderPhrases();
    showToast('공통 상용구가 추가되었습니다.');
  } catch (e) {
    console.error('[Quick Phrases] Failed to add phrase:', e);
    showToast('상용구 추가 실패: ' + e.message, 'error');
  }
}

async function deletePhrase(id) {
  try {
    const response = await fetch(`${getBackendHttpUrl()}/api/phrases/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: id })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '상용구 삭제 실패');
    }
    
    quickPhrases = quickPhrases.filter(p => p.id !== id);
    renderPhrases();
    showToast('공통 상용구가 삭제되었습니다.', 'info');
  } catch (e) {
    console.error('[Quick Phrases] Failed to delete phrase:', e);
    showToast('상용구 삭제 실패: ' + e.message, 'error');
  }
}

// Send Text Turn to Gemini WebSocket Session
// Web Speech API Text-to-Speech (Fallback for Canned Phrases)
function speakText(text, langCode) {
  if (!window.speechSynthesis) {
    console.warn('[TTS] Web SpeechSynthesis not supported in this browser.');
    return;
  }
  
  // Cancel any ongoing speech synthesis to prevent overlap
  window.speechSynthesis.cancel();
  
  // Wrap speak inside a small timeout to bypass Chrome's cancel-to-speak race condition bug
  setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      ttsUtterance = utterance; // Retain reference in outer scope to prevent garbage collection
      
      // Map targetLanguage to browser locales
      const langMap = {
        'en': 'en-US',
        'ja': 'ja-JP',
        'zh-CN': 'zh-CN',
        'zh-TW': 'zh-TW',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'vi': 'vi-VN',
        'ru': 'ru-RU',
        'th': 'th-TH'
      };
      
      utterance.lang = langMap[langCode] || 'en-US';
      utterance.volume = 1.0;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const targetLangLower = utterance.lang.toLowerCase();
      
      // Look for a voice matching the target locale (e.g. ja-JP or ja_JP or beginning with ja)
      const matchingVoice = voices.find(v => {
        const voiceLangLower = v.lang.toLowerCase();
        return voiceLangLower === targetLangLower || 
               voiceLangLower.replace('_', '-') === targetLangLower ||
               voiceLangLower.startsWith(targetLangLower.split('-')[0]);
      });
      
      if (matchingVoice) {
        utterance.voice = matchingVoice;
        console.log(`[TTS] Speaking text in voice: ${matchingVoice.name} (${matchingVoice.lang})`);
      } else {
        console.warn(`[TTS] No matching voice found for lang: ${utterance.lang}. Using browser default.`);
      }
      
      utterance.onend = () => {
        console.log('[TTS] Finished speaking canned phrase.');
        ttsUtterance = null; // Release reference
      };
      
      utterance.onerror = (e) => {
        console.error('[TTS] SpeechSynthesisUtterance error:', e.error, e);
        ttsUtterance = null; // Release reference
      };
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[TTS] Failed to execute speakText:', err);
    }
  }, 100);
}

// Send Text Turn for Canned Phrase (Translates via Server REST API and speaks via Web Speech API)
async function sendTextMessage(text) {
  console.log('[Quick Phrase] Translating canned phrase:', text);
  lastActiveSpeaker = 'staff';
  
  // iOS Safari Web Speech API (SpeechSynthesis) Unlock Hack
  if (window.speechSynthesis) {
    try {
      const unlockUtterance = new SpeechSynthesisUtterance('');
      unlockUtterance.volume = 0; // Silent
      window.speechSynthesis.speak(unlockUtterance);
    } catch (e) {
      console.warn('[TTS] Failed to unlock speechSynthesis on user click:', e);
    }
  }
  
  // Pre-update UI for immediate feedback
  staffSubtitleSource.textContent = text;
  staffSubtitleSource.classList.remove('placeholder-text');
  currentStaffTurnText = text;
  
  customerSubtitleTarget.textContent = 'Translating...';
  customerSubtitleTarget.classList.add('placeholder-text');
  currentCustomerTurnText = "";
  
  try {
    const response = await fetch(`${getBackendHttpUrl()}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        targetLanguage: targetLanguage
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    
    const data = await response.json();
    const translatedText = data.translatedText;
    
    // Update Customer Target UI with translation
    customerSubtitleTarget.textContent = translatedText;
    customerSubtitleTarget.classList.remove('placeholder-text');
    currentCustomerTurnText = translatedText;
    
    // Speak translation via browser TTS (since gemini-3.5-live-translate-preview is strictly voice-in)
    speakText(translatedText, targetLanguage);
    showToast('상용구 통역 및 음성 출력을 완료했습니다.');
  } catch (err) {
    console.error('[Quick Phrase] Translation failed:', err);
    customerSubtitleTarget.textContent = 'Translation failed.';
    showToast('상용구 번역에 실패했습니다.', 'error');
  }
}

// --- Helper: Toast Notification System ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  toastContainer.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Dynamic Backend URL Discovery ---
// [수정 2026-06-20] 프론트(Netlify)와 백엔드(Render)가 분리되어 있으므로
//   localhost가 아닌 경우에는 항상 Render 백엔드 URL을 사용
const RENDER_BACKEND_WS = 'wss://tm-stock-server.onrender.com/ws';
const RENDER_BACKEND_HTTP = 'https://tm-stock-server.onrender.com';

function getBackendWsUrl() {
  // localStorage에 수동 설정된 URL이 있으면 그것을 우선 사용 (개발/테스트용)
  const saved = localStorage.getItem('BACKEND_WS_URL');
  if (saved) return saved;

  // 로컬 개발 환경
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:3000/ws';
  }

  // 배포 환경 (Netlify 등): 항상 Render 백엔드 사용
  return RENDER_BACKEND_WS;
}

function getBackendHttpUrl() {
  const saved = localStorage.getItem('BACKEND_WS_URL');
  if (saved) {
    // ws:// → http://, wss:// → https://
    return saved.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace('/ws', '');
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return RENDER_BACKEND_HTTP;
}

// --- Initialize Audio Context & Stream ---
async function initAudio() {
  if (audioContext) return;

  try {
    // 1. Request microphone access
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // 2. Create Audio Context (Try 16000Hz first, fall back if browser restricts it)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      audioContext = new AudioContextClass({ sampleRate: 16000 });
    } catch (e) {
      console.warn('Failed to force 16kHz sample rate, creating default AudioContext:', e);
      audioContext = new AudioContextClass();
    }

    // Explicitly resume the AudioContext on user gesture to avoid Safari silent state
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    console.log(`[Audio] AudioContext created and active. Native Sample Rate: ${audioContext.sampleRate}Hz`);

    // 3. Define and load inline AudioWorkletProcessor via Blob URL (resolves file path issues)
    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const channelData = input[0]; // Mono channel
            this.port.postMessage(channelData);
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    
    await audioContext.audioWorklet.addModule(workletUrl);
    
    // 4. Create source node and worklet node
    mediaStreamSource = audioContext.createMediaStreamSource(micStream);
    audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
    
    // 5. Connect nodes
    mediaStreamSource.connect(audioWorkletNode);
    audioWorkletNode.connect(audioContext.destination); // Required for processor to run in some browsers

    // 6. Handle raw PCM data stream from AudioWorklet
    audioWorkletNode.port.onmessage = (event) => {
      handleAudioSamples(event.data);
    };

    showToast('마이크 및 오디오 장치가 성공적으로 활성화되었습니다.');
  } catch (error) {
    console.error('[Audio] Error initializing audio:', error);
    showToast('마이크 권한을 획득하지 못했습니다. 브라우저 설정을 확인해 주세요.', 'error');
    throw error;
  }
}

// --- Process Raw Audio Samples ---
function handleAudioSamples(channelData) {
  const isRecording = isRecordingStaff || isRecordingCustomer;
  if (!isRecording || !ws || ws.readyState !== WebSocket.OPEN) {
    rawAudioBuffer = []; // Clear buffer if not actively recording
    return;
  }

  // Accumulate native samples
  rawAudioBuffer.push(...channelData);

  // Buffer length equivalent to 250ms
  const actualSampleRate = audioContext.sampleRate;
  const targetChunkSizeNative = Math.floor(actualSampleRate * 0.25);

  if (rawAudioBuffer.length >= targetChunkSizeNative) {
    // 1. Downsample from native rate to 16000Hz (required by Gemini Live API)
    const downsampled = downsampleBuffer(rawAudioBuffer, actualSampleRate, 16000);
    rawAudioBuffer = []; // Reset accumulator

    // 2. Convert Float32 arrays to 16-bit PCM little-endian array buffer
    const pcm16Buffer = floatTo16BitPCM(downsampled);

    // 3. Send via WebSocket proxy
    sendAudioChunk(pcm16Buffer);
  }
}

// Downsample Buffer Utility
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return new Float32Array(buffer);
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

// Float32 to 16-bit PCM (Little-Endian)
function floatTo16BitPCM(input) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    // Scale float sample to 16-bit signed integer range
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, val, true); // true = Little-Endian
  }
  return buffer;
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Send Audio Data Chunk to WebSocket
function sendAudioChunk(pcmBuffer) {
  const base64Data = arrayBufferToBase64(pcmBuffer);
  const audioMessage = {
    realtimeInput: {
      mediaChunks: [
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data
        }
      ]
    }
  };
  ws.send(JSON.stringify(audioMessage));
}

// Safely close the active WebSocket without triggering UI event handlers
function closeActiveWebSocket() {
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      ws.close();
    } catch (e) {
      console.warn('[WebSocket] Error closing active socket:', e);
    }
    ws = null;
  }
}

// --- WebSocket Connection & Setup ---
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function wakeUpServer() {
  // Render free tier를 HTTP ping으로 먼저 깨움
  try {
    const httpBase = getBackendHttpUrl();
    updateConnectionStatus('connecting', '서버 기동 중... (최대 30초 소요)');
    await fetch(`${httpBase}/`, { method: 'GET', signal: AbortSignal.timeout(35000) });
    console.log('[Wake-up] Server responded to HTTP ping.');
  } catch (e) {
    console.warn('[Wake-up] Server ping failed:', e.message);
  }
}

let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending keep-alive heartbeat ping');
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 20000); // 20 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function connectWebSocket() {
  const url = getBackendWsUrl();
  console.log(`[WebSocket] Connecting to: ${url}`);
  
  updateConnectionStatus('connecting', '서버 연결 중...');

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[WebSocket] Connection open.');
    reconnectAttempts = 0; // 성공 시 재시도 카운터 초기화
    updateConnectionStatus('connected', '실시간 통역 준비 완료');
    showToast('통역 서버에 연결되었습니다.');
    
    // Initialize Gemini Live Session configuration
    sendSetupMessage();
    
    // Update Customer UI Language initially
    updateCustomerUILanguage();
    
    // Start heartbeat keep-alive
    startHeartbeat();
  };

  ws.onmessage = async (event) => {
    try {
      let rawData;
      if (event.data instanceof Blob) {
        rawData = await event.data.text();
      } else {
        rawData = event.data;
      }
      const response = JSON.parse(rawData);
      
      // Heartbeat pong check
      if (response && response.type === 'pong') {
        console.log('[WebSocket] Received keep-alive heartbeat pong');
        return;
      }
      
      // Client diagnostics
      if (response.serverContent) {
        if (response.serverContent.inputTranscription && response.serverContent.inputTranscription.text !== undefined) {
          console.log('[WebSocket] Client received input transcript:', response.serverContent.inputTranscription.text);
        }
        if (response.serverContent.outputTranscription && response.serverContent.outputTranscription.text !== undefined) {
          console.log('[WebSocket] Client received output transcript:', response.serverContent.outputTranscription.text);
        }
        if (response.serverContent.modelTurn) {
          console.log('[WebSocket] Client received model audio data chunk');
        }
      }
      
      handleServerMessage(response);
    } catch (e) {
      console.error('[WebSocket] Error parsing server message:', e);
    }
  };

  ws.onclose = (event) => {
    console.log(`[WebSocket] Connection closed. Code: ${event.code}`);
    stopHeartbeat(); // Stop heartbeat keep-alive
    
    // 자동 재연결 (최대 5회, 간격 증가)
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(reconnectAttempts * 5000, 20000); // 5, 10, 15, 20, 20초
      updateConnectionStatus('connecting', `재연결 시도 중... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, ${delay/1000}초 후)`);
      console.log(`[WebSocket] Auto-reconnect in ${delay}ms (attempt ${reconnectAttempts})`);
      
      setTimeout(async () => {
        if (reconnectAttempts === 1) await wakeUpServer(); // 첫 재시도 전에 서버 wake-up
        closeActiveWebSocket();
        connectWebSocket();
      }, delay);
    } else {
      updateConnectionStatus('disconnected', '서버 연결 끊김 (클릭하여 재연결)');
      showToast('통역 서버와의 연결이 끊겼습니다.', 'error');
      reconnectAttempts = 0;
    }
  };

  ws.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
    // onerror는 항상 onclose 직전에 발생하므로 상태 업데이트만
    updateConnectionStatus('connecting', '연결 오류 - 재시도 중...');
  };
}

// Send session initialization parameters
function sendSetupMessage() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const setupMessage = {
    setup: {
      model: 'models/gemini-3.5-live-translate-preview',
      generationConfig: {
        responseModalities: ['AUDIO', 'TEXT'],
        translationConfig: {
          targetLanguageCode: targetLanguage,
          echoTargetLanguage: true
        }
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    }
  };

  console.log('[WebSocket] Sending setup configuration:', setupMessage);
  ws.send(JSON.stringify(setupMessage));
}

// Update connection status bar
function updateConnectionStatus(status, text) {
  connectionText.textContent = text;
  connectionDot.className = 'dot';
  
  if (status === 'connected') {
    connectionDot.classList.add('dot-connected');
  } else if (status === 'connecting') {
    connectionDot.classList.add('dot-disconnected');
    connectionDot.style.animation = 'pulse-danger 0.8s infinite alternate';
  } else {
    connectionDot.classList.add('dot-disconnected');
    connectionDot.style.animation = 'none';
  }
}

// --- Handle Incoming Server Payload ---
function handleServerMessage(response) {
  // 1. Play translated audio
  if (response.serverContent?.modelTurn?.parts) {
    for (const part of response.serverContent.modelTurn.parts) {
      if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
        playPCMAudio(part.inlineData.data);
      }
    }
  }

  // 2. Capture Transcripts (Input & Output)
  // InputTranscription: Transcribed text of what speaker spoke
  if (response.serverContent?.inputTranscription) {
    const text = response.serverContent.inputTranscription.text;
    if (text && text.trim()) {
      if (lastActiveSpeaker === 'staff') {
        // Staff spoke (Korean)
        if (staffSubtitleSource.classList.contains('placeholder-text') || staffSubtitleSource.textContent === '말씀해 주세요...') {
          currentStaffTurnText = text;
          staffSubtitleSource.classList.remove('placeholder-text');
        } else {
          currentStaffTurnText += text;
        }
        console.log('[UI] Updating Staff Source textContent to:', currentStaffTurnText);
        staffSubtitleSource.textContent = currentStaffTurnText;
      } else if (lastActiveSpeaker === 'customer') {
        // Customer spoke (Foreign)
        if (customerSubtitleSource.classList.contains('placeholder-text') || customerSubtitleSource.textContent === '(이곳에 번역된 텍스트가 표시됩니다)') {
          currentCustomerTurnText = text;
          customerSubtitleSource.classList.remove('placeholder-text');
        } else {
          currentCustomerTurnText += text;
        }
        console.log('[UI] Updating Customer Source textContent to:', currentCustomerTurnText);
        customerSubtitleSource.textContent = currentCustomerTurnText;
      }
    }
  }

  // OutputTranscription: Transcribed text of translation result
  if (response.serverContent?.outputTranscription) {
    const text = response.serverContent.outputTranscription.text;
    if (text && text.trim()) {
      if (lastActiveSpeaker === 'staff') {
        // Staff translation goes to Customer (Foreign)
        if (customerSubtitleTarget.classList.contains('placeholder-text') || customerSubtitleTarget.textContent === 'Your translation will appear here.') {
          currentCustomerTurnText = text;
          customerSubtitleTarget.classList.remove('placeholder-text');
        } else {
          currentCustomerTurnText += text;
        }
        console.log('[UI] Updating Customer Target textContent to:', currentCustomerTurnText);
        customerSubtitleTarget.textContent = currentCustomerTurnText;
      } else if (lastActiveSpeaker === 'customer') {
        // Customer translation goes to Staff (Korean)
        if (staffSubtitleTarget.classList.contains('placeholder-text') || staffSubtitleTarget.textContent === '(번역기 대기 중)') {
          currentStaffTurnText = text;
          staffSubtitleTarget.classList.remove('placeholder-text');
        } else {
          currentStaffTurnText += text;
        }
        console.log('[UI] Updating Staff Target textContent to:', currentStaffTurnText);
        staffSubtitleTarget.textContent = currentStaffTurnText;
      }
    }
  }
}

// --- Audio Context Keep-Alive & Active Resume for iOS Safari ---
let keepAliveInterval = null;

function resumeAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
      .then(() => console.log('[Audio] AudioContext resumed successfully.'))
      .catch(err => console.warn('[Audio] Failed to resume AudioContext:', err));
  }
}

function startAudioKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  keepAliveInterval = setInterval(() => {
    if (audioContext && audioContext.state === 'running') {
      try {
        // Play a silent buffer periodically to prevent iOS Safari from putting the audio hardware to sleep
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.0; // Complete silence
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
      } catch (e) {
        console.warn('[Audio] Keep-alive silent audio failed:', e);
      }
    }
  }, 10000); // Every 10 seconds
}

// --- Audio Queue Playback (24kHz Raw PCM) ---
function playPCMAudio(base64Data) {
  if (!audioContext) return;

  resumeAudioContext(); // Active resume on chunk arrival

  const arrayBuffer = base64ToArrayBuffer(base64Data);
  const float32 = pcm16ToFloat32(arrayBuffer);

  // Gemini Live outputs audio at 24kHz
  const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const currentTime = audioContext.currentTime;
  if (nextPlaybackTime < currentTime) {
    nextPlaybackTime = currentTime + 0.05; // 50ms scheduling offset to block pops
  }
  source.start(nextPlaybackTime);
  nextPlaybackTime += audioBuffer.duration;
}

// Convert Base64 back to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert 16-bit PCM buffer to Float32 array
function pcm16ToFloat32(arrayBuffer) {
  const int16Array = new Int16Array(arrayBuffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

// --- Recording Control Handlers ---

function commitPreviousTurn() {
  if (currentStaffTurnText.trim()) {
    conversationHistory.staff.push(currentStaffTurnText.trim());
    currentStaffTurnText = "";
  }
  if (currentCustomerTurnText.trim()) {
    conversationHistory.customer.push(currentCustomerTurnText.trim());
    currentCustomerTurnText = "";
  }
}

// Send clientContent turnComplete to Gemini WebSocket Proxy
function sendTurnComplete() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const turnCompleteMessage = {
    clientContent: {
      turns: [],
      turnComplete: true
    }
  };
  console.log('[WebSocket] Sending clientContent turnComplete');
  ws.send(JSON.stringify(turnCompleteMessage));
}

function startRecording(role) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showToast('서버 연결이 끊어져 있어 재연결을 시도합니다. 잠시 후 다시 마이크를 켜주세요.', 'info');
    connectWebSocket();
    return;
  }

  resumeAudioContext(); // Ensure AudioContext is active on user tap gesture

  // If a stop timeout is pending for this role, clear it so we keep recording continuously
  if (role === 'staff') {
    if (staffStopTimeout) {
      clearTimeout(staffStopTimeout);
      staffStopTimeout = null;
      console.log('[Audio] Staff startRecording called while stop timeout was pending. Timeout cleared.');
      btnMicStaff.classList.add('recording');
      btnMicStaff.querySelector('.mic-label').textContent = '말하는 중 (녹음 중)';
      return; // Keep existing session active
    }
  } else {
    if (customerStopTimeout) {
      clearTimeout(customerStopTimeout);
      customerStopTimeout = null;
      console.log('[Audio] Customer startRecording called while stop timeout was pending. Timeout cleared.');
      btnMicCustomer.classList.add('recording');
      customerStatus.classList.add('speaking');
      return; // Keep existing session active
    }
  }

  // Commit previous turn's text
  commitPreviousTurn();

  // Enforce mutual exclusion (stop other role immediately without delay)
  stopRecordingImmediate(role === 'staff' ? 'customer' : 'staff');

  // Track the active speaker
  lastActiveSpeaker = role;
  rawAudioBuffer = [];

  if (role === 'staff') {
    isRecordingStaff = true;
    btnMicStaff.classList.add('recording');
    btnMicStaff.querySelector('.mic-label').textContent = '말하는 중 (녹음 중)';
    
    // Clear and set placeholders
    staffSubtitleSource.textContent = '말씀해 주세요...';
    staffSubtitleSource.classList.add('placeholder-text');
    
    // Localize customer subtitle placeholder
    const translations = customerTranslations[targetLanguage] || customerTranslations['en'];
    customerSubtitleTarget.textContent = translations.placeholderTarget;
    customerSubtitleTarget.classList.add('placeholder-text');
  } else {
    isRecordingCustomer = true;
    btnMicCustomer.classList.add('recording');
    
    // Clear and set placeholders (Staff translation placeholder stays Korean)
    staffSubtitleTarget.textContent = '(번역기 대기 중)';
    staffSubtitleTarget.classList.add('placeholder-text');
    
    // Localize customer views dynamically
    updateCustomerUILanguage();
    customerSubtitleSource.classList.add('placeholder-text');
    
    customerStatus.classList.add('speaking');
  }
}

function stopRecordingImmediate(role) {
  resumeAudioContext(); // Active resume on user gesture

  if (role === 'staff') {
    if (staffStopTimeout) {
      clearTimeout(staffStopTimeout);
      staffStopTimeout = null;
    }
    if (!isRecordingStaff) return;
    isRecordingStaff = false;
    btnMicStaff.classList.remove('recording');
    btnMicStaff.querySelector('.mic-label').textContent = isPTTMode ? '누르고 말하기' : '마이크 켜기';
  } else {
    if (customerStopTimeout) {
      clearTimeout(customerStopTimeout);
      customerStopTimeout = null;
    }
    if (!isRecordingCustomer) return;
    isRecordingCustomer = false;
    btnMicCustomer.classList.remove('recording');
    customerStatus.classList.remove('speaking');
    updateCustomerUILanguage();
  }
}

function stopRecording(role) {
  const DELAY_MS = 500; // 500ms delay to prevent cutting off speech trailing end
  
  resumeAudioContext(); // Ensure AudioContext is active on user release gesture

  if (role === 'staff') {
    if (!isRecordingStaff) return;
    
    // Instantly update UI for immediate feedback
    btnMicStaff.classList.remove('recording');
    btnMicStaff.querySelector('.mic-label').textContent = isPTTMode ? '누르고 말하기' : '마이크 켜기';
    
    if (staffStopTimeout) clearTimeout(staffStopTimeout);
    
    staffStopTimeout = setTimeout(() => {
      isRecordingStaff = false;
      staffStopTimeout = null;
      console.log('[Audio] Staff recording stopped after delay.');
      sendTurnComplete();
    }, DELAY_MS);
  } else {
    if (!isRecordingCustomer) return;
    
    // Instantly update UI for immediate feedback
    btnMicCustomer.classList.remove('recording');
    customerStatus.classList.remove('speaking');
    updateCustomerUILanguage();
    
    if (customerStopTimeout) clearTimeout(customerStopTimeout);
    
    customerStopTimeout = setTimeout(() => {
      isRecordingCustomer = false;
      customerStopTimeout = null;
      console.log('[Audio] Customer recording stopped after delay.');
      sendTurnComplete();
    }, DELAY_MS);
  }
}

// --- Google Sheets Logging Database ---
async function saveConsultationLog() {
  commitPreviousTurn(); // Ensure the final turn text is committed to logs
  const staffLogsJoined = conversationHistory.staff.filter(Boolean).join('\n');
  const customerLogsJoined = conversationHistory.customer.filter(Boolean).join('\n');

  if (!staffLogsJoined && !customerLogsJoined) {
    showToast('저장할 상담 내역이 없습니다.', 'error');
    return;
  }

  btnSaveLog.disabled = true;
  btnSaveLog.textContent = '저장 중...';

  const logEndpoint = `${getBackendHttpUrl()}/api/log`;

  try {
    const response = await fetch(logEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffScript: staffLogsJoined,
        customerScript: customerLogsJoined,
        targetLanguage: selectLanguage.value
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('상담 내역이 구글 시트에 정상 기록되었습니다.');
      // Clear logs for next session
      conversationHistory.staff = [];
      conversationHistory.customer = [];
      
      // Reset subtitles placeholders
      staffSubtitleSource.textContent = '마이크를 켜고 한국어로 말씀해 주세요.';
      staffSubtitleSource.classList.add('placeholder-text');
      staffSubtitleTarget.textContent = '(번역기 대기 중)';
      customerSubtitleTarget.textContent = 'Your translation will appear here.';
      customerSubtitleTarget.classList.add('placeholder-text');
      customerSubtitleSource.textContent = '(이곳에 번역된 텍스트가 표시됩니다)';
    } else if (result.warning) {
      showToast(result.warning, 'error');
      console.warn('Backend warning:', result.warning);
    } else {
      showToast('기록 저장 실패: ' + result.error, 'error');
    }
  } catch (err) {
    console.error('[HTTP] Error logging consultation:', err);
    showToast('서버와의 통신에 실패했습니다. 백엔드 주소를 확인하세요.', 'error');
  } finally {
    btnSaveLog.disabled = false;
    btnSaveLog.textContent = '상담 저장';
  }
}

// --- Event Listeners and Interactions ---

// Start Overlay Click
btnStartApp.addEventListener('click', async () => {
  try {
    await initAudio();
    
    // Unlock Safari/Chrome AudioContext output autoplay policy by playing a 1-sample silent buffer
    if (audioContext) {
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    }
    
    // Unlock Web Speech API speechSynthesis on iOS/Safari and Chrome
    if (window.speechSynthesis) {
      try {
        const utterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Failed to unlock SpeechSynthesis on gesture:', e);
      }
    }
    
    welcomeOverlay.classList.add('hidden');
    startAudioKeepAlive(); // Start periodic silent playback to prevent audio suspend
    
    // Render 서버 wake-up 후 WebSocket 연결
    await wakeUpServer();
    connectWebSocket();
  } catch (err) {
    console.error('Failed initialization on user gesture:', err);
  }
});



// Dropdown Language Selection Change
selectLanguage.addEventListener('change', (e) => {
  targetLanguage = e.target.value;
  showToast(`선택된 언어가 변경되었습니다: ${targetLanguage.toUpperCase()}`);
  
  // Re-establish session configurations by resetting websocket
  closeActiveWebSocket();
  connectWebSocket();
  
  // Update Customer UI Language to match selection
  updateCustomerUILanguage();
});

// Mic Control Mode Toggle (PTT vs Click Toggle)
toggleMicMode.addEventListener('change', (e) => {
  isPTTMode = e.target.checked;
  
  // Reset recordings immediately when mode is toggled
  stopRecordingImmediate('staff');
  stopRecordingImmediate('customer');

  if (isPTTMode) {
    btnMicStaff.querySelector('.mic-label').textContent = '누르고 말하기';
  } else {
    btnMicStaff.querySelector('.mic-label').textContent = '마이크 켜기';
  }
  
  // Update customer UI localization
  updateCustomerUILanguage();
  
  showToast(`입력 방식 변경: ${isPTTMode ? 'PTT (누르고 말하기)' : '마이크 On/Off 토글'}`);
});

// Save Log Action
btnSaveLog.addEventListener('click', () => {
  saveConsultationLog();
});

// Reconnect on connection dot click if disconnected
connectionDot.parentElement.addEventListener('click', () => {
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    closeActiveWebSocket();
    connectWebSocket();
  }
});

// --- Microphone Interactions (PTT and Toggle Setup) ---

// Staff Microphone Listeners
btnMicStaff.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (isPTTMode) startRecording('staff');
});

btnMicStaff.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (isPTTMode) stopRecording('staff');
});

btnMicStaff.addEventListener('pointerleave', (e) => {
  if (isPTTMode) stopRecording('staff');
});

btnMicStaff.addEventListener('click', (e) => {
  if (!isPTTMode) {
    if (isRecordingStaff) stopRecording('staff');
    else startRecording('staff');
  }
});

// Customer Microphone Listeners
btnMicCustomer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (isPTTMode) startRecording('customer');
});

btnMicCustomer.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (isPTTMode) stopRecording('customer');
});

btnMicCustomer.addEventListener('pointerleave', (e) => {
  if (isPTTMode) stopRecording('customer');
});

btnMicCustomer.addEventListener('click', (e) => {
  if (!isPTTMode) {
    if (isRecordingCustomer) stopRecording('customer');
    else startRecording('customer');
  }
});

// Prevent visual scroll dragging zoom on iOS Safari during hold interactions
document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

// Add Phrase Button Click
if (btnAddPhrase) {
  btnAddPhrase.addEventListener('click', () => {
    const text = prompt('자주 사용하는 문구를 입력해 주세요:');
    if (text !== null && text.trim() !== '') {
      addPhrase(text);
    }
  });
}

// Initialize Quick Phrases on page load
initQuickPhrases();

// --- Auto font sizing and line wrapping engine ---
function setupSubtitleAutoFontSize() {
  const subtitleElements = [
    { el: staffSubtitleSource, baseSize: 2.2 },
    { el: staffSubtitleTarget, baseSize: 1.1 },
    { el: customerSubtitleTarget, baseSize: 2.2 },
    { el: customerSubtitleSource, baseSize: 1.1 }
  ];

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Find which mapping config this mutation target belongs to
      const targetNode = mutation.target;
      const config = subtitleElements.find(item => 
        item.el === targetNode || 
        item.el.contains(targetNode)
      );
      if (config) {
        adjustFontSizeForElement(config.el, config.baseSize);
      }
    });
  });

  subtitleElements.forEach(item => {
    if (item.el) {
      // Observe child modifications as well as character changes
      observer.observe(item.el, { childList: true, characterData: true, subtree: true });
      // Initial sizing check
      adjustFontSizeForElement(item.el, item.baseSize);
    }
  });

  // Re-adjust sizes on window resize (e.g. rotating device between portrait & landscape)
  window.addEventListener('resize', () => {
    subtitleElements.forEach(item => {
      if (item.el) {
        adjustFontSizeForElement(item.el, item.baseSize);
      }
    });
  });
}

function adjustFontSizeForElement(el, baseSize) {
  const text = el.textContent || '';
  const len = text.length;

  // Restore CSS default when element is showing placeholder or empty
  if (el.classList.contains('placeholder-text') || len === 0) {
    el.style.fontSize = ''; 
    return;
  }

  // 브라우저 너비에 따라 기본 폰트 사이즈를 동적으로 축소 (모바일/태블릿 적응형 대응)
  let adjustedBaseSize = baseSize;
  const width = window.innerWidth;
  if (width <= 480) {
    adjustedBaseSize = baseSize >= 2.0 ? 1.35 : 0.85; // 모바일: 메인 1.35rem, 서브 0.85rem 베이스
  } else if (width <= 768) {
    adjustedBaseSize = baseSize >= 2.0 ? 1.6 : 0.95;  // 태블릿: 메인 1.6rem, 서브 0.95rem 베이스
  }

  let scale = 1.0;
  if (baseSize >= 2.0) {
    // For main large subtitles (.subtitle-text)
    if (len > 120) scale = 0.55;      // Down to ~1.2rem
    else if (len > 80) scale = 0.65;  // Down to ~1.4rem
    else if (len > 50) scale = 0.77;  // Down to ~1.7rem
    else if (len > 25) scale = 0.88;  // Down to ~1.95rem
  } else {
    // For secondary small subtitles (.subtitle-subtext)
    if (len > 120) scale = 0.7;       // Down to ~0.77rem
    else if (len > 80) scale = 0.8;   // Down to ~0.88rem
    else if (len > 50) scale = 0.9;   // Down to ~0.99rem
  }

  el.style.fontSize = `${adjustedBaseSize * scale}rem`;
}

// Start auto font size engine
setupSubtitleAutoFontSize();
