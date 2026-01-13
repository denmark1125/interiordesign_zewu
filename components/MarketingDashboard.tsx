
import React, { useState, useMemo, useEffect } from 'react';
import { LineMetric, User, LiffVisit } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { MessageCircle, TrendingUp, Users, Plus, Trash2, Calendar, Save, ArrowUpRight, ArrowDownRight, Share2, Filter, ExternalLink, Copy, Check, BarChart3, Globe, Zap, MousePointer2, Info, Settings, ShieldCheck, HelpCircle, ChevronRight, UserPlus, X } from 'lucide-react';
import { db, lineMetricsCollection, setDoc, doc, deleteDoc, liffVisitsCollection, onSnapshot, query, orderBy, limit } from '../services/firebase';

interface MarketingDashboardProps {
  metrics: LineMetric[];
  currentUser: User;
}

const COLORS = ['#54534d', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ metrics, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'growth' | 'sources' | 'setup'>('growth');
  const [newCount, setNewCount] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [visits, setVisits] = useState<LiffVisit[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  
  // 正式 LIFF ID
  const [liffId, setLiffId] = useState('2008826901-DGGr1P8u'); 
  const [customSrc, setCustomSrc] = useState('');

  useEffect(() => {
    const q = query(liffVisitsCollection, orderBy("timestamp", "desc"), limit(1000));
    const unsub = onSnapshot(q, (snap) => {
      setVisits(snap.docs.map(d => ({ ...d.data(), id: d.id }) as LiffVisit));
    });
    return () => unsub();
  }, []);

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics]);

  const sourceStats = useMemo(() => {
    const stats: Record<string, number> = {};
    visits.forEach(v => {
      const src = v.source || '直接流量/未知';
      stats[src] = (stats[src] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [visits]);

  const handleCopyLink = () => {
    if (!customSrc.trim()) return alert("請先輸入來源名稱或點選模板");
    const link = `https://liff.line.me/${liffId}?src=${encodeURIComponent(customSrc)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMetric = async () => {
    const count = parseInt(newCount);
    if (isNaN(count)) return;
    const id = `metric-${Date.now()}`;
    await setDoc(doc(db, "line_metrics", id), { id, timestamp: Date.now(), date: newDate, followerCount: count, recordedBy: currentUser.name });
    setNewCount(''); setIsAdding(false);
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      {/* 頁頭導覽 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-[#06C755]" />
            LINE 行銷數據中心
          </h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">追蹤 LIFF 來源與好友成長數據</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
           <button onClick={() => setActiveTab('growth')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'growth' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <TrendingUp className="w-4 h-4" /> 好友成長
           </button>
           <button onClick={() => setActiveTab('sources')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'sources' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Globe className="w-4 h-4" /> 來源追蹤分析
           </button>
           <button onClick={() => setActiveTab('setup')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'setup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <HelpCircle className="w-4 h-4 text-blue-500" /> 設定教學
           </button>
        </div>
      </div>

      {activeTab === 'growth' && (
        <div className="space-y-6 animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-3xl font-black text-slate-800">{metrics.length > 0 ? metrics[metrics.length-1].followerCount : 0}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">好友總數 (最新紀錄)</p>
              </div>
              <button onClick={() => setIsAdding(true)} className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all group">
                 <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><Plus className="w-5 h-5 text-slate-400" /></div>
                 <span className="text-xs font-black text-slate-400">錄入今日好友人數</span>
              </button>
           </div>
           
           <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-8 text-sm uppercase tracking-widest">好友成長趨勢圖</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sortedMetrics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="followerCount" name="好友數" stroke="#06C755" strokeWidth={4} fill="#06C75510" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="space-y-6 animate-fade-in">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 連結生成器：修復輸入問題 */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col space-y-6">
                 <div>
                    <h3 className="font-black text-slate-800 text-sm mb-1">推廣連結生成器</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">產出帶有追蹤標籤的 LINE 網址</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">LIFF ID (目前連動中)</label>
                       <input 
                         value={liffId} 
                         onChange={e => setLiffId(e.target.value)} 
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono outline-none focus:ring-1 focus:ring-slate-300 transition-all text-slate-600" 
                         placeholder="200xxxxxxx-XXXXXXXX"
                       />
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">來源名稱標籤 (可自由輸入)</label>
                       <div className="relative">
                          <input 
                            value={customSrc} 
                            onChange={e => setCustomSrc(e.target.value)} 
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 pr-10 text-xs font-bold outline-none focus:border-slate-400 transition-all" 
                            placeholder="例如: 臉書廣告" 
                          />
                          {customSrc && (
                            <button onClick={() => setCustomSrc('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                               <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-50">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-3 block">快速模板 (點選後會自動填入上方)</p>
                    <div className="grid grid-cols-2 gap-2">
                       {['官方網站', 'Facebook', 'Instagram', '線下QR'].map(label => (
                         <button 
                            key={label} 
                            onClick={() => setCustomSrc(label)} 
                            className={`flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-[11px] font-black transition-all group ${customSrc === label ? 'ring-2 ring-slate-800 bg-white text-slate-800' : 'text-slate-600'}`}
                         >
                            {label}
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* 預覽與複製按鈕 */}
                 <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 overflow-hidden">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">網址預覽</p>
                       <p className="text-[10px] font-mono text-slate-500 break-all leading-tight">
                         https://liff.line.me/{liffId}?src={customSrc || '...'}
                       </p>
                    </div>
                    <button 
                       onClick={handleCopyLink} 
                       className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                    >
                       {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                       {copied ? '連結已複製！' : '複製正式追蹤連結'}
                    </button>
                 </div>
              </div>

              {/* 來源佔比圖表 */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
                 <div className="flex justify-between items-start mb-6">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                       <Filter className="w-4 h-4 text-amber-500" /> 渠道點擊分佈
                    </h3>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full">
                       <MousePointer2 className="w-3 h-3 text-slate-400" />
                       <span className="text-[10px] font-black text-slate-500 uppercase">{visits.length} 累積點擊</span>
                    </div>
                 </div>
                 
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-[250px]">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                             <Pie data={sourceStats} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                                {sourceStats.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                             </Pie>
                             <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                          </PieChart>
                       </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                       {sourceStats.map((s, idx) => (
                         <div key={s.name} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                               <span className="text-xs font-black text-slate-700">{s.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400">{s.value} 次</span>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'setup' && (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
           <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl space-y-8">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-emerald-50 rounded-2xl"><ShieldCheck className="w-8 h-8 text-emerald-600" /></div>
                 <div>
                    <h3 className="text-xl font-black text-slate-800">LINE 連動已完成</h3>
                    <p className="text-sm text-slate-400 font-bold">目前的 LIFF ID: <span className="font-mono text-slate-800">{liffId}</span></p>
                 </div>
              </div>
              {/* ... 教學步驟 ... */}
              <div className="grid grid-cols-1 gap-4">
                 <div className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-black flex-shrink-0">1</div>
                    <div>
                       <h4 className="font-black text-slate-800 mb-1">檢查 Endpoint URL</h4>
                       <p className="text-xs text-slate-500 leading-relaxed font-bold">請確保 LINE 後台的 Endpoint URL 填寫的是本站網址。</p>
                    </div>
                 </div>
                 <div className="flex gap-6 p-6 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-black flex-shrink-0 z-10">2</div>
                    <div className="z-10">
                       <h4 className="font-black mb-1">Add friend option：Aggressive</h4>
                       <p className="text-xs text-blue-100 leading-relaxed font-bold mb-4">請在 LINE Developers 後台確認此選項已開啟，這能讓點擊連結的客戶自動跳出加好友視窗。</p>
                    </div>
                    <Zap className="absolute bottom-0 right-0 w-32 h-32 text-white/5 -mb-6 -mr-6" />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;
