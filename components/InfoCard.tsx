import React from 'react';
import { IdentityDoc } from '../types';
import { ShieldCheck, User } from 'lucide-react';

interface InfoCardProps {
  title: string;
  data: IdentityDoc | null;
  isActive: boolean;
  type: 'AADHAR' | 'PAN';
}

const InfoCard: React.FC<InfoCardProps> = ({ title, data, isActive, type }) => {
  return (
    <div className={`
      relative p-6 rounded-xl transition-all duration-500
      backdrop-blur-md bg-slate-800/40 border
      ${isActive ? 'border-gov-blue shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-slate-700 shadow-lg'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-2">
        <div className={`p-2 rounded-lg ${isActive ? 'bg-gov-blue/20 text-gov-blue' : 'bg-slate-700 text-slate-400'}`}>
           {type === 'AADHAR' ? <User size={20} /> : <ShieldCheck size={20} />}
        </div>
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
        {isActive && (
           <span className="ml-auto flex h-2.5 w-2.5">
             <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-gov-blue opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gov-blue"></span>
           </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {data ? (
          <>
            <div className="group">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Full Name</label>
              <p className="text-slate-100 font-medium font-mono">{data.fullName}</p>
            </div>
            <div className="group">
               <label className="text-xs text-slate-500 uppercase tracking-wider">
                 {type === 'AADHAR' ? 'UID Number' : 'PAN Number'}
               </label>
               <p className="text-slate-100 font-medium font-mono tracking-wide">{data.number}</p>
            </div>
            <div className="group">
               <label className="text-xs text-slate-500 uppercase tracking-wider">Date of Birth</label>
               <p className="text-slate-100 font-medium font-mono">{data.dob}</p>
            </div>
          </>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 animate-pulse">
            <span className="text-sm italic">Waiting for input...</span>
          </div>
        )}
      </div>
      
      {/* Decorative Corner */}
      <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none">
         <img src={`https://picsum.photos/seed/${type}/64/64`} className="rounded grayscale" alt="watermark" />
      </div>
    </div>
  );
};

export default InfoCard;
