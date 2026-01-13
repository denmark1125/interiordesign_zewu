
import React, { useState, useMemo, useEffect } from 'react';
import { LineMetric, User } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageCircle, Globe, Share2, Copy, Check, Users, Activity, ExternalLink } from 'lucide-react';
import { db, lineMetricsCollection, setDoc, doc, onSnapshot, query, orderBy, collection } from '../services/firebase';

interface MarketingDashboardProps {
  metrics: LineMetric[];
  currentUser: User;
}

const LIFF_ID = "2008826901-DGGr1P8u";

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ metrics, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'growth' | 'tracking'>('growth');
  const [userSources, setUserSources] = useState<any[]>([]);
  const [customSrc, setCustomSrc] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeTab === 'tracking') {
      const q = query(collection(db, "user_sources"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        setUserSources(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      });
      return () => unsub();
    }
  }, [activeTab]);

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics]);

  const handleCopyLink = () => {
    if (!customSrc) return;
    const url = `https://liff.line.me/${LIFF_ID}?src=${encodeURIComponent(customSrc)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-[#06C755]" />
            LINE 數據中心
          </h2>
          <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Growth & Tracking Analytics</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
           <button onClick={() => setActiveTab('growth')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'growth' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>好友成長</button>
           <button onClick={() => setActiveTab('tracking')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'tracking' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>管道追蹤</button>
        </div>
      </div>

      {activeTab === 'growth' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
             <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2">
               <Activity className="w-5 h-5 text-emerald-500" /> 好友成長曲線
             </h3>
             <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={sortedMetrics}>
                   <defs>
                     <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#06C755" stopOpacity={0.15}/>
                       <stop offset="95%" stopColor="#06C755" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                   <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                   <Area type="monotone" dataKey="followerCount" stroke="#06C755" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
           {/* 連結產生器 */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-emerald-50 rounded-2xl"><Share2 className="w-6 h-6 text-emerald-600" /></div>
                 <h3 className="font-black text-slate-800">追蹤連結產生器</h3>
              </div>
              <p className="text-xs text-slate-400 font-bold leading-relaxed">
                輸入廣告管道名稱（如 FB-AD、QR-SITE），系統將自動生成專屬追蹤連結。
              </p>
              <div className="space-y-4">
                 <input 
                    type="text" 
                    placeholder="例如: FB廣告" 
                    value={customSrc}
                    onChange={(e) => setCustomSrc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                 />
                 <button 
                    onClick={handleCopyLink}
                    disabled={!customSrc}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                 >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '已複製到剪貼簿' : '產生並複製網址'}
                 </button>
              </div>
              <div className="pt-4 border-t border-slate-50">
                 <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">產生規則</p>
                 <p className="text-[11px] text-slate-500 font-mono mt-2 bg-slate-50 p-2 rounded-lg break-all">
                   https://liff.line.me/{LIFF_ID}?src={customSrc || 'SOURCE'}
                 </p>
              </div>
           </div>

           {/* 來源清單 */}
           <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-widest">
                    <Activity className="w-4 h-4 text-emerald-500" /> 好友管道追蹤紀錄
                 </h3>
                 <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">點擊總數: {userSources.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                 {userSources.map((log) => (
                   <div key={log.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="relative">
                           <img src={log.pictureUrl || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shadow-sm" />
                           <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-100 shadow-sm">
                             <MessageCircle className="w-2.5 h-2.5 text-[#06C755] fill-current" />
                           </div>
                         </div>
                         <div>
                            <p className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                              {log.displayName || log.lineUserId || '未知用戶'}
                            </p>
                            <p className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">LINE UID: {log.userId.substring(0, 15)}...</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="bg-[#06C755]/10 text-[#06C755] px-3 py-1 rounded-full text-[10px] font-black uppercase border border-[#06C755]/20 shadow-sm">{log.source}</span>
                         <p className="text-[9px] text-slate-300 font-bold mt-1.5 flex items-center justify-end gap-1">
                           {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : '追蹤中...'}
                         </p>
                      </div>
                   </div>
                 ))}
                 {userSources.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-black text-slate-300 space-y-2">
                      <Globe className="w-8 h-8" />
                      <p>尚未有流量進入管道</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;
