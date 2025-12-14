import {
  GoogleGenAI,
  LiveSession,
  LiveServerMessage,
  Modality,
  Type,
  FunctionDeclaration,
  Tool,
} from '@google/genai';
import { float32ToInt16, arrayBufferToBase64, base64ToArrayBuffer, createAudioBufferFromPCM, downsampleTo16000 } from '../utils/audioUtils';
import { ToolCallbacks } from '../types';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Define Tools
const saveAadharTool: FunctionDeclaration = {
  name: 'saveAadhar',
  description: 'Save user Aadhar card details. Call this when the user provides their Name, Aadhar Number, and Date of Birth.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fullName: { type: Type.STRING, description: 'Full Name on Aadhar' },
      number: { type: Type.STRING, description: '12-digit Aadhar Number' },
      dob: { type: Type.STRING, description: 'Date of Birth (DD-MM-YYYY)' },
    },
    required: ['fullName', 'number', 'dob'],
  },
};

const savePanTool: FunctionDeclaration = {
  name: 'savePan',
  description: 'Save user PAN card details. Call this when the user provides their Name, PAN Number, and Date of Birth.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fullName: { type: Type.STRING, description: 'Full Name on PAN' },
      number: { type: Type.STRING, description: '10-character PAN Number' },
      dob: { type: Type.STRING, description: 'Date of Birth' },
    },
    required: ['fullName', 'number', 'dob'],
  },
};

const verifyDetailsTool: FunctionDeclaration = {
  name: 'verifyDetails',
  description: 'Verify if Aadhar and PAN details match. Returns MATCH or MISMATCH.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: 'Action description, e.g., "compare"' },
    },
    required: ['action'],
  },
};

const createDigilockerTool: FunctionDeclaration = {
  name: 'createDigilocker',
  description: 'Create the DigiLocker account using a 6-digit PIN provided by the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pin: { type: Type.STRING, description: '6-digit Security PIN' },
    },
    required: ['pin'],
  },
};

const tools: Tool[] = [
  {
    functionDeclarations: [saveAadharTool, savePanTool, verifyDetailsTool, createDigilockerTool],
  },
];

const SYSTEM_INSTRUCTION = `You are "DigiVerifier", an official government Identity Verification Assistant.
Your goal is to guide the user through linking their Aadhar Card and PAN Card to create a DigiLocker account.
Maintain a professional, official, yet helpful tone. Be concise.

IMPORTANT: You must greet the user immediately upon connection. Speak first. Say "Hello, I am DigiVerifier. I will help you link your documents. Let's start with your Aadhar card. Please tell me your full name."

STRICT PROCESS FLOW:
1. AADHAR COLLECTION (Ask fields one by one):
   - Ask for Full Name. Wait for user input.
   - Ask for Date of Birth. Wait for user input.
   - Ask for the 12-digit Aadhar Number. Wait for user input.
   - ONLY when you have all three, call the 'saveAadhar' tool.

2. PAN COLLECTION (Ask fields one by one):
   - Acknowledge Aadhar completion. Now ask for PAN details.
   - Ask for Full Name as on PAN. Wait for user input.
   - Ask for Date of Birth. Wait for user input.
   - Ask for the 10-character PAN Number. Wait for user input.
   - ONLY when you have all three, call the 'savePan' tool.

3. VERIFICATION:
   - Call 'verifyDetails' with action='compare'.
   - If MATCH: Proceed to DigiLocker.
   - If MISMATCH: Ask user to restart.

4. DIGILOCKER:
   - Ask for a 6-digit Security PIN.
   - Call 'createDigilocker'.

5. COMPLETE:
   - Confirm success and goodbye.

RULES:
- Ask for ONLY ONE piece of information at a time.
- Do not assume or hallucinate values.
- Wait for user response before moving to the next field.`;

export class GeminiLiveService {
  private client: GoogleGenAI;
  private session: LiveSession | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime: number = 0;
  private callbacks: ToolCallbacks;
  
  // Analyser nodes for visualization
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;

  // Stream Reference for Muting
  private mediaStream: MediaStream | null = null;

