
import React, { useState, useEffect, useCallback, useMemo, useRef, memo, useTransition } from 'react';
import { 
  User, UserRole, Transaction, TransactionType, Session, 
  TransactionCategory, MoneyRequest, RequestStatus, FamilyMessage
} from '../types';
import { storageService } from '../services/storageService';

import { WarningIcon, InfoIcon } from '../constants';

const BRAND_NAME = "ZenLedger";
const SECURITY_TAG = "AES-256 Bank-Grade Encryption";

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const Toast = memo(({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const styles = { 
    success: 'bg-slate-900 border-slate-700', 
    error: 'bg-rose-600 border-rose-500 shadow-rose-900/20', 
    info: 'bg-indigo-600 border-indigo-500' 
  };

  return (
    <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] ${styles[type]} border text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500`}>
      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{message}</p>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 text-xs">✕</button>
    </div>
  );
});

const FiscalAuditAI = memo(({ transactions, balance }: any) => {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const conductAudit = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Financial audit for family ledger. Current Liquidity: ₹${balance}. 
        Activity: ${JSON.stringify(transactions.slice(0, 5))}. 
        Identify spending leakage and suggest 3 wealth strategies. Bullet points, concise. Max 40 words.`;
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        // Correct usage of response.text property to extract content
        setReport(res.text || "Report unavailable.");
      } catch (e) { setReport("Module optimizing patterns..."); } finally { setLoading(false); }
    };
    conductAudit();
  }, [transactions, balance]);

  return (
    <div className="bg-slate-900 text-white rounded-[2rem] p-10 relative overflow-hidden group shadow-xl">
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-sm">🏛️</div>
           <div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Asset Intelligence Node</p>
              <h3 className="text-lg font-black tracking-tight">Audit Insight</h3>
           </div>
        </div>
        <div className="text-xs font-medium leading-relaxed text-slate-400 italic">
          {loading ? "Verifying cluster data..." : report}
        </div>
      </div>
    </div>
  );
});

