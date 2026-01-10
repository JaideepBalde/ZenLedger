import React, { useState, useEffect, useCallback, useMemo, useRef, memo, useTransition } from 'react';
import {
  User, UserRole, Transaction, TransactionType, Session,
  TransactionCategory, MoneyRequest, RequestStatus, FamilyMessage
} from './database/types';
import { storageService } from './backend/storageService';
import { GoogleGenAI } from "@google/genai";
import { WarningIcon, InfoIcon, ClockIcon } from './constants';
import { Onboarding } from './components/Onboarding';

const BRAND_NAME = "ZenLedger - by JD";
const SECURITY_TAG = "End-to-End Governance Node • Institutional Grade";
// Using the local mantra.mp3 file
const MANTRA_URL = "/mantra.mp3";

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { 
  style: 'currency', 
  currency: 'INR',
  minimumFractionDigits: 2 
}).format(n);

const Toast = memo(({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  const styles = { 
    success: 'bg-slate-900 border-slate-700 shadow-slate-900/10', 
    error: 'bg-rose-600 border-rose-500 shadow-rose-600/20', 
    info: 'bg-indigo-600 border-indigo-500 shadow-indigo-600/10' 
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
        const prompt = `Perform an institutional wealth audit for a cluster ledger. Current Liquidity: ₹${balance}. Recent Activity: ${JSON.stringify(transactions.slice(0, 5))}. Suggest 3 wealth strategies. MANDATORY: Plain text only, no markdown, no stars, no hashtags. Max 45 words.`;
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        const cleanText = (res.text || "Report generated.").replace(/[*#_`~]/g, '').trim();
        setReport(cleanText);
      } catch (e) { setReport("AI Engine optimizing patterns..."); } finally { setLoading(false); }
    };
    conductAudit();
  }, [transactions, balance]);

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 relative overflow-hidden group shadow-sm">
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-sm shadow-inner">🏛️</div>
           <div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-400">Wealth Intelligence Node</p>
              <h3 className="text-lg font-black tracking-tight italic text-slate-900">Fiscal Insight</h3>
           </div>
        </div>
        <div className="text-xs font-medium leading-relaxed text-slate-600 italic">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-2 bg-slate-100 rounded w-full" />
              <div className="h-2 bg-slate-100 rounded w-5/6" />
            </div>
          ) : report}
        </div>
      </div>
    </div>
  );
});

