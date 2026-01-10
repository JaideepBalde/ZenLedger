
import React, { useState } from 'react';
import { InfoIcon } from '../constants';

export const HelpSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest"
      >
        <InfoIcon className="mr-2 w-3.5 h-3.5" />
        {isOpen ? 'Close Guidance' : 'Protocol Overview'}
      </button>
      
      {isOpen && (
        <div className="mt-4 bg-slate-50 p-6 rounded-3xl text-[13px] text-slate-600 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border border-slate-100">
          <p>
            <strong className="text-slate-900 uppercase tracking-tighter">Unified Ledger Accuracy:</strong> Balances are derived by evaluating every transaction since account inception. This provides a mathematically perfect audit trail.
          </p>
          <p>
            <strong className="text-slate-900 uppercase tracking-tighter">Accountability Matrix:</strong> 
            <ul className="list-disc ml-5 mt-2 space-y-2">
              <li>Parents function as the Family Bank—responsible for asset allocation and oversight.</li>
              <li>Children manage individual wallets—responsible for logging every expense accurately.</li>
            </ul>
          </p>
          <p>
            <strong className="text-slate-900 uppercase tracking-tighter">Immutable Governance:</strong> Transactions cannot be deleted or edited. If a discrepancy occurs, a correction transaction must be logged to maintain ledger integrity.
          </p>
        </div>
      )}
    </div>
  );
};