const INPUT_STYLE = "w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all duration-200 font-medium";

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'ANALYTICS' | 'MESSAGES'>('LEDGER');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const [users, setUsers] = useState<User[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [msgs, setMsgs] = useState<FamilyMessage[]>([]);
  const [reqs, setReqs] = useState<MoneyRequest[]>([]);

  const [authForm, setAuthForm] = useState({ fid: '', handle: '', pass: '' });
  const [spendForm, setSpendForm] = useState({ amt: '', desc: '', cat: TransactionCategory.FOOD });

  const sync = useCallback(async () => {
    try {
      const [u, t, r, m] = await Promise.all([
        storageService.getUsers(),
        storageService.getTransactions(),
        storageService.getRequests(),
        storageService.getMessages()
      ]);
      setUsers(u); setTxs(t); setReqs(r); setMsgs(m);
    } catch (err) { console.error("Sync Error", err); }
  }, []);

  useEffect(() => {
    const init = async () => {
      const active = storageService.getStoredSession();
      if (active) setSession(active);
      await sync();
      setLoading(false);
    };
    init();
  }, [sync]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);

    if (!authForm.fid || !authForm.handle || !authForm.pass) {
      return setToast({ msg: 'Credentials Required', type: 'error' });
    }

    startTransition(async () => {
      // Corrected storageService call to use the existing signupCluster method instead of the non-existent signupFamily
      const res = authMode === 'LOGIN' 
        ? await storageService.login(authForm.fid, authForm.handle, authForm.pass)
        : await storageService.signupCluster(authForm.fid, authForm.handle, authForm.pass);

      if (res.success) {
        if (authMode === 'LOGIN') {
          setSession(res.data as Session);
          setToast({ msg: 'Access Verified', type: 'success' });
          await sync();
        } else {
          setAuthMode('LOGIN');
          setToast({ msg: 'Cluster Provisioned', type: 'success' });
        }
      } else {
        setToast({ msg: res.error || 'Connection Failed', type: 'error' });
      }
    });
  };

  const toggleMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/Gayatri Mantra - Om Bhur Bhuva Swaha.mp3');
      audioRef.current.loop = true;
    }
    if (isMusicPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(e => console.error("Audio failure", e));
    setIsMusicPlaying(!isMusicPlaying);
  };

  const currentBalance = useMemo(() => {
    if (!session) return 0;
    const myTxs = txs.filter(t => t.userId === session.userId);
    return myTxs.reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
  }, [txs, session]);

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12">
       <div className="w-10 h-10 bg-slate-900 rounded-lg mb-8 animate-pulse shadow-2xl" />
       <div className="text-[10px] font-black tracking-[0.6em] text-slate-400 uppercase">Verifying Cluster integrity</div>
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-[#fafafa]'} relative overflow-x-hidden`}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {!session && (
        <div className="min-h-screen flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="max-w-md w-full space-y-12">
            <div className="text-center">
               <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 leading-none mb-4">{BRAND_NAME}<span className="text-slate-400 not-italic">Cloud</span></h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em]">Institutional Governance Protocol</p>
            </div>
            
            <div className="bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-2xl">
               <div className="flex bg-slate-100 rounded-xl p-1 mb-10 shadow-inner">
                 <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${authMode === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Authorize</button>
                 <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${authMode === 'SIGNUP' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Provision</button>
               </div>
               
               <form onSubmit={handleAuth} className="space-y-4">
                 <input type="text" placeholder="Cloud Cluster ID" value={authForm.fid} onChange={e=>setAuthForm({...authForm, fid: e.target.value})} className={INPUT_STYLE} />
                 <input type="text" placeholder="Identity Handle" value={authForm.handle} onChange={e=>setAuthForm({...authForm, handle: e.target.value})} className={INPUT_STYLE} />
                 <input type="password" placeholder="Passphrase" value={authForm.pass} onChange={e=>setAuthForm({...authForm, pass: e.target.value})} className={INPUT_STYLE} />
                 <button disabled={isPending} className="w-full bg-slate-900 text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50">
                   {isPending ? 'Verifying...' : (authMode === 'LOGIN' ? 'Link Node' : 'Initialize Cluster')}
                 </button>
               </form>
               <p className="mt-8 text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-60 italic">{SECURITY_TAG}</p>
            </div>

            <div className="flex flex-col items-center gap-4">
               <button onClick={() => setIsInfoOpen(!isInfoOpen)} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-white shadow-sm">
                 <InfoIcon className="w-4 h-4" />
               </button>
               {isInfoOpen && (
                 <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl max-w-xs animate-in zoom-in-95 fade-in duration-300 border border-slate-800">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Operating Standards</h4>
                    <ul className="text-[10px] font-medium text-slate-300 space-y-3 leading-relaxed">
                      <li>• Administrator establishes a unique Cluster ID</li>
                      <li>• Members are provisioned with specific Nodes</li>
                      <li>• Every entry is recorded on an immutable ledger</li>
                      <li>• End-to-end encryption for all data points</li>
                    </ul>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {session && (
        <div key="dashboard" className="animate-in fade-in duration-700">
          <header className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-b sticky top-0 z-40 shadow-sm`}>
            <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 ${darkMode ? 'bg-slate-100' : 'bg-slate-900'} rounded-lg flex items-center justify-center`}>
                  <div className={`w-2 h-2 ${darkMode ? 'bg-slate-900' : 'bg-white'} rounded-full animate-pulse`} />
                </div>
                <div>
                  <h1 className={`text-lg font-black tracking-tighter italic ${darkMode ? 'text-white' : 'text-slate-900'}`}>{BRAND_NAME}</h1>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">@{users.find(u=>u.id===session.userId)?.username} &middot; Cluster {session.familyId}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setDarkMode(!darkMode)} className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'} transition-all`}>
                  {darkMode ? '☀️' : '🌙'}
                </button>
                <button onClick={() => { storageService.logout(); setSession(null); }} className={`px-5 py-2 ${darkMode ? 'bg-slate-700 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600'} rounded-xl text-[9px] font-black uppercase tracking-widest transition-all`}>Disconnect</button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-8 mt-10">
            <div className={`flex ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl p-1 border mb-10 shadow-sm max-w-sm`}>
              {['LEDGER', 'ANALYTICS', 'MESSAGES'].map((t: any) => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === t ? (darkMode ? 'bg-slate-700 text-orange-400 shadow-lg' : 'bg-slate-900 text-white shadow-lg') : (darkMode ? 'text-slate-400 hover:text-orange-400' : 'text-slate-400 hover:text-slate-600')}`}>{t}</button>
              ))}
            </div>

            <div className="animate-fade-in-up pb-24">
              {activeTab === 'LEDGER' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                   <div className="lg:col-span-4 space-y-8">
                      <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-xl relative overflow-hidden group">
                         <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-4 text-slate-500">Node Liquidity</p>
                         <h2 className="text-6xl font-black tabular-nums mb-8 tracking-tighter">{fmt(currentBalance)}</h2>
                         <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" /> Verified Node
                         </div>
                      </div>

                      <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-[2rem] p-10 space-y-5`}>
                         <h3 className={`text-[9px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-400'} mb-6 tracking-widest`}>Execute DEBIT</h3>
                         <div className="space-y-4">
                           <input type="number" placeholder="Sum (₹)" value={spendForm.amt} onChange={e=>setSpendForm({...spendForm, amt: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} />
                           <input type="text" placeholder="Purpose" value={spendForm.desc} onChange={e=>setSpendForm({...spendForm, desc: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} />
                           <button onClick={async () => {
                             const a = parseFloat(spendForm.amt); if(!a || !spendForm.desc) return setToast({msg: 'Invalid Data', type:'error'});
                             await storageService.saveTransaction(session, {id:`tx_${Date.now()}`, userId: session.userId, amount: a, type: TransactionType.DEBIT, category: spendForm.cat, description: spendForm.desc, timestamp: Date.now()});
                             setSpendForm({amt:'', desc:'', cat: TransactionCategory.FOOD}); setToast({msg: 'Logged', type:'success'}); sync();
                           }} className={`w-full py-4.5 ${darkMode ? 'bg-slate-700 text-orange-400 hover:bg-slate-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-xl font-black uppercase text-[9px] tracking-widest transition-all`}>Log Disbursement</button>
                         </div>
                      </div>
                   </div>

                   <div className="lg:col-span-8">
                      <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-[2rem] p-12`}>
                         <h3 className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-400'} mb-10 italic`}>Audit Ledger</h3>
                         <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                            {txs.filter(t=>t.userId===session.userId).map(tx => (
                              <div key={tx.id} className={`flex items-center justify-between p-6 ${darkMode ? 'bg-slate-700 border-slate-600 hover:border-orange-400' : 'bg-slate-50 border-slate-100 hover:border-slate-900'} rounded-2xl transition-all group`}>
                                <div className="flex items-center gap-5">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${tx.type === TransactionType.CREDIT ? (darkMode ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-50 text-emerald-600') : (darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-500')}`}>
                                      {tx.type === TransactionType.CREDIT ? '↓' : '↑'}
                                   </div>
                                   <div>
                                      <p className={`text-sm font-bold ${darkMode ? 'text-orange-400' : 'text-slate-900'} leading-tight tracking-tight`}>{tx.description}</p>
                                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1.5">{new Date(tx.timestamp).toLocaleString()}</p>
                                   </div>
                                </div>
                                <div className={`text-xl font-black tabular-nums tracking-tighter ${tx.type === TransactionType.CREDIT ? (darkMode ? 'text-emerald-300' : 'text-emerald-600') : (darkMode ? 'text-orange-400' : 'text-slate-900')}`}>
                                  {tx.type === TransactionType.CREDIT ? '+' : '-'}{tx.amount.toFixed(2)}
                                </div>
                              </div>
                            ))}
                            {txs.filter(t=>t.userId===session.userId).length === 0 && <p className={`text-center py-40 ${darkMode ? 'text-slate-500' : 'text-slate-300'} font-black uppercase text-[10px] tracking-widest italic`}>Ledger Clean</p>}
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      <div className="fixed bottom-10 right-10 z-[200]">
        <button
          onClick={toggleMusic}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all duration-700 border-2 ${isMusicPlaying ? (darkMode ? 'bg-slate-700 text-orange-400 border-orange-400 animate-pulse' : 'bg-slate-900 text-white border-white animate-pulse') : (darkMode ? 'bg-slate-800 text-orange-400 border-slate-600 hover:scale-110 active:scale-95' : 'bg-white text-slate-900 border-slate-200 hover:scale-110 active:scale-95')}`}
          title={isMusicPlaying ? "Pause Mantra" : "Planning Focus (Om)"}
        >
          ॐ
        </button>
      </div>
    </div>
  );
};

export default App;
