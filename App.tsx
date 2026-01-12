import React, { useState, useEffect, useCallback, useMemo, useRef, memo, useTransition } from 'react';
import { 
  User, UserRole, Transaction, TransactionType, Session, 
  TransactionCategory, MoneyRequest, RequestStatus, FamilyMessage
} from './types';
import { storageService } from './services/storageService';
import { GoogleGenAI } from "@google/genai";
import { WarningIcon, InfoIcon, ClockIcon } from './constants';
import { Onboarding } from './components/Onboarding';

const BRAND_NAME = "ZenLedger - by JD";
const SECURITY_TAG = "End-to-End Governance Node • Institutional Grade";
// Using local mantra file for playback
const MANTRA_URL = "/Gayatri Mantra - Om Bhur Bhuva Swaha.mp3";

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { 
  style: 'currency', 
  currency: 'INR',
  minimumFractionDigits: 2 
}).format(n);

const Toast = memo(({ message, type, onClose, darkMode }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void; darkMode: boolean }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  const styles = {
    success: darkMode ? 'bg-orange-500 border-orange-400 shadow-orange-500/20' : 'bg-slate-900 border-slate-700 shadow-slate-900/10',
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

const GenuineFiscalInsights = memo(({ transactions, balance, darkMode }: { transactions: any[]; balance: number; darkMode: boolean }) => {
  const insights = useMemo(() => {
    if (!transactions.length) return null;

    // Calculate genuine metrics
    const debits = transactions.filter(t => t.type === TransactionType.DEBIT);
    const totalDebits = debits.reduce((sum: number, t) => sum + t.amount, 0);

    // Burn Rate: average daily outflow
    const timestamps = transactions.map(t => t.timestamp);
    const firstTx = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const daysSinceStart = Math.max(1, (Date.now() - firstTx) / (1000 * 60 * 60 * 24));
    const burnRate = totalDebits / daysSinceStart;

    // Liquidity Index: days of liquidity
    const liquidityIndex: number = balance > 0 && burnRate > 0 ? balance / burnRate : 0;

    // Category Distribution
    const categoryTotals = debits.reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    // Time-Series: balance over time
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const timeSeries = sortedTxs.reduce((acc, tx) => {
      const lastBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
      const newBalance = tx.type === TransactionType.CREDIT ? lastBalance + tx.amount : lastBalance - tx.amount;
      acc.push({
        timestamp: tx.timestamp,
        balance: newBalance,
        date: new Date(tx.timestamp).toLocaleDateString()
      });
      return acc;
    }, [] as { timestamp: number; balance: number; date: string }[]);

    // Statistical metrics
    const amounts = transactions.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const median = sortedAmounts.length % 2 === 0
      ? (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2
      : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
    const variance = amounts.reduce((acc, amt) => acc + Math.pow(amt - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    return {
      burnRate,
      liquidityIndex,
      categoryTotals,
      timeSeries,
      stats: { mean, median, stdDev, transactionCount: transactions.length }
    };
  }, [transactions, balance]);

  if (!insights) return null;

  const { burnRate, liquidityIndex, categoryTotals, timeSeries, stats } = insights;

  // SVG Category Distribution Pie Chart
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'];
  const totalSpending = Object.values(categoryTotals).reduce((a: number, b: number) => a + b, 0);
  let cumulativeAngle = 0;

  const pieSlices = Object.entries(categoryTotals).map(([category, amount], index) => {
    const percentage = (amount / totalSpending) * 100;
    const angle = (amount / totalSpending) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;

    const x1 = 50 + 35 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 35 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 35 * Math.cos(((startAngle + angle) * Math.PI) / 180);
    const y2 = 50 + 35 * Math.sin(((startAngle + angle) * Math.PI) / 180);

    const largeArcFlag = angle > 180 ? 1 : 0;

    return {
      path: `M 50 50 L ${x1} ${y1} A 35 35 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
      color: colors[index % colors.length],
      category,
      amount,
      percentage
    };
  });

  // SVG Time-Series Line Chart
  const maxBalance = Math.max(...timeSeries.map(p => p.balance));
  const minBalance = Math.min(...timeSeries.map(p => p.balance));
  const range = maxBalance - minBalance || 1;

  const points = timeSeries.map((point, index) => {
    const x = (index / (timeSeries.length - 1)) * 80 + 10; // 10% margin on sides
    const y = 90 - ((point.balance - minBalance) / range) * 70; // 10% margin top/bottom
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={`${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[2.5rem] p-10 relative overflow-hidden group shadow-sm`}>
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
           <div className={`w-10 h-10 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'} rounded-xl flex items-center justify-center text-sm shadow-inner`}>📊</div>
           <div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-400">Genuine Analytics Engine</p>
              <h3 className={`text-lg font-black tracking-tight italic ${darkMode ? 'text-white' : 'text-slate-900'}`}>Fiscal Insights</h3>
           </div>
        </div>

        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-2`}>Burn Rate</p>
              <p className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{fmt(burnRate)}/day</p>
            </div>
            <div className="text-center">
              <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-2`}>Liquidity Index</p>
              <p className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{liquidityIndex.toFixed(1)} days</p>
            </div>
          </div>

          {/* Category Distribution */}
          <div>
            <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-4`}>Spending Distribution</p>
            <div className="flex items-center gap-6">
              <svg width="120" height="120" viewBox="0 0 100 100" className="flex-shrink-0">
                {pieSlices.map((slice, index) => (
                  <path key={index} d={slice.path} fill={slice.color} />
                ))}
              </svg>
              <div className="space-y-2 flex-1">
                {pieSlices.map((slice, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                      <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{slice.category}</span>
                    </div>
                    <span className={`font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{slice.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time-Series Chart */}
          <div>
            <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-4`}>Balance Timeline</p>
            <svg width="100%" height="120" viewBox="0 0 100 100" className="border border-slate-200 rounded-lg">
              <polyline
                fill="none"
                stroke={darkMode ? '#f59e0b' : '#374151'}
                strokeWidth="2"
                points={points}
              />
              <line x1="10" y1="90" x2="90" y2="90" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="10" y1="20" x2="10" y2="90" stroke="#e5e7eb" strokeWidth="1" />
            </svg>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'}`}>Mean</p>
              <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{fmt(stats.mean)}</p>
            </div>
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'}`}>Median</p>
              <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{fmt(stats.median)}</p>
            </div>
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'}`}>Volatility</p>
              <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{fmt(stats.stdDev)}</p>
            </div>
          </div>
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
  const [darkMode, setDarkMode] = useState(false);

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
        storageService.getUsers(),
        storageService.getTransactions(),
        storageService.getRequests(),
        storageService.getMessages()
      ]);
      setUsers(u.filter(user => user.familyId === session.familyId)); 
      setTxs(t); 
      setReqs(r); 
      setMsgs(m.filter(msg => msg.familyId === session.familyId));
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
        : await storageService.signupCluster(authForm.fid, authForm.handle, authForm.pass);
      
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
        setToast({ msg: "Asset Source Error", type: 'error' });
      };
    }
    
    if (isMusicPlaying) { 
      audioRef.current.pause(); 
      setIsMusicPlaying(false); 
    } else { 
      audioRef.current.play()
        .then(() => setIsMusicPlaying(true))
        .catch((err) => {
          console.error("Playback error", err);
          setToast({ msg: "Browser block: click again", type: 'info' });
        }); 
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

  if (loading) return <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex flex-col items-center justify-center p-12`}><div className={`w-12 h-12 ${darkMode ? 'bg-orange-500' : 'bg-slate-900'} rounded-2xl animate-pulse shadow-xl`} /><p className={`mt-8 text-[10px] font-black uppercase tracking-[0.6em] ${darkMode ? 'text-orange-400' : 'text-slate-400'}`}>Initializing JD Secure Infrastructure</p></div>;

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-[#fafafa]'} relative overflow-x-hidden font-inter selection:bg-slate-900 selection:text-white`}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} darkMode={darkMode} />}
      {showOnboarding && session && <Onboarding role={session.role} onDismiss={() => { storageService.setOnboardingStatus(session.userId); setShowOnboarding(false); }} />}

      {!session ? (
        <div className="min-h-screen flex items-center justify-center p-8 animate-in fade-in duration-1000 relative">
          <div className="absolute top-8 right-8">
            <button onClick={() => setDarkMode(!darkMode)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'} transition-all`}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="max-w-md w-full space-y-12">
            <div className="text-center">
              <h1 className={`text-6xl font-black italic tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'} mb-4`}>{BRAND_NAME}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] leading-relaxed">Family Financial Governance</p>
            </div>
            <div className={`${darkMode ? 'bg-slate-800 border-slate-700 ring-slate-600' : 'bg-white border-slate-200 ring-slate-100'} border p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden ring-1`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${darkMode ? 'bg-slate-100' : 'bg-slate-900'}`} />
              <div className={`flex ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl p-1.5 mb-10`}>
                <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'LOGIN' ? (darkMode ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Authorize</button>
                <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'SIGNUP' ? (darkMode ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Provision</button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <input type="text" placeholder="Cluster ID" value={authForm.fid} onChange={e=>setAuthForm({...authForm, fid: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : ''}`} />
                <input type="text" placeholder="Identity Handle" value={authForm.handle} onChange={e=>setAuthForm({...authForm, handle: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : ''}`} />
                <input type="password" placeholder="Passphrase" value={authForm.pass} onChange={e=>setAuthForm({...authForm, pass: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : ''}`} />
                <button disabled={isPending} className={`w-full ${darkMode ? 'bg-slate-100 text-slate-900 hover:bg-white' : 'bg-slate-900 text-white hover:bg-black'} py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all`}>
                  {isPending ? 'Verifying Node...' : (authMode === 'LOGIN' ? 'Access Cluster' : 'Initialize Cluster')}
                </button>
              </form>
              <p className="mt-10 text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest italic break-words">{SECURITY_TAG}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-700">
          <header className={`${darkMode ? 'bg-slate-900/80 backdrop-blur-xl border-slate-700' : 'bg-white/80 backdrop-blur-xl border-slate-100'} border-b sticky top-0 z-40 px-10 py-6 flex items-center justify-between`}>
            <div className="flex items-center gap-5 group">
              <div className={`w-10 h-10 ${darkMode ? 'bg-slate-100' : 'bg-slate-900'} rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform`}>
                <div className={`w-2.5 h-2.5 ${darkMode ? 'bg-slate-900' : 'bg-white'} rounded-full animate-pulse`} />
              </div>
              <div>
                <h1 className={`text-xl font-black tracking-tighter italic leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{BRAND_NAME}</h1>
                <p className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]' : 'text-slate-400'} mt-2 flex items-center gap-2 break-words`}>
                   <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> @{users.find(u=>u.id===session.userId)?.username} &middot; {session.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setDarkMode(!darkMode)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'} transition-all`}>
                {darkMode ? '🔆' : '🌙'}
              </button>
              <button onClick={handleLogout} className={`px-7 py-3 ${darkMode ? 'bg-slate-700 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600'} rounded-xl text-[10px] font-black uppercase tracking-widest transition-all`}>Disconnect</button>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-10 mt-12 pb-48">
            <div className={`flex justify-center ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-2xl p-1.5 border mb-12 shadow-sm max-w-2xl overflow-x-auto no-scrollbar`}>
              {['LEDGER', 'REGISTRY', 'MESSAGES', 'REQUESTS'].map((t: any) => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all break-words ${activeTab === t ? (darkMode ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/50' : 'bg-slate-900 text-white shadow-xl') : (darkMode ? 'text-orange-300 hover:text-orange-200' : 'text-slate-400 hover:text-slate-600')}`}>
                  {t === 'REGISTRY' ? (session.role === UserRole.HOST ? 'NODE REGISTRY' : 'PEER REGISTRY') : t}
                </button>
              ))}
            </div>

            <div className="animate-fade-in-up">
              {activeTab === 'LEDGER' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4 space-y-12">
                    <div className="bg-slate-900 rounded-[3.5rem] p-12 text-white shadow-3xl relative overflow-hidden border border-white/5 group">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                      <p className={`text-[10px] font-black uppercase tracking-[0.5em] mb-6 ${darkMode ? 'text-orange-400' : 'text-slate-500'}`}>Liquidity Index</p>
                      <h2 className={`text-6xl font-black tabular-nums mb-10 tracking-tighter leading-none ${darkMode ? 'text-orange-300' : 'text-slate-900'}`}>
                        {fmt(currentBalance)}
                      </h2>
                      <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" /> Asset Verified & Secure
                      </div>
                    </div>

                    {session.role === UserRole.MEMBER && (
                      <div className={`${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3rem] p-12 space-y-8 shadow-sm`}>
                        <h3 className={`text-[10px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.4em] italic break-words`}>Post Debit Entry</h3>
                        <div className="space-y-5">
                          <input type="number" placeholder="Sum (₹)" value={spendForm.amt} onChange={e=>setSpendForm({...spendForm, amt: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                          <input type="text" placeholder="Purpose" value={spendForm.desc} onChange={e=>setSpendForm({...spendForm, desc: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                          <button onClick={async () => {
                            const a = parseFloat(spendForm.amt); if(!a || !spendForm.desc) return setToast({msg: 'Invalid Data', type:'error'});
                            await storageService.saveTransaction(session, {id:`tx_${Date.now()}`, userId: session.userId, amount: a, type: TransactionType.DEBIT, category: spendForm.cat, description: spendForm.desc, timestamp: Date.now()});
                            setSpendForm({amt:'', desc:'', cat: TransactionCategory.OTHER}); sync(); setToast({msg: 'Ledger Record Post Successful', type:'success'});
                          }} className={`w-full py-6 ${darkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]`}>Commit Log</button>
                        </div>
                      </div>
                    )}
                    <GenuineFiscalInsights transactions={txs} balance={currentBalance} darkMode={darkMode} />
                  </div>
                  
                  <div className={`lg:col-span-8 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-[3.5rem] p-12 shadow-sm min-h-[600px] flex flex-col`}>
                    <div className="flex items-center justify-between mb-12">
                      <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]' : 'text-slate-400'} italic break-words`}>Institutional Audit Trail</h3>
                      <button onClick={sync} className={`p-4 ${darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'} rounded-2xl transition-all text-slate-400`}>
                        <ClockIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-5 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                      {txs.filter(t=>t.userId===session.userId).map(tx => (
                        <div key={tx.id} className={`flex items-center justify-between p-8 ${darkMode ? 'bg-slate-700/50 border-slate-600 hover:border-orange-500 hover:bg-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-900 hover:bg-white'} rounded-[2rem] transition-all group animate-in slide-in-from-right-4 duration-500`}>
                          <div className="flex items-center gap-8">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${tx.type === TransactionType.CREDIT ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : (darkMode ? 'bg-slate-600 text-slate-400 border-slate-500' : 'bg-slate-200 text-slate-500 border-slate-300')}`}>
                              {tx.type === TransactionType.CREDIT ? '↓' : '↑'}
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'} leading-tight tracking-tight break-words`}>{tx.description}</p>
                              <p className={`text-[10px] ${darkMode ? 'text-orange-400' : 'text-slate-400'} font-black uppercase tracking-[0.2em] mt-3`}>
                                {new Date(tx.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className={`text-3xl font-black tabular-nums tracking-tighter ${tx.type === TransactionType.CREDIT ? 'text-emerald-600' : (darkMode ? 'text-orange-400' : 'text-slate-900')}`}>
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
              {activeTab === 'REGISTRY' && session.role === UserRole.HOST && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className={`lg:col-span-5 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3rem] p-12 space-y-8 shadow-sm`}>
                    <h3 className={`text-[10px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.4em] italic break-words`}>Provision Operational Node</h3>
                    <div className="space-y-5">
                      <input type="text" placeholder="Identity Handle" value={memberForm.handle} onChange={e=>setMemberForm({...memberForm, handle: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                      <input type="password" placeholder="Passphrase" value={memberForm.pass} onChange={e=>setMemberForm({...memberForm, pass: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                      <button onClick={async () => {
                        const res = await storageService.provisionMember(session, memberForm.handle, memberForm.pass);
                        if (res.success) { sync(); setMemberForm({handle:'', pass:''}); setToast({msg: 'Node Successfully Linked', type: 'success'}); }
                        else setToast({msg: res.error || 'System Fault', type:'error'});
                      }} className={`w-full py-6 ${darkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]`}>Initialize Node</button>
                    </div>
                  </div>

                  <div className={`lg:col-span-7 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3.5rem] p-12 shadow-sm min-h-[600px]`}>
                    <div className="flex items-center justify-between mb-12">
                      <div>
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} italic break-words`}>Active Governance Registry</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mt-2">Total Nodes: {users.filter(u=>u.role===UserRole.MEMBER).length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-[0.2em]">Total Cluster Liquidity</p>
                        <p className={`text-2xl font-black tracking-tighter ${darkMode ? 'text-orange-400' : 'text-slate-900'}`}>
                          {fmt(users.filter(u=>u.role===UserRole.MEMBER).reduce((total, member) => {
                            const mBal = txs.filter(t=>t.userId===member.id).reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
                            return total + mBal;
                          }, 0))}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-8">
                      {users.filter(u=>u.role===UserRole.MEMBER).map(member => {
                        const memberTxs = txs.filter(t=>t.userId===member.id);
                        const mBal = memberTxs.reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
                        const totalCredits = memberTxs.filter(t=>t.type===TransactionType.CREDIT).reduce((sum, t) => sum + t.amount, 0);
                        const totalDebits = memberTxs.filter(t=>t.type===TransactionType.DEBIT).reduce((sum, t) => sum + t.amount, 0);
                        const lastActivity = memberTxs.length > 0 ? Math.max(...memberTxs.map(t=>t.timestamp)) : null;
                        const daysSinceJoin = Math.floor((Date.now() - (member.createdAt || Date.now())) / (1000 * 60 * 60 * 24));

                        return (
                          <div key={member.id} className={`p-8 ${darkMode ? 'border-slate-600 bg-slate-700 hover:border-orange-500' : 'border-slate-100 bg-slate-50 hover:border-slate-900'} rounded-[2.5rem] space-y-6 group transition-all duration-500`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-4 mb-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-lg ${darkMode ? 'bg-slate-600 text-orange-400' : 'bg-slate-200 text-slate-600'}`}>
                                    👤
                                  </div>
                                  <div>
                                    <h4 className={`text-2xl font-black italic ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tighter break-words`}>@{member.username}</h4>
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">
                                      Node ID: {member.id.slice(-8)} &middot; Active {daysSinceJoin} days
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                  <div className="text-center">
                                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-1`}>Current Balance</p>
                                    <p className={`text-xl font-black ${mBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(mBal)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-1`}>Total Credits</p>
                                    <p className={`text-xl font-black text-emerald-600`}>{fmt(totalCredits)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-1`}>Total Debits</p>
                                    <p className={`text-xl font-black text-rose-600`}>{fmt(totalDebits)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Status: Active</span>
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                                      {memberTxs.length} transactions
                                    </span>
                                  </div>
                                  {lastActivity && (
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                                      Last: {new Date(lastActivity).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className={`${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'} p-6 rounded-[2rem] shadow-sm`}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <p className={`text-[9px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.3em]`}>Inject Operational Capital</p>
                                  <input type="number" placeholder="Value (₹)" className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} value={provisionForm.memberId === member.id ? provisionForm.amt : ''} onChange={e=>setProvisionForm({memberId: member.id, amt: e.target.value, desc: provisionForm.desc})} />
                                  <button onClick={async () => {
                                    const a = parseFloat(provisionForm.amt); if(!a || provisionForm.memberId !== member.id) return;
                                    await storageService.saveTransaction(session, {id:`tx_prov_${Date.now()}`, userId: member.id, amount: a, type: TransactionType.CREDIT, category: TransactionCategory.GIFT, description: provisionForm.desc, timestamp: Date.now()});
                                    sync(); setProvisionForm({...provisionForm, amt:''}); setToast({msg: 'Capital Injection Successful', type:'success'});
                                  }} className={`w-full py-4 ${darkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all`}>Credit Node</button>
                                </div>
                                <div className="space-y-3">
                                  <p className={`text-[9px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.3em]`}>Node Analytics</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setToast({ msg: `Viewing ${memberTxs.length} transactions for @${member.username}`, type: 'info' })}
                                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-lg active:scale-[0.98] transition-all"
                                    >
                                      View Activity
                                    </button>
                                    <button
                                      onClick={() => setToast({ msg: `Messaging @${member.username} - Feature coming soon`, type: 'info' })}
                                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 shadow-lg active:scale-[0.98] transition-all"
                                    >
                                      Message
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {users.filter(u=>u.role===UserRole.MEMBER).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-300 opacity-40 italic">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-6">👥</div>
                          <p className="text-[12px] font-black uppercase tracking-[0.6em] mb-2">No Member Nodes</p>
                          <p className="text-[10px] font-medium text-center">Provision your first operational node to begin family governance</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'MESSAGES' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-[750px]">
                  <div className={`lg:col-span-5 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3rem] p-10 shadow-sm overflow-y-auto`}>
                    <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} mb-10 italic break-words`}>Secure Transmissions</h3>
                     <div className="space-y-4">
                        <button onClick={() => setMsgTarget('cluster')} className={`w-full p-8 rounded-[2rem] text-left border transition-all duration-500 ${msgTarget === 'cluster' ? (darkMode ? 'bg-orange-500 text-white border-orange-500 shadow-2xl shadow-orange-500/50' : 'bg-slate-900 text-white border-slate-900 shadow-2xl') : (darkMode ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-orange-500' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300')}`}>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 break-words">Cluster Broadcast</p>
                          <p className={`text-[9px] uppercase tracking-widest opacity-60 italic ${msgTarget === 'cluster' ? (darkMode ? 'text-orange-200' : 'text-white') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Global Encryption</p>
                        </button>
                        {users.filter(u => u.id !== session.userId).map(u => (
                          <button key={u.id} onClick={() => setMsgTarget(u.id)} className={`w-full p-8 rounded-[2rem] text-left border transition-all duration-500 ${msgTarget === u.id ? (darkMode ? 'bg-orange-500 text-white border-orange-500 shadow-2xl shadow-orange-500/50' : 'bg-slate-900 text-white border-slate-900 shadow-2xl') : (darkMode ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-orange-500' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300')}`}>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 break-words">Node: @{u.username}</p>
                            <p className={`text-[9px] uppercase tracking-widest opacity-60 italic ${msgTarget === u.id ? (darkMode ? 'text-orange-200' : 'text-white') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Direct Node Encryption</p>
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className={`lg:col-span-7 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3.5rem] shadow-sm flex flex-col overflow-hidden`}>
                    <div className={`p-12 ${darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-100 bg-slate-50'} border-b flex items-center justify-between`}>
                      <div>
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} italic break-words`}>Encrypted Data Stream</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mt-2 break-words">
                          Status: Optimized &middot; Recipient: {msgTarget === 'cluster' ? 'Broadcast' : `@${users.find(u=>u.id===msgTarget)?.username}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 p-12 overflow-y-auto space-y-10 custom-scrollbar">
                      {filteredMsgs.map(m => (
                        <div key={m.id} className={`flex ${m.fromId === session.userId ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                          <div className={`max-w-[80%] p-8 rounded-[2.5rem] shadow-sm ${m.fromId === session.userId ? (darkMode ? 'bg-orange-500 text-white rounded-tr-none shadow-orange-500/20' : 'bg-slate-900 text-white rounded-tr-none shadow-slate-900/10') : (darkMode ? 'bg-slate-700 border-slate-600 text-white rounded-tl-none' : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none')}`}>
                            <div className="flex items-center gap-4 mb-4 opacity-60">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">@{users.find(u=>u.id===m.fromId)?.username || 'Node'}</p>
                              <p className="text-[9px] font-medium ml-auto tracking-widest">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <p className="text-lg font-medium leading-relaxed tracking-tight break-words">{m.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={`p-10 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'} border-t flex gap-5`}>
                      <input type="text" placeholder="Type secure transmission..." value={msgInput} onChange={e=>setMsgInput(e.target.value)} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} onKeyDown={e=>e.key==='Enter' && (async ()=>{ if(!msgInput.trim()) return; await storageService.sendMessage(session, msgInput, msgTarget); setMsgInput(''); sync(); })()} />
                      <button onClick={async ()=>{ if(!msgInput.trim()) return; await storageService.sendMessage(session, msgInput, msgTarget); setMsgInput(''); sync(); }} className={`px-12 ${darkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl active:scale-[0.98]`}>Send</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'REQUESTS' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-5">
                    {session.role === UserRole.MEMBER ? (
                      <div className={`${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3rem] p-12 space-y-8 shadow-sm`}>
                        <h3 className={`text-[10px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.4em] italic break-words`}>Request Capital</h3>
                        <div className="space-y-5">
                          <input type="number" placeholder="Sum (₹)" value={reqForm.amt} onChange={e=>setReqForm({...reqForm, amt: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                          <input type="text" placeholder="Justification" value={reqForm.reason} onChange={e=>setReqForm({...reqForm, reason: e.target.value})} className={`${INPUT_STYLE} ${darkMode ? 'bg-slate-700 border-slate-500 text-white placeholder:text-slate-400' : ''}`} />
                          <button onClick={async () => {
                            const a = parseFloat(reqForm.amt); if(!a || !reqForm.reason) return;
                            await storageService.createRequest(session, a, reqForm.reason);
                            setReqForm({amt:'', reason:''}); sync(); setToast({msg: 'Allocation Request Dispatched', type:'success'});
                          }} className={`w-full py-6 ${darkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-900 text-white hover:bg-black'} rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]`}>Dispatch Request</button>
                        </div>
                      </div>
                    ) : (
                      <div className={`${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-900 border-white/5'} text-white rounded-[3rem] p-12 space-y-6 shadow-2xl group`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400' : 'text-slate-500'}`}>Governance Review Node</p>
                        <p className={`text-base leading-relaxed italic ${darkMode ? 'text-slate-300' : 'text-slate-400'} font-medium`}>Audit pending capital requests from sub-nodes. Approved requests execute an immediate cross-node ledger credit with priority status.</p>
                      </div>
                    )}
                  </div>

                  <div className={`lg:col-span-7 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-[3.5rem] p-12 shadow-sm min-h-[600px]`}>
                    <div className="flex items-center justify-between mb-12">
                      <div>
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${darkMode ? 'text-orange-400' : 'text-slate-400'} italic break-words`}>Capital Allocation Stack</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mt-2">
                          {session.role === UserRole.HOST ? `Total Requests: ${reqs.length}` : `Your Requests: ${reqs.filter(r => r.childId === session.userId).length}`}
                        </p>
                      </div>
                      {session.role === UserRole.MEMBER && (
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-[0.2em]">Available Balance</p>
                          <p className={`text-2xl font-black tracking-tighter ${darkMode ? 'text-orange-400' : 'text-slate-900'}`}>{fmt(currentBalance)}</p>
                        </div>
                      )}
                    </div>
                     <div className="space-y-8">
                       {reqs.filter(r => session.role === UserRole.HOST || r.childId === session.userId).map(req => (
                         <div key={req.id} className={`p-10 ${darkMode ? 'border-slate-600 bg-slate-700 hover:border-orange-500' : 'border-slate-100 bg-slate-50 hover:border-slate-900'} rounded-[2.5rem] flex items-center justify-between group transition-all duration-500`}>
                           <div className="space-y-4">
                             <div className="flex items-center gap-4 mb-2">
                               <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg ${req.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-600' : req.status === RequestStatus.REJECTED ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
                                 {req.status === RequestStatus.APPROVED ? '✓' : req.status === RequestStatus.REJECTED ? '✗' : '⏳'}
                               </div>
                               <div>
                                 <p className={`text-[9px] font-black uppercase ${darkMode ? 'text-orange-400' : 'text-slate-400'} tracking-[0.2em]`}>
                                   {session.role === UserRole.HOST ? `Node @${users.find(u=>u.id===req.childId)?.username} Request` : 'Your Request'}
                                 </p>
                                 <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                                   {new Date(req.timestamp).toLocaleDateString()}
                                 </p>
                               </div>
                             </div>
                             <h4 className={`text-4xl font-black tabular-nums tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>{fmt(req.amount)}</h4>
                             <p className={`text-base ${darkMode ? 'text-slate-300' : 'text-slate-600'} font-medium leading-relaxed italic break-words`}>"{req.reason}"</p>
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
                       {reqs.filter(r => session.role === UserRole.HOST || r.childId === session.userId).length === 0 && (
                         <div className="flex flex-col items-center justify-center py-48 text-slate-300 opacity-40 italic">
                           <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-6">
                             {session.role === UserRole.HOST ? '📋' : '💰'}
                           </div>
                           <p className="text-[12px] font-black uppercase tracking-[0.6em] mb-2">
                             {session.role === UserRole.HOST ? 'No Pending Requests' : 'No Capital Requests'}
                           </p>
                           <p className="text-[10px] font-medium text-center max-w-md">
                             {session.role === UserRole.HOST
                               ? 'Member nodes will submit capital requests here for your review and approval.'
                               : 'Submit a capital request using the form to get funds from your host. Make sure to provide a clear justification.'
                             }
                           </p>
                         </div>
                       )}
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
          <div className="absolute -top-16 right-0 bg-slate-900 text-orange-500 px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl animate-in slide-in-from-bottom-4 duration-500 border border-orange-500/20 ring-4 ring-orange-500/10">
            Signal: Synchronized
          </div>
        )}
      </div>
    </div>
  );
};

export default App;