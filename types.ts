export enum AppPhase {
  IDLE = 'IDLE',
  AADHAR = 'AADHAR',
  PAN = 'PAN',
  VERIFY = 'VERIFY',
  DIGILOCKER = 'DIGILOCKER',
  COMPLETE = 'COMPLETE'
}

export interface IdentityDoc {
  fullName: string;
  number: string;
  dob: string;
}

export interface DigiLockerState {
  isCreated: boolean;
  pin: string | null;
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  MATCH = 'MATCH',
  MISMATCH = 'MISMATCH'
}

export interface AppState {
  phase: AppPhase;
  aadhar: IdentityDoc | null;
  pan: IdentityDoc | null;
  verification: VerificationStatus;
  digilocker: DigiLockerState;
  isConnected: boolean;
  isAudioPlaying: boolean;
}

// Tool Arguments Interfaces
export interface SaveAadharArgs {
  fullName: string;
  number: string;
  dob: string;
}

export interface SavePanArgs {
  fullName: string;
  number: string;
  dob: string;
}

export interface VerifyDetailsArgs {
  action: string;
}

export interface CreateDigilockerArgs {
  pin: string;
}

// Callback Types
export type ToolCallbacks = {
  onSaveAadhar: (args: SaveAadharArgs) => void;
  onSavePan: (args: SavePanArgs) => void;
  onVerifyDetails: (args: VerifyDetailsArgs) => Promise<string>;
  onCreateDigilocker: (args: CreateDigilockerArgs) => void;
};
