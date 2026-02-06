
import React, { useState, useMemo, useEffect } from 'react';
import { User, MarketingLink, LineConnection, LineMetric } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ComposedChart } from 'recharts';
import { Copy, Check, Users, Activity, Terminal, Trash2, Link as LinkIcon, Plus, TrendingUp, BarChart3, Clock, ExternalLink, X, Search, ShieldX, ChevronRight, UserCheck, Calendar, Filter } from 'lucide-react';
import { db, onSnapshot, query, orderBy, setDoc, doc, serverTimestamp, deleteDoc, lineConnectionsCollection, marketingLinksCollection, updateDoc } from '../services/firebase';

interface MarketingDashboardProps {
  currentUser: User;
  metrics?: LineMetric[];
}

type TimeRange = 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'CUSTOM' | 'ALL';

const LIFF_BASE_URL = "https://liff.line.me/2008826901-DGGr1P8u";
const BASELINE_FRIENDS = 867;
const BASELINE_DATE_MS = new Date('2025-01-14T00:00:00').getTime();

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ currentUser, metrics }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'links'>('analytics');
  const [timeRange, setTimeRange] = useState<TimeRange>('THIS_WEEK');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [rawConnections, setRawConnections] = useState<LineConnection[]>([]);
  const [marketingLinks, setMarketingLinks] = useState<MarketingLink[]>([]);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [manualBlockedCount, setManualBlockedCount] = useState<number>(0);
  const [selectedTagDetail, setSelectedTagDetail] = useState<string | null>(null);

  // 1. 監聽連線數據 (line_connections)
  useEffect(() => {
    const q = query(lineConnectionsCollection, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRawConnections(snapshot.docs.map(doc => {
        const data = doc.data();
        const uid = (data.userId || data.UserId || "").toString().trim();
        const name = data.displayName || data.lineUserId || "未知用戶";
        const pic = data.pictureUrl || data.linePictureUrl || "";
        const srcTag = data.source || data.src || "直接搜尋/名片";
        const ts = data.timestamp?.seconds ? data.timestamp.seconds * 1000 : data.timestamp;

        return { 
          ...data, 
          id: doc.id,
          UserId: uid,
          lineUserId: name,
          linePictureUrl: pic,
          source: srcTag,
          timestamp: ts
        } as LineConnection;
      }).filter(i => i.UserId && i.UserId.startsWith('U')));
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽連結庫 (marketing_links) - 始終監聽以確保切換分頁時數據已就緒
  useEffect(() => {
    const q = query(marketingLinksCollection, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMarketingLinks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as MarketingLink));
    });
    return () => unsubscribe();
  }, []);

  // 3. 讀取手動封鎖人數配置
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "system_configs", "line_analytics"), (docSnap) => {
      if (docSnap.exists()) {
        setManualBlockedCount(docSnap.data().manualBlockedCount || 0);
      }
    });
    return () => unsubConfig();
  }, []);

  const handleUpdateBlockedCount = async (val: string) => {
    const num = parseInt(val) || 0;
    setManualBlockedCount(num);
    try {
      await setDoc(doc(db, "system_configs", "line_analytics"), { 
        manualBlockedCount: num,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const rangeTimeLimits = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();

    if (timeRange === 'THIS_WEEK') {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      start.setHours(0,0,0,0);
    } else if (timeRange === 'LAST_WEEK') {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6);
      start.setHours(0,0,0,0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end.setHours(23, 59, 59, 999);
    } else if (timeRange === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0,0,0,0);
    } else if (timeRange === 'CUSTOM' && customStart && customEnd) {
      start = new Date(customStart);
      start.setHours(0,0,0,0);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    } else if (timeRange === 'ALL') {
      start = new Date(BASELINE_DATE_MS);
      end = new Date();
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [timeRange, customStart, customEnd]);

  const filteredConnections = useMemo(() => {
    return rawConnections.filter(c => c.timestamp >= rangeTimeLimits.startMs && c.timestamp <= rangeTimeLimits.endMs);
  }, [rawConnections, rangeTimeLimits]);

  const stats = useMemo(() => {
    const connectionsUntilEnd = rawConnections.filter(c => c.timestamp > BASELINE_DATE_MS && c.timestamp <= rangeTimeLimits.endMs).length;
    const currentTotal = BASELINE_FRIENDS + connectionsUntilEnd - manualBlockedCount;
    const rangeGrowth = filteredConnections.length;
    return { currentTotal, rangeGrowth, totalGained: connectionsUntilEnd };
  }, [rawConnections, filteredConnections, rangeTimeLimits, manualBlockedCount]);

  const filteredMarketingLinks = useMemo(() => {
    if (!linkSearchTerm.trim()) return marketingLinks;
    return marketingLinks.filter(l => l.tag.toLowerCase().includes(linkSearchTerm.toLowerCase()));
  }, [marketingLinks, linkSearchTerm]);

  const sourceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredConnections.forEach(i => {
      const tag = i.source || '直接搜尋';
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredConnections]);

  const growthTimeSeries = useMemo(() => {
    const dailyData: Record<string, number> = {};
    filteredConnections.forEach(i => {
      const d = new Date(i.timestamp).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
      dailyData[d] = (dailyData[d] || 0) + 1;
    });
    return Object.keys(dailyData).sort().map(date => ({ date, adds: dailyData[date] }));
  }, [filteredConnections]);

  const handleGenerateLink = async () => {
    if (!customTag.trim()) return;
    setIsGenerating(true);
    const id = `ml-${Date.now()}`;
    const fullUrl = `${LIFF_BASE_URL}?src=${encodeURIComponent(customTag.trim())}`;
    try {
      await setDoc(doc(db, "marketing_links", id), { id, tag: customTag.trim(), fullUrl, createdAt: serverTimestamp() });
      setCustomTag('');
      setActiveTab('links');
    } catch (e) { alert('儲存失敗'); } finally { setIsGenerating(false); }
  };

  const tagColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06C755', '#f43f5e', '#64748b'];

  const getSourceStyle = (source: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('official')) return 'bg-slate-900 text-white border-slate-900 shadow-sm';
    if (s.includes('yahoo')) return 'bg-purple-50 text-purple-600 border-purple-100';
    if (s.includes('economic')) return 'bg-amber-50 text-amber-600 border-amber-100';
    if (s.includes('design100')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (s.includes('threads')) return 'bg-slate-100 text-slate-800 border-slate-200';
    if (s.includes('quiz')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (s.includes('stormcuts')) return 'bg-red-50 text-red-500 border-red-100';
    if (s.includes('ig') || s.includes('zewu_ig')) return 'bg-pink-50 text-pink-500 border-pink-100';
    return 'bg-slate-50 text-slate-400 border-slate-100';
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in font-sans text-left relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-black text-slate-800 tracking-tight">管道追蹤儀表板</h2>
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Single Source Mode</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setActiveTab('analytics')} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>數據分析</button>
           <button onClick={() => setActiveTab('links')} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeTab === 'links' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>連結管理</button>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-4 animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex bg-slate-50 p-1 rounded-xl items-center gap-1 overflow-x-auto">
                      {(['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'] as TimeRange[]).map(r => (
                        <button 
                          key={r} 
                          onClick={() => setTimeRange(r)}
                          className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all whitespace-nowrap ${timeRange === r ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {r === 'THIS_WEEK' ? '本週' : r === 'LAST_WEEK' ? '上週' : r === 'THIS_MONTH' ? '本月' : r === 'CUSTOM' ? '自訂區間' : '全部'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" /> 統計截至 {new Date(rangeTimeLimits.endMs).toLocaleDateString()}
                    </div>
                  </div>

                  {timeRange === 'CUSTOM' && (
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-slide-up">
                       <div className="flex items-center gap-2 w-full">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">從</label>
                          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400 transition-all" />
                       </div>
                       <div className="flex items-center gap-2 w-full">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">至</label>
                          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400 transition-all" />
                       </div>
                       <div className="flex items-center justify-center p-2 bg-slate-800 text-white rounded-lg shadow-sm"><Calendar className="w-4 h-4" /></div>
                    </div>
                  )}
              </div>

              <div className="md:col-span-4 bg-slate-900 p-4 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldX className="w-3.5 h-3.5 text-red-400" /> 手動輸入封鎖人數</label>
                 </div>
                 <input type="number" value={manualBlockedCount} onChange={(e) => handleUpdateBlockedCount(e.target.value)} placeholder="輸入官方後台封鎖數" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black text-white outline-none focus:ring-1 focus:ring-red-500/50 transition-all" />
              </div>
           </div>

           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Users className="w-10 h-10" /></div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">好友總數 ({timeRange === 'ALL' ? '目前' : '截止時區間'})</p>
                 <h4 className="text-2xl font-black text-slate-800">{stats.currentTotal}</h4>
                 <div className="text-[9px] text-emerald-500 font-bold mt-0.5">基準後新增累積 +{stats.totalGained}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">區間內淨增長</p>
                 <h4 className="text-2xl font-black text-blue-500">{stats.rangeGrowth}</h4>
                 <div className="text-[9px] text-slate-300 font-bold mt-0.5">選定日期內</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">校正排除(封鎖)</p>
                 <h4 className="text-2xl font-black text-red-400">{manualBlockedCount}</h4>
                 <div className="text-[9px] text-slate-300 font-bold mt-0.5">總封鎖率約 {stats.totalGained > 0 ? ((manualBlockedCount / (stats.totalGained + manualBlockedCount)) * 100).toFixed(1) : 0}%</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl shadow-sm text-white">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">平均日增長</p>
                 <h4 className="text-2xl font-black text-white">{(stats.rangeGrowth / Math.max(growthTimeSeries.length, 1)).toFixed(1)}</h4>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px]">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> 渠道進站分佈 (點擊穿透)</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {sourceStats.map((item, idx) => (
                      <button key={item.name} onClick={() => setSelectedTagDetail(item.name)} className="w-full group flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-800 hover:text-white transition-all border border-transparent hover:border-slate-700">
                         <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 rounded-full" style={{backgroundColor: tagColors[idx % tagColors.length]}} />
                            <span className="text-[11px] font-black group-hover:text-white">{item.name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-black group-hover:text-white">{item.count}</span>
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-all" />
                         </div>
                      </button>
                    ))}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 self-start flex items-center gap-2"><PieChart className="w-3.5 h-3.5" /> 渠道佔比分析</h3>
                 <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie data={sourceStats} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="count" stroke="none" onClick={(data) => setSelectedTagDetail(data.name)}>
                             {sourceStats.map((entry, index) => <Cell key={`cell-${index}`} fill={tagColors[index % tagColors.length]} className="cursor-pointer" />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 'bold' }} />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                       <span className="text-2xl font-black text-slate-800 block leading-none">{stats.rangeGrowth}</span>
                       <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">區間增長</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> 流量趨勢追蹤</h3>
                 <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <ComposedChart data={growthTimeSeries}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 'bold'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 'bold'}} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          <Area type="monotone" dataKey="adds" name="新增好友" stroke="#10b981" strokeWidth={3} fill="#10b98120" />
                          <Bar dataKey="adds" fill="#10b98110" barSize={12} radius={[3, 3, 0, 0]} />
                       </ComposedChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-slide-up">
           <div className="lg:col-span-1">
              <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white space-y-6 sticky top-4">
                 <div className="flex items-center gap-3"><Terminal className="w-5 h-5 text-emerald-400" /><h3 className="font-black text-white text-sm">新增追蹤連結</h3></div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-left block">快速選擇標籤</label>
                       <div className="grid grid-cols-2 gap-2 text-left">
                          {['Official', 'Yahoo!', 'Economic', 'Design100', 'Threads', 'Quiz', 'Stormcuts', 'Zewu_IG'].map(tag => (
                            <button key={tag} onClick={() => setCustomTag(tag)} className={`p-2 rounded-xl transition-all text-[8px] font-bold truncate ${customTag === tag ? 'bg-emerald-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}>{tag}</button>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-left block">標籤名稱</label>
                       <input type="text" value={customTag} placeholder="例如: GoogleAds" onChange={(e) => setCustomTag(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all" />
                    </div>
                    <button onClick={handleGenerateLink} disabled={!customTag.trim() || isGenerating} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-[11px] flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-20 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 uppercase tracking-widest">
                       {isGenerating ? <Activity className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 存儲新標籤網址
                    </button>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                 <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                       <LinkIcon className="w-5 h-5 text-slate-400" />
                       <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">已存儲追蹤連結庫</h3>
                    </div>
                    <div className="relative w-full md:w-64">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                       <input type="text" value={linkSearchTerm} onChange={(e) => setLinkSearchTerm(e.target.value)} placeholder="搜尋標籤..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-all" />
                    </div>
                 </div>

                 <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="text-[9px] text-slate-400 font-black uppercase tracking-widest bg-white border-b border-slate-50">
                             <th className="px-8 py-5">渠道標籤 (Tag)</th>
                             <th className="px-8 py-5">推廣網址 (LIFF URL)</th>
                             <th className="px-8 py-5 text-right">管理操作</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 font-bold">
                          {filteredMarketingLinks.map((link) => (
                            <tr key={link.id} className="hover:bg-slate-50/50 transition-colors group">
                               <td className="px-8 py-6">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-tight ${getSourceStyle(link.tag)}`}>
                                     {link.tag}
                                  </span>
                               </td>
                               <td className="px-8 py-6">
                                  <div className="flex items-center gap-3 group/url">
                                     <code className="text-[10px] text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg truncate max-w-[280px] font-mono border border-slate-200/50">
                                        {link.fullUrl}
                                     </code>
                                     <button 
                                       onClick={() => {
                                         navigator.clipboard.writeText(link.fullUrl);
                                         setCopiedId(link.id);
                                         setTimeout(() => setCopiedId(null), 2000);
                                       }}
                                       className={`p-2 rounded-lg transition-all flex items-center gap-2 ${copiedId === link.id ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-300 hover:text-emerald-500 border border-slate-100 hover:border-emerald-200 shadow-sm'}`}
                                     >
                                        {copiedId === link.id ? (
                                          <><Check className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase">Copied</span></>
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                     </button>
                                  </div>
                               </td>
                               <td className="px-8 py-6 text-right">
                                  <button onClick={() => { if(confirm('確定要刪除此連結標籤？')) deleteDoc(doc(db, "marketing_links", link.id)) }} className="text-slate-100 group-hover:text-red-400 transition-all p-2 hover:bg-red-50 rounded-lg">
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                               </td>
                            </tr>
                          ))}
                          {filteredMarketingLinks.length === 0 && (
                            <tr>
                               <td colSpan={3} className="px-8 py-24 text-center">
                                  <div className="flex flex-col items-center justify-center opacity-20">
                                     <Terminal className="w-12 h-12 mb-4" />
                                     <p className="text-xs font-black uppercase tracking-widest">目前沒有任何追蹤連結</p>
                                     <p className="text-[10px] mt-1">請利用左側面板生成新的標籤</p>
                                  </div>
                               </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 渠道穿透彈窗 */}
      {selectedTagDetail && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-100 animate-slide-up">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <span className={`w-3 h-3 rounded-full ${getSourceStyle(selectedTagDetail)}`}></span>
                       「{selectedTagDetail}」管道成員明細
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                       此篩選區間下共計 {filteredConnections.filter(c => c.source === selectedTagDetail).length} 位成員
                    </p>
                 </div>
                 <button onClick={() => setSelectedTagDetail(null)} className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200">
                    <X className="w-5 h-5 text-slate-400" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                 <div className="grid grid-cols-1 gap-3">
                    {filteredConnections.filter(c => c.source === selectedTagDetail).map((conn) => (
                      <div key={conn.id + conn.UserId} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                              {conn.linePictureUrl ? <img src={conn.linePictureUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-300">?</div>}
                           </div>
                           <div>
                              <p className="font-black text-slate-800 text-sm flex items-center gap-2">{conn.lineUserId || '未知用戶'}<UserCheck className="w-3 h-3 text-emerald-500" /></p>
                              <p className="text-[9px] text-slate-400 font-mono tracking-tighter uppercase">U-ID: {(conn.UserId || "").substring(0, 16)}...</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-slate-500 font-bold">{new Date(conn.timestamp).toLocaleDateString()}</p>
                           <p className="text-[9px] text-slate-300 font-medium">{new Date(conn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                 <button onClick={() => setSelectedTagDetail(null)} className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all uppercase tracking-widest">關閉詳情</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;