  constructor(callbacks: ToolCallbacks) {
    const key = process.env.API_KEY;
    if (!key) {
      throw new Error("API_KEY is missing.");
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.callbacks = callbacks;
  }

  async connect() {
    // 1. Setup Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContextClass();
    this.outputAudioContext = new AudioContextClass();

    // CRITICAL: Resume contexts immediately.
    if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
    }
    if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
    }

    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.outputAnalyser.fftSize = 256;
    
    // Reset cursor
    this.nextStartTime = this.outputAudioContext.currentTime;

    // 2. Start Session
    try {
      this.session = await this.client.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: tools,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Session Opened");
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onclose: () => {
            console.log("Session Closed");
          },
          onerror: (err) => {
            console.error("Session Error", err);
          }
        }
      });
    } catch (e) {
      console.error("Failed to connect to Gemini Live:", e);
      throw e;
    }

    // 3. Setup Outgoing Stream (Microphone)
    await this.setupMicrophone();
    
    console.log("Connected and listening.");
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Audio
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
        this.queueAudio(audioData);
    }

    // Handle Tool Calls
    const toolCall = message.toolCall;
    if (toolCall) {
        for (const call of toolCall.functionCalls) {
            console.log(`Tool Call: ${call.name}`, call.args);
            let responseResult: any = { result: "ok" };

            try {
                if (call.name === 'saveAadhar') {
                      this.callbacks.onSaveAadhar(call.args as any);
                      responseResult = { status: "Aadhar Saved. Proceed to PAN." };
                } else if (call.name === 'savePan') {
                      this.callbacks.onSavePan(call.args as any);
                      responseResult = { status: "PAN Saved. Proceed to Verify." };
                } else if (call.name === 'verifyDetails') {
                      const result = await this.callbacks.onVerifyDetails(call.args as any);
                      responseResult = { status: result };
                } else if (call.name === 'createDigilocker') {
                      this.callbacks.onCreateDigilocker(call.args as any);
                      responseResult = { status: "Account Created." };
                }
            } catch (e) {
                console.error("Tool execution failed", e);
                responseResult = { error: "Failed to execute tool" };
            }

            // Send Response back to model
            this.session?.sendToolResponse({
                functionResponses: [
                    {
                        id: call.id,
                        name: call.name,
                        response: responseResult
                    }
                ]
            });
        }
    }
  }

  private async setupMicrophone() {
    if (!this.inputAudioContext) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }});

      this.inputSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

      this.inputSource.connect(this.inputAnalyser!); 
      this.inputSource.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);

      this.processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Downsample whatever the system rate is to 16000
          const downsampledData = downsampleTo16000(inputData, this.inputAudioContext!.sampleRate);
          
          // Convert to PCM Int16
          const pcmData = float32ToInt16(downsampledData);
          // Base64 Encode
          const base64Data = arrayBufferToBase64(pcmData.buffer);
          
          // Send to Gemini
          // IMPORTANT: Use the correct structure { media: { mimeType, data } }
          this.session?.sendRealtimeInput({
            media: {
              mimeType: "audio/pcm;rate=16000",
              data: base64Data
            }
          });
      };
    } catch (e) {
      console.error("Microphone setup failed:", e);
      throw e;
    }
  }

  private async queueAudio(base64Data: string) {
    if (!this.outputAudioContext || !this.outputAnalyser) return;

    if (this.outputAudioContext.state === 'suspended') {
        try {
            await this.outputAudioContext.resume();
        } catch (e) {
            console.warn("Could not resume audio context:", e);
        }
    }

    try {
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      const int16Data = new Int16Array(arrayBuffer);
      
      // Create buffer at 24kHz (Gemini output)
      const audioBuffer = createAudioBufferFromPCM(int16Data, this.outputAudioContext, 24000);

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } catch (e) {
      console.error("Error decoding/playing audio:", e);
    }
  }

  public setMicMuted(muted: boolean) {
    if (this.mediaStream) {
        this.mediaStream.getAudioTracks().forEach(track => {
            track.enabled = !muted;
        });
    }
  }

  public async setOutputPaused(paused: boolean) {
    if (!this.outputAudioContext) return;
    if (paused) {
        await this.outputAudioContext.suspend();
    } else {
        await this.outputAudioContext.resume();
    }
  }

  public disconnect() {
    this.session?.close();
    this.inputSource?.disconnect();
    this.processor?.disconnect();
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    
    if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
    }
  }
}