const INPUT_STYLE = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all duration-300 font-medium placeholder:text-slate-300 text-slate-900";

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'REGISTRY' | 'MESSAGES' | 'REQUESTS'>('LEDGER');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cluster State
  const [users, setUsers] = useState<User[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [msgs, setMsgs] = useState<FamilyMessage[]>([]);
  const [reqs, setReqs] = useState<MoneyRequest[]>([]);

  // Forms
  const [authForm, setAuthForm] = useState({ fid: '', handle: '', pass: '' });
  const [spendForm, setSpendForm] = useState({ amt: '', desc: '', cat: TransactionCategory.OTHER });
  const [memberForm, setMemberForm] = useState({ handle: '', pass: '' });
  const [provisionForm, setProvisionForm] = useState({ memberId: '', amt: '', desc: 'Institutional Allocation' });
  const [msgInput, setMsgInput] = useState('');
  const [msgTarget, setMsgTarget] = useState('cluster');
  const [reqForm, setReqForm] = useState({ amt: '', reason: '' });

  const sync = useCallback(async () => {
    if (!session) return;
    try {
      const [u, t, r, m] = await Promise.all([
        storageService.getUsers(session),
        storageService.getTransactions(session),
        storageService.getRequests(session),
        storageService.getMessages(session)
      ]);
      setUsers(u);
      setTxs(t);
      setReqs(r);
      setMsgs(m);
    } catch (err) { console.error("Sync Error", err); }
  }, [session]);

  useEffect(() => {
    const init = async () => {
      const active = storageService.getStoredSession();
      if (active) setSession(active);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { if (session) sync(); }, [session, sync]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.fid || !authForm.handle || !authForm.pass) return setToast({ msg: 'Credentials Required', type: 'error' });
    startTransition(async () => {
      const res = authMode === 'LOGIN'
        ? await storageService.login(authForm.fid, authForm.handle, authForm.pass)
        : await storageService.signupFamily(authForm.fid, authForm.handle, authForm.pass);
      
      if (res.success) {
        if (authMode === 'LOGIN') {
          const s = res.data as Session; 
          setSession(s);
          if (!storageService.getOnboardingStatus(s.userId)) setShowOnboarding(true);
          setToast({ msg: 'Identity Authenticated', type: 'success' });
        } else {
          setAuthMode('LOGIN'); 
          setToast({ msg: 'Cluster Node Provisioned', type: 'success' });
        }
      } else setToast({ msg: res.error || 'Access Denied', type: 'error' });
    });
  };

  const handleLogout = () => {
    storageService.logout();
    setSession(null);
    setAuthMode('LOGIN');
    setAuthForm({ fid: '', handle: '', pass: '' });
    setActiveTab('LEDGER');
  };

  const toggleMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(MANTRA_URL);
      audioRef.current.loop = true;
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.onerror = (e) => {
        console.error("Audio error", e);
        setToast({ msg: "Audio file not found or corrupted", type: 'error' });
      };
      audioRef.current.oncanplaythrough = () => {
        console.log("Audio loaded successfully");
      };
    }

    if (isMusicPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      setToast({ msg: "Focus Engine Deactivated", type: 'info' });
    } else {
      // Try to play with user interaction
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsMusicPlaying(true);
            setToast({ msg: "Focus Engine Activated", type: 'success' });
          })
          .catch((err) => {
            console.error("Playback error", err);
            // Try muted playback to bypass restrictions
            if (audioRef.current && !audioRef.current.muted) {
              audioRef.current.muted = true;
              audioRef.current.play()
                .then(() => {
                  audioRef.current!.muted = false;
                  setIsMusicPlaying(true);
                  setToast({ msg: "Focus Engine Activated (Unmuted)", type: 'success' });
                })
                .catch(() => {
                  setToast({ msg: "Browser blocks audio - click again after page interaction", type: 'info' });
                });
            } else {
              setToast({ msg: "Browser blocks audio - click again after page interaction", type: 'info' });
            }
          });
      }
    }
  };

  const currentBalance = useMemo(() => {
    if (!session) return 0;
    const balance = txs.filter(t => t.userId === session.userId).reduce((acc, t) => {
      return t.type === TransactionType.CREDIT ? acc + t.amount : acc - t.amount;
    }, 0);
    return balance;
  }, [txs, session]);

  const filteredMsgs = useMemo(() => {
    if (!session) return [];
    return msgs.filter(m => {
      if (msgTarget === 'cluster') return m.toId === 'cluster';
      return (m.fromId === session.userId && m.toId === msgTarget) || (m.fromId === msgTarget && m.toId === session.userId);
    });
  }, [msgs, msgTarget, session]);

  if (loading) return <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12"><div className="w-12 h-12 bg-slate-900 rounded-2xl animate-pulse shadow-xl" /><p className="mt-8 text-[10px] font-black uppercase tracking-[0.6em] text-slate-400">Initializing JD Secure Infrastructure</p></div>;

  return (
    <div className="min-h-screen bg-[#fafafa] relative overflow-x-hidden font-inter selection:bg-slate-900 selection:text-white">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showOnboarding && session && <Onboarding role={session.role} onDismiss={() => { storageService.setOnboardingStatus(session.userId); setShowOnboarding(false); }} />}

      {!session ? (
        <div className="min-h-screen flex items-center justify-center p-8 animate-in fade-in duration-1000">
          <div className="max-w-md w-full space-y-12">
            <div className="text-center">
              <h1 className="text-6xl font-black italic tracking-tighter text-slate-900 mb-4">{BRAND_NAME}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] leading-relaxed">Family Financial Governance</p>
            </div>
            <div className="bg-white border border-slate-200 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-900" />
              <div className="flex bg-slate-100 rounded-2xl p-1.5 mb-10">
                <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Authorize</button>
                <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'SIGNUP' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Provision</button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <input type="text" placeholder="Cluster ID" value={authForm.fid} onChange={e=>setAuthForm({...authForm, fid: e.target.value})} className={INPUT_STYLE} />
                <input type="text" placeholder="Identity Handle" value={authForm.handle} onChange={e=>setAuthForm({...authForm, handle: e.target.value})} className={INPUT_STYLE} />
                <input type="password" placeholder="Passphrase" value={authForm.pass} onChange={e=>setAuthForm({...authForm, pass: e.target.value})} className={INPUT_STYLE} />
                <button disabled={isPending} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all hover:bg-black">
                  {isPending ? 'Verifying Node...' : (authMode === 'LOGIN' ? 'Access Cluster' : 'Initialize Cluster')}
                </button>
              </form>
              <p className="mt-10 text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest italic">{SECURITY_TAG}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-700">
          <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-10 py-6 flex items-center justify-between">
            <div className="flex items-center gap-5 group">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter italic leading-none">{BRAND_NAME}</h1>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> @{users.find(u=>u.id===session.userId)?.username} &middot; {session.role}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="px-7 py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Disconnect</button>
          </header>

          <main className="max-w-7xl mx-auto px-10 mt-12 pb-32">
            <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 mb-12 shadow-sm max-w-2xl overflow-x-auto no-scrollbar">
              {['LEDGER', 'REGISTRY', 'MESSAGES', 'REQUESTS'].map((t: any) => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === t ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'REGISTRY' ? (session.role === UserRole.PARENT ? 'NODE REGISTRY' : 'PEER REGISTRY') : t}
                </button>
              ))}
            </div>

            <div className="animate-fade-in-up">
              {activeTab === 'LEDGER' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4 space-y-12">
                    <div className="bg-slate-900 rounded-[3.5rem] p-12 text-white shadow-3xl relative overflow-hidden border border-white/5 group">
                      <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-6 text-slate-500">Liquidity Index</p>
                      <h2 className="text-6xl font-black tabular-nums mb-10 tracking-tighter leading-none">
                        {fmt(currentBalance)}
                      </h2>
                      <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" /> Asset Verified & Secure
                      </div>
                    </div>

                    {session.role === UserRole.CHILD && (
                      <div className="bg-white border border-slate-200 rounded-[3rem] p-12 space-y-8 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] italic">Post Debit Entry</h3>
                        <div className="space-y-5">
                          <input type="number" placeholder="Sum (₹)" value={spendForm.amt} onChange={e=>setSpendForm({...spendForm, amt: e.target.value})} className={INPUT_STYLE} />
                          <input type="text" placeholder="Purpose" value={spendForm.desc} onChange={e=>setSpendForm({...spendForm, desc: e.target.value})} className={INPUT_STYLE} />
                          <button onClick={async () => {
                            const a = parseFloat(spendForm.amt); if(!a || !spendForm.desc) return setToast({msg: 'Invalid Data', type:'error'});
                            await storageService.saveTransaction(session, {id:`tx_${Date.now()}`, userId: session.userId, amount: a, type: TransactionType.DEBIT, category: spendForm.cat, description: spendForm.desc, timestamp: Date.now()});
                            setSpendForm({amt:'', desc:'', cat: TransactionCategory.OTHER}); sync(); setToast({msg: 'Ledger Record Post Successful', type:'success'});
                          }} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-[0.98]">Commit Log</button>
                        </div>
                      </div>
                    )}
                    <FiscalAuditAI transactions={txs} balance={currentBalance} />
                  </div>
                  
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3.5rem] p-12 shadow-sm min-h-[600px] flex flex-col">
                    <div className="flex items-center justify-between mb-12">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Institutional Audit Trail</h3>
                      <button onClick={sync} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-all text-slate-400">
                        <ClockIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-5 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                      {txs.filter(t=>t.userId===session.userId).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-8 bg-slate-50/50 border border-slate-100 rounded-[2rem] hover:border-slate-900 hover:bg-white transition-all group animate-in slide-in-from-right-4 duration-500">
                          <div className="flex items-center gap-8">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${tx.type === TransactionType.CREDIT ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-200 text-slate-500 border border-slate-300'}`}>
                              {tx.type === TransactionType.CREDIT ? '↓' : '↑'}
                            </div>
                            <div>
                              <p className="text-lg font-bold text-slate-900 leading-tight tracking-tight">{tx.description}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">
                                {new Date(tx.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className={`text-3xl font-black tabular-nums tracking-tighter ${tx.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {tx.type === TransactionType.CREDIT ? '+' : '-'}{tx.amount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                      {txs.filter(t=>t.userId===session.userId).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-48 text-slate-300 opacity-40 italic">
                           <p className="text-[12px] font-black uppercase tracking-[0.6em]">Ledger Stream Empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Other tabs follow same refined aesthetic */}
              {activeTab === 'REGISTRY' && session.role === UserRole.PARENT && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[3rem] p-12 space-y-8 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] italic">Provision Operational Node</h3>
                    <div className="space-y-5">
                      <input type="text" placeholder="Identity Handle" value={memberForm.handle} onChange={e=>setMemberForm({...memberForm, handle: e.target.value})} className={INPUT_STYLE} />
                      <input type="password" placeholder="Passphrase" value={memberForm.pass} onChange={e=>setMemberForm({...memberForm, pass: e.target.value})} className={INPUT_STYLE} />
                      <button onClick={async () => {
                        const res = await storageService.createChild(session, memberForm.handle, memberForm.pass);
                        if (res.success) { sync(); setMemberForm({handle:'', pass:''}); setToast({msg: 'Node Successfully Linked', type: 'success'}); }
                        else setToast({msg: res.error || 'System Fault', type:'error'});
                      }} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-[0.98]">Initialize Node</button>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3.5rem] p-12 shadow-sm min-h-[600px]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 mb-12 italic">Active Governance Registry</h3>
                    <div className="space-y-10">
                      {users.filter(u=>u.role===UserRole.CHILD).map(member => {
                        const mBal = txs.filter(t=>t.userId===member.id).reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
                        return (
                          <div key={member.id} className="p-10 border border-slate-100 rounded-[2.5rem] bg-slate-50 space-y-10 group hover:border-slate-900 transition-all duration-500">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="text-3xl font-black italic text-slate-900 tracking-tighter">@{member.username}</h4>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Operational Status: Verified</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Current Liquidity</p>
                                <p className="text-4xl font-black tracking-tighter text-slate-900">{fmt(mBal)}</p>
                              </div>
                            </div>
                            <div className="bg-white p-10 rounded-[2rem] border border-slate-200 flex items-center gap-8 shadow-sm">
                              <div className="flex-1 space-y-3">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">Inject Operational Capital</p>
                                <input type="number" placeholder="Value (₹)" className={INPUT_STYLE} value={provisionForm.memberId === member.id ? provisionForm.amt : ''} onChange={e=>setProvisionForm({memberId: member.id, amt: e.target.value, desc: provisionForm.desc})} />
                              </div>
                              <button onClick={async () => {
                                const a = parseFloat(provisionForm.amt); if(!a || provisionForm.memberId !== member.id) return;
                                await storageService.saveTransaction(session, {id:`tx_prov_${Date.now()}`, userId: member.id, amount: a, type: TransactionType.CREDIT, category: TransactionCategory.GIFT, description: provisionForm.desc, timestamp: Date.now()});
                                sync(); setProvisionForm({...provisionForm, amt:''}); setToast({msg: 'Capital Injection Successful', type:'success'});
                              }} className="mt-7 px-12 py-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black shadow-lg active:scale-[0.98] transition-all">Credit Node</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'MESSAGES' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-[750px]">
                  <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm overflow-y-auto">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 mb-10 italic">Secure Transmissions</h3>
                     <div className="space-y-4">
                        <button onClick={() => setMsgTarget('cluster')} className={`w-full p-8 rounded-[2rem] text-left border transition-all duration-500 ${msgTarget === 'cluster' ? 'bg-slate-900 text-white border-slate-900 shadow-2xl' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'}`}>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2">Cluster Broadcast</p>
                          <p className={`text-[9px] uppercase tracking-widest opacity-60 italic ${msgTarget === 'cluster' ? 'text-white' : 'text-slate-400'}`}>Global Encryption</p>
                        </button>
                        {users.filter(u => u.id !== session.userId).map(u => (
                          <button key={u.id} onClick={() => setMsgTarget(u.id)} className={`w-full p-8 rounded-[2rem] text-left border transition-all duration-500 ${msgTarget === u.id ? 'bg-slate-900 text-white border-slate-900 shadow-2xl' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'}`}>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2">Node: @{u.username}</p>
                            <p className={`text-[9px] uppercase tracking-widest opacity-60 italic ${msgTarget === u.id ? 'text-white' : 'text-slate-400'}`}>Direct Node Encryption</p>
                          </button>
                        ))}
                     </div>
                  </div>
                  
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3.5rem] shadow-sm flex flex-col overflow-hidden">
                    <div className="p-12 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Encrypted Data Stream</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mt-2">
                          Status: Optimized &middot; Recipient: {msgTarget === 'cluster' ? 'Broadcast' : `@${users.find(u=>u.id===msgTarget)?.username}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 p-12 overflow-y-auto space-y-10 custom-scrollbar">
                      {filteredMsgs.map(m => (
                        <div key={m.id} className={`flex ${m.fromId === session.userId ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                          <div className={`max-w-[80%] p-8 rounded-[2.5rem] shadow-sm ${m.fromId === session.userId ? 'bg-slate-900 text-white rounded-tr-none shadow-slate-900/10' : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none'}`}>
                            <div className="flex items-center gap-4 mb-4 opacity-60">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">@{users.find(u=>u.id===m.fromId)?.username || 'Node'}</p>
                              <p className="text-[9px] font-medium ml-auto tracking-widest">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <p className="text-lg font-medium leading-relaxed tracking-tight">{m.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-5">
                      <input type="text" placeholder="Type secure transmission..." value={msgInput} onChange={e=>setMsgInput(e.target.value)} className={INPUT_STYLE} onKeyDown={e=>e.key==='Enter' && (async ()=>{ if(!msgInput.trim()) return; await storageService.sendMessage(session, msgInput, msgTarget); setMsgInput(''); sync(); })()} />
                      <button onClick={async ()=>{ if(!msgInput.trim()) return; await storageService.sendMessage(session, msgInput, msgTarget); setMsgInput(''); sync(); }} className="px-12 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:bg-black shadow-xl active:scale-[0.98]">Send</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'REQUESTS' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4">
                    {session.role === UserRole.CHILD ? (
                      <div className="bg-white border border-slate-200 rounded-[3rem] p-12 space-y-8 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] italic">Request Capital</h3>
                        <div className="space-y-5">
                          <input type="number" placeholder="Sum (₹)" value={reqForm.amt} onChange={e=>setReqForm({...reqForm, amt: e.target.value})} className={INPUT_STYLE} />
                          <input type="text" placeholder="Justification" value={reqForm.reason} onChange={e=>setReqForm({...reqForm, reason: e.target.value})} className={INPUT_STYLE} />
                          <button onClick={async () => {
                            const a = parseFloat(reqForm.amt); if(!a || !reqForm.reason) return;
                            await storageService.createRequest(session, a, reqForm.reason);
                            setReqForm({amt:'', reason:''}); sync(); setToast({msg: 'Allocation Request Dispatched', type:'success'});
                          }} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-[0.98]">Dispatch Request</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900 text-white rounded-[3rem] p-12 space-y-6 shadow-2xl border border-white/5 group">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Governance Review Node</p>
                        <p className="text-base leading-relaxed italic text-slate-400 font-medium">Audit pending capital requests from sub-nodes. Approved requests execute an immediate cross-node ledger credit with priority status.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3.5rem] p-12 shadow-sm min-h-[600px]">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 mb-12 italic">Capital Allocation Stack</h3>
                     <div className="space-y-8">
                       {reqs.filter(r => session.role === UserRole.PARENT || r.childId === session.userId).map(req => (
                         <div key={req.id} className="p-10 border border-slate-100 rounded-[2.5rem] bg-slate-50 flex items-center justify-between group hover:border-slate-900 transition-all duration-500">
                           <div className="space-y-4">
                             <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Node @{users.find(u=>u.id===req.childId)?.username} Request</p>
                             <h4 className="text-4xl font-black tabular-nums tracking-tighter text-slate-900">{fmt(req.amount)}</h4>
                             <p className="text-base text-slate-600 font-medium leading-relaxed italic">"{req.reason}"</p>
                           </div>
                           <div className="flex gap-4">
                             {req.status === RequestStatus.PENDING && session.role === UserRole.HOST ? (
                               <>
                                 <button onClick={async () => {
                                   await storageService.updateRequestStatus(session, req.id, RequestStatus.APPROVED);
                                   await storageService.saveTransaction(session, {id:`tx_appr_${Date.now()}`, userId: req.childId, amount: req.amount, type: TransactionType.CREDIT, category: TransactionCategory.GIFT, description: `Funding Ratified: ${req.reason}`, timestamp: Date.now()});
                                   sync(); setToast({msg: 'Capital Ratified', type:'success'});
                                 }} className="bg-emerald-600 text-white px-9 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 shadow-xl active:scale-[0.98] transition-all">Approve</button>
                                 <button onClick={async () => {
                                   await storageService.updateRequestStatus(session, req.id, RequestStatus.REJECTED);
                                   sync(); setToast({msg: 'Allocation Vetoed', type:'info'});
                                 }} className="bg-rose-600 text-white px-9 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 shadow-xl active:scale-[0.98] transition-all">Veto</button>
                               </>
                             ) : (
                               <div className={`px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border shadow-sm ${req.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : req.status === RequestStatus.REJECTED ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                 {req.status}
                               </div>
                             )}
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Focus Node (Om) with Glowing Orange Aesthetic and Enhanced Interaction */}
      <div className="fixed bottom-12 right-12 z-[200] group">
        <button 
          onClick={toggleMusic} 
          className={`w-28 h-28 rounded-[3.5rem] flex items-center justify-center text-7xl transition-all duration-700 border-4 relative 
            ${isMusicPlaying 
              ? 'bg-orange-500 text-white border-white glow-orange scale-110' 
              : 'bg-white text-orange-500 border-orange-100 hover:scale-110 active:scale-95 hover:border-orange-500 hover:bg-orange-50 shadow-2xl'}`}
          title="Focus Engine Synchronization (Om)"
        >
          <span className={`${isMusicPlaying ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'}`}>ॐ</span>
        </button>
        {isMusicPlaying && (
          <div className="absolute -top-16 right-0 bg-slate-900 text-orange-500 px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl animate-in slide-in-from-bottom-4 duration-500 whitespace-nowrap border border-orange-500/20 ring-4 ring-orange-500/10">
            Signal: Synchronized
          </div>
        )}
      </div>
    </div>
  );
};

export default App;