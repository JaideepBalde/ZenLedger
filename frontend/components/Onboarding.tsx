
import React from 'react';
import { UserRole } from '../../database/types';

interface OnboardingProps {
  role: UserRole;
  onDismiss: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ role, onDismiss }) => {
  const isParent = role === UserRole.PARENT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-3xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className={`h-1.5 ${isParent ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
        <div className="p-10">
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight italic">
            ZenLedger<span className="text-indigo-600 not-italic">Cloud</span>
          </h2>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-8">System Briefing</p>
          
          <div className="space-y-6 text-slate-600">
            {isParent ? (
              <>
                <p className="font-bold text-slate-900 uppercase text-[10px] tracking-widest">Admin Responsibilities:</p>
                <ul className="space-y-4">
                  <li className="flex items-start text-sm">
                    <span className="bg-indigo-50 text-indigo-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">01</span>
                    <span>Provision family nodes for each child member.</span>
                  </li>
                  <li className="flex items-start text-sm">
                    <span className="bg-indigo-50 text-indigo-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">02</span>
                    <span>Execute periodic <span className="font-bold text-slate-900">CREDIT</span> allocations.</span>
                  </li>
                  <li className="flex items-start text-sm">
                    <span className="bg-indigo-50 text-indigo-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">03</span>
                    <span>Review historical ledger audit trails globally.</span>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-900 uppercase text-[10px] tracking-widest">User Responsibilities:</p>
                <ul className="space-y-4">
                  <li className="flex items-start text-sm">
                    <span className="bg-emerald-50 text-emerald-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">01</span>
                    <span>Monitor individual asset liquidity in real-time.</span>
                  </li>
                  <li className="flex items-start text-sm">
                    <span className="bg-emerald-50 text-emerald-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">02</span>
                    <span>Log all expenses (<span className="font-bold text-slate-900">DEBIT</span>) with precise details.</span>
                  </li>
                  <li className="flex items-start text-sm">
                    <span className="bg-emerald-50 text-emerald-600 rounded-lg w-6 h-6 flex items-center justify-center text-[10px] font-black mt-0.5 mr-3 shrink-0">03</span>
                    <span>Understand that all entries are permanent records.</span>
                  </li>
                </ul>
              </>
            )}
          </div>

          <button
            onClick={onDismiss}
            className={`mt-10 w-full py-4 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all shadow-xl ${
              isParent ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Acknowledge & Access
          </button>
        </div>
      </div>
    </div>
  );
};
