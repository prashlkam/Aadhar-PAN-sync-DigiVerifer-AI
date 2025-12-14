import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AppPhase, 
  AppState, 
  IdentityDoc, 
  VerificationStatus, 
  DigiLockerState,
  SaveAadharArgs,
  SavePanArgs,
  VerifyDetailsArgs,
  CreateDigilockerArgs
} from './types';
import { GeminiLiveService } from './services/geminiLiveService';
import InfoCard from './components/InfoCard';
import Visualizer from './components/Visualizer';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Activity, 
  AlertCircle, 
  Lock,
  Cpu,
  Key
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>({
    phase: AppPhase.IDLE,
    aadhar: null,
    pan: null,
    verification: VerificationStatus.PENDING,
    digilocker: { isCreated: false, pin: null },
    isConnected: false,
    isAudioPlaying: true
  });

  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresKeySelection, setRequiresKeySelection] = useState(false);

  // Service Ref
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  
  // Analyser Refs (Need to trigger re-renders or passed directly)
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // --- API Key Check ---
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setRequiresKeySelection(!hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setRequiresKeySelection(false);
      setError(null);
    }
  };

  // --- Handlers for Tools ---
  const handleSaveAadhar = useCallback((args: SaveAadharArgs) => {
    setAppState(prev => ({
      ...prev,
      phase: AppPhase.PAN,
      aadhar: { fullName: args.fullName, number: args.number, dob: args.dob }
    }));
  }, []);

  const handleSavePan = useCallback((args: SavePanArgs) => {
    setAppState(prev => ({
      ...prev,
      phase: AppPhase.VERIFY,
      pan: { fullName: args.fullName, number: args.number, dob: args.dob }
    }));
  }, []);

  const handleVerifyDetails = useCallback(async (args: VerifyDetailsArgs): Promise<string> => {
    // Simulate verification delay
    await new Promise(r => setTimeout(r, 1000));
    const status = VerificationStatus.MATCH;
    
    setAppState(prev => ({
      ...prev,
      phase: AppPhase.DIGILOCKER,
      verification: status
    }));
    
    return status;
  }, []);

  const handleCreateDigilocker = useCallback((args: CreateDigilockerArgs) => {
    setAppState(prev => ({
      ...prev,
      phase: AppPhase.COMPLETE,
      digilocker: { isCreated: true, pin: args.pin }
    }));
  }, []);

  // --- Start Connection ---
  const startVerification = async () => {
    // Re-check key requirement if we somehow got here
    if (requiresKeySelection) {
      setError("Please select an API Key first.");
      return;
    }
    
    // Fallback env check
    if (!process.env.API_KEY) {
        setError("Missing API_KEY in environment variables.");
        return;
    }

    try {
      setError(null);
      // Instantiate service just before connection to ensure latest env vars
      const service = new GeminiLiveService({
        onSaveAadhar: handleSaveAadhar,
        onSavePan: handleSavePan,
        onVerifyDetails: handleVerifyDetails,
        onCreateDigilocker: handleCreateDigilocker
      });

      // Connection is called here within a user gesture handler (onClick), 
      // which allows AudioContext to start permitted.
      await service.connect();
      geminiServiceRef.current = service;
      
      // Update state for visualizers
      setInputAnalyser(service.inputAnalyser);
      setOutputAnalyser(service.outputAnalyser);
      
      setAppState(prev => ({ ...prev, isConnected: true, phase: AppPhase.AADHAR }));
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || "Failed to connect.";
      if (msg.includes("Permission") || msg.includes("403")) {
        msg = "Permission Denied. Please ensure your API Key has access to Gemini Live.";
        // If permission denied, maybe prompt key selection again
        if ((window as any).aistudio) setRequiresKeySelection(true);
      }
      setError(msg);
    }
  };

  // --- Controls ---
  const toggleMic = () => {
    if (geminiServiceRef.current) {
      const newMuteState = !micMuted;
      geminiServiceRef.current.setMicMuted(newMuteState);
      setMicMuted(newMuteState);
    }
  };

  const togglePlayback = async () => {
    if (geminiServiceRef.current) {
      const newPlayState = !appState.isAudioPlaying;
      await geminiServiceRef.current.setOutputPaused(!newPlayState);
      setAppState(prev => ({ ...prev, isAudioPlaying: newPlayState }));
    }
  };

  const endSession = () => {
    if (geminiServiceRef.current) {
      geminiServiceRef.current.disconnect();
    }
    setAppState(prev => ({ ...prev, isConnected: false, phase: AppPhase.IDLE }));
    setInputAnalyser(null);
    setOutputAnalyser(null);
    geminiServiceRef.current = null;
  };

  // --- Render Helpers ---
  const getStepColor = (stepPhase: AppPhase) => {
    const phases = [AppPhase.IDLE, AppPhase.AADHAR, AppPhase.PAN, AppPhase.VERIFY, AppPhase.DIGILOCKER, AppPhase.COMPLETE];
    const currentIndex = phases.indexOf(appState.phase);
    const stepIndex = phases.indexOf(stepPhase);

    if (stepIndex < currentIndex) return 'bg-green-500 text-white border-green-500';
    if (stepIndex === currentIndex) return 'bg-gov-blue text-white border-gov-blue shadow-[0_0_15px_rgba(59,130,246,0.6)]';
    return 'bg-slate-800 text-slate-500 border-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-gov-accent selection:text-white pb-20">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gov-blue p-1.5 rounded-lg">
              <Cpu size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Digi<span className="text-gov-blue">Verifier</span> <span className="text-slate-500 text-sm font-normal ml-2">Official AI Assistant</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
             {/* Connection Status */}
             <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${appState.isConnected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${appState.isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                {appState.isConnected ? 'LIVE SECURE LINK' : 'DISCONNECTED'}
             </div>

             {!appState.isConnected ? (
                requiresKeySelection ? (
                  <button 
                    onClick={handleSelectKey}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-yellow-500/20 flex items-center gap-2"
                  >
                    <Key size={16} />
                    Select API Key
                  </button>
                ) : (
                   <button 
                    onClick={startVerification}
                    className="bg-gov-blue hover:bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                   >
                     Start Verification
                   </button>
                )
             ) : (
                <button 
                  onClick={endSession}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  End Session
                </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 max-w-7xl mx-auto px-6">
        
        {/* Error Message */}
        {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 flex items-center gap-3">
                <AlertCircle size={20} />
                {error}
            </div>
        )}
        
        {/* Info Message for Key */}
        {requiresKeySelection && !error && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-200 flex items-center gap-3">
                <AlertCircle size={20} />
                Please select a paid API key to use the Gemini Live features.
            </div>
        )}

        {/* Stepper */}
        <div className="flex justify-between items-center mb-12 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10 transform -translate-y-1/2"></div>
            {[
              { id: AppPhase.AADHAR, label: "Identity" }, 
              { id: AppPhase.PAN, label: "Tax Info" }, 
              { id: AppPhase.VERIFY, label: "Verify" }, 
              { id: AppPhase.DIGILOCKER, label: "DigiLocker" }
            ].map((step, idx) => (
                <div key={idx} className="flex flex-col items-center bg-slate-950 px-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${getStepColor(step.id)}`}>
                        {idx + 1}
                    </div>
                    <span className={`mt-2 text-xs font-semibold tracking-wider ${appState.phase === step.id ? 'text-gov-blue' : 'text-slate-600'}`}>{step.label}</span>
                </div>
            ))}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <InfoCard 
              title="Aadhar Details" 
              data={appState.aadhar} 
              isActive={appState.phase === AppPhase.AADHAR}
              type="AADHAR"
            />
            <InfoCard 
              title="PAN Details" 
              data={appState.pan} 
              isActive={appState.phase === AppPhase.PAN}
              type="PAN"
            />
        </div>

        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
           {/* Verification Status */}
           <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
              <div className={`p-3 rounded-full ${appState.verification === VerificationStatus.MATCH ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                <Activity size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Cross-Verification</p>
                <p className="text-lg font-bold text-slate-200">{appState.verification}</p>
              </div>
           </div>

           {/* DigiLocker Status */}
           <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
              <div className={`p-3 rounded-full ${appState.digilocker.isCreated ? 'bg-gov-blue/20 text-gov-blue' : 'bg-slate-800 text-slate-500'}`}>
                <Lock size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase font-semibold">DigiLocker Account</p>
                <p className="text-lg font-bold text-slate-200">
                    {appState.digilocker.isCreated ? 'CREATED SUCCESSFULLY' : 'PENDING CREATION'}
                </p>
              </div>
              {appState.digilocker.isCreated && (
                  <div className="bg-slate-950 px-4 py-2 rounded font-mono text-xl tracking-widest border border-slate-700">
                      PIN: {appState.digilocker.pin}
                  </div>
              )}
           </div>
        </div>

      </main>

      {/* Footer Visualizer Area (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950 border-t border-slate-800 p-4 shadow-2xl z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6">
            
            {/* Input Visualizer (Mic) */}
            <div className="flex-1 w-full flex items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                    <button 
                        onClick={toggleMic}
                        disabled={!appState.isConnected}
                        className={`p-4 rounded-full transition-all ${micMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gov-blue/20 text-gov-blue hover:bg-gov-blue/30'} disabled:opacity-50`}
                    >
                        {micMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Input</span>
                </div>
                <div className="flex-1 h-24 w-full">
                    <Visualizer 
                        analyser={inputAnalyser} 
                        color="#3B82F6" 
                        label="User Audio (16kHz)"
                        isMuted={micMuted}
                        width={400}
                        height={96}
                    />
                </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-16 bg-slate-800"></div>

            {/* Output Visualizer (AI) */}
            <div className="flex-1 w-full flex items-center gap-4">
                <div className="flex-1 h-24 w-full">
                    <Visualizer 
                        analyser={outputAnalyser} 
                        color="#0EA5E9" 
                        label="AI Response (24kHz)"
                        width={400}
                        height={96}
                    />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <button 
                        onClick={togglePlayback}
                        disabled={!appState.isConnected}
                        className={`p-4 rounded-full transition-all ${!appState.isAudioPlaying ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} disabled:opacity-50`}
                    >
                        {appState.isAudioPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Output</span>
                </div>
            </div>

        </div>
      </div>

    </div>
  );
};

export default App;