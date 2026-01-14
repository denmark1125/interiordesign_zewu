
import React, { useState, useMemo, useEffect } from 'react';
import { User, MarketingLink, LineConnection, LineMetric } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ComposedChart } from 'recharts';
import { Copy, Check, Users, Activity, Terminal, Trash2, Link as LinkIcon, Plus, TrendingUp, BarChart3, ShieldX, Zap, Info, Instagram, Facebook, QrCode, Globe, Clock, Search, ExternalLink, Filter, Calendar, ChevronDown } from 'lucide-react';
import { db, onSnapshot, query, orderBy, setDoc, doc, serverTimestamp, deleteDoc, lineConnectionsCollection, marketingLinksCollection, collection } from '../services/firebase';

interface MarketingDashboardProps {
  currentUser: User;
  metrics?: LineMetric[];
}

type TimeRange = 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'CUSTOM' | 'ALL';

const LIFF_BASE_URL = "https://liff.line.me/2008826901-DGGr1P8u";
// 好友基準點校正：867 (2025/01/14)
const BASELINE_FRIENDS = 858;
const BASELINE_DATE_MS = new Date('2025-01-14T00:00:00').getTime();

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ currentUser, metrics }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'links'>('analytics');
  const [timeRange, setTimeRange] = useState<TimeRange>('THIS_WEEK');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [rawConnections, setRawConnections] = useState<LineConnection[]>([]);
  const [userSources, setUserSources] = useState<Record<string, string>>({});
  const [marketingLinks, setMarketingLinks] = useState<MarketingLink[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. 數據監聽
  useEffect(() => {
    const q = query(lineConnectionsCollection, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRawConnections(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data, 
          id: doc.id,
          UserId: data.UserId || data.userId || "",
          timestamp: data.timestamp?.seconds ? data.timestamp.seconds * 1000 : data.timestamp
        } as LineConnection;
      }).filter(i => i.UserId && i.UserId.startsWith('U')));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubSources = onSnapshot(collection(db, "user_sources"), (snap) => {
      const sourceMap: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.userId && data.source) sourceMap[data.userId] = data.source;
      });
      setUserSources(sourceMap);
    });
    return () => unsubSources();
  }, []);

  useEffect(() => {
    if (activeTab === 'links') {
      const q = query(marketingLinksCollection, orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMarketingLinks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as MarketingLink));
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const integratedConnections = useMemo(() => {
    return rawConnections.map(conn => ({
      ...conn,
      source: conn.source || userSources[conn.UserId] || '直接搜尋/名片'
    }));
  }, [rawConnections, userSources]);

  // --- 進階日期篩選邏輯 ---
  const filteredConnections = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();

    if (timeRange === 'THIS_WEEK') {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    } else if (timeRange === 'LAST_WEEK') {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end.setHours(23, 59, 59, 999);
    } else if (timeRange === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'CUSTOM' && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    } else if (timeRange === 'ALL') {
      return integratedConnections;
    }

    const startMs = start.getTime();
    const endMs = end.getTime();

    return integratedConnections.filter(c => c.timestamp >= startMs && c.timestamp <= endMs);
  }, [integratedConnections, timeRange, customStart, customEnd]);

  // --- 具體來源數值統計 ---
  const sourceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredConnections.filter(i => !i.isBlocked).forEach(i => {
      const tag = i.source || '未分類';
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredConnections]);

  const stats = useMemo(() => {
    const newActiveAfterBaseline = integratedConnections.filter(i => i.timestamp > BASELINE_DATE_MS && !i.isBlocked).length;
    const totalBlockedNow = integratedConnections.filter(i => i.isBlocked).length;
    const currentTotal = BASELINE_FRIENDS + newActiveAfterBaseline - totalBlockedNow;

    const rangeGrowth = filteredConnections.filter(i => !i.isBlocked).length;
    const rangeBlocked = filteredConnections.filter(i => i.isBlocked).length;

    return {
      currentTotal,
      rangeGrowth,
      rangeBlocked,
      growth: newActiveAfterBaseline
    };
  }, [integratedConnections, filteredConnections]);

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
    } catch (e) { alert('儲存失敗'); } finally { setIsGenerating(false); }
  };

  const tagColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06C755', '#f43f5e', '#64748b'];

  return (
    <div className="space-y-4 pb-20 animate-fade-in font-sans">
      {/* 頁頭 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-black text-slate-800 tracking-tight">管道追蹤儀表板</h2>
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Attribution Control</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setActiveTab('analytics')} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>數據分析</button>
           <button onClick={() => setActiveTab('links')} className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeTab === 'links' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>連結管理</button>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-4 animate-fade-in">
           {/* 進階日期篩選器 */}
           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex bg-slate-50 p-1 rounded-xl items-center gap-1 w-full md:w-auto">
                 {(['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'] as TimeRange[]).map(r => (
                   <button 
                    key={r} 
                    onClick={() => setTimeRange(r)}
                    className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${timeRange === r ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     {r === 'THIS_WEEK' ? '本週' : r === 'LAST_WEEK' ? '上週' : r === 'THIS_MONTH' ? '本月' : r === 'CUSTOM' ? '自訂' : '全部'}
                   </button>
                 ))}
              </div>
              
              {timeRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 animate-fade-in w-full md:w-auto">
                   <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none" />
                   <span className="text-slate-300">~</span>
                   <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none" />
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold ml-auto uppercase tracking-widest">
                 <Clock className="w-3.5 h-3.5" /> 數據更新: {new Date().toLocaleDateString()}
              </div>
           </div>

           {/* KPI 卡片 */}
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">當前好友總數</p>
                 <h4 className="text-2xl font-black text-slate-800">{stats.currentTotal}</h4>
                 <div className="text-[9px] text-emerald-500 font-bold mt-0.5">總增長 +{stats.growth}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">區間加入人數</p>
                 <h4 className="text-2xl font-black text-blue-500">{stats.rangeGrowth}</h4>
                 <div className="text-[9px] text-slate-300 font-bold mt-0.5">篩選時段內</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">區間封鎖人數</p>
                 <h4 className="text-2xl font-black text-red-400">{stats.rangeBlocked}</h4>
                 <div className="text-[9px] text-slate-300 font-bold mt-0.5">流失率 {stats.rangeGrowth > 0 ? ((stats.rangeBlocked / (stats.rangeGrowth + stats.rangeBlocked)) * 100).toFixed(1) : 0}%</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl shadow-sm text-white">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">區間平均日增</p>
                 <h4 className="text-2xl font-black text-white">{(stats.rangeGrowth / (growthTimeSeries.length || 1)).toFixed(1)}</h4>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 具體來源數值統計清單 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px]">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> 具體來源統計
                    </h3>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-400">區間內共 {stats.rangeGrowth} 人</div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {sourceStats.map((item, idx) => (
                      <div key={item.name} className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                         <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 rounded-full" style={{backgroundColor: tagColors[idx % tagColors.length]}} />
                            <span className="text-[11px] font-black text-slate-600">{item.name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800">{item.count}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase">人</span>
                         </div>
                      </div>
                    ))}
                    {sourceStats.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-xs py-10">此區間尚無數據紀錄</div>
                    )}
                 </div>
              </div>

              {/* 來源佔比圖表 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 self-start flex items-center gap-2">
                    <PieChart className="w-3.5 h-3.5" /> 管道構成佔比
                 </h3>
                 <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={sourceStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                            stroke="none"
                          >
                             {sourceStats.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={tagColors[index % tagColors.length]} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 'bold' }} />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-2xl font-black text-slate-800">{stats.rangeGrowth}</span>
                       <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">RANGE ADDS</span>
                    </div>
                 </div>
              </div>

              {/* 增長曲線圖表 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> 趨勢變化曲線
                 </h3>
                 <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <ComposedChart data={growthTimeSeries}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 'bold'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 'bold'}} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }} />
                          <Area type="monotone" dataKey="adds" name="當日加入" stroke="#10b981" strokeWidth={3} fill="#10b98120" />
                          <Bar dataKey="adds" fill="#10b98110" barSize={12} radius={[3, 3, 0, 0]} />
                       </ComposedChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* 底部詳細表格 */}
           <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-black text-slate-500 text-[10px] flex items-center gap-3 uppercase tracking-widest">
                    <Users className="w-4 h-4 text-emerald-500" /> 用戶進站明細 (受時段影響)
                 </h3>
                 <span className="text-[9px] font-black text-slate-400 bg-white px-3 py-1 rounded-lg border border-slate-100 tracking-widest uppercase">
                   篩選共 {filteredConnections.length} 筆資料
                 </span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[9px] text-slate-400 font-black uppercase tracking-widest bg-white border-b border-slate-50">
                          <th className="px-6 py-4">用戶頭像 / 暱稱</th>
                          <th className="px-6 py-4">標籤 (來源管道)</th>
                          <th className="px-6 py-4">加入日期與時間</th>
                          <th className="px-6 py-4 text-right">LINE UID</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                       {filteredConnections.slice(0, 50).map((conn) => (
                         <tr key={conn.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                                     {conn.linePictureUrl ? <img src={conn.linePictureUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-slate-300">N/A</div>}
                                  </div>
                                  <span className="text-slate-700 text-xs">{conn.lineUserId || '未授權用戶'}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                 conn.source?.includes('ig') ? 'bg-pink-50 text-pink-500 border-pink-100' :
                                 conn.source?.includes('fb') ? 'bg-blue-50 text-blue-500 border-blue-100' :
                                 conn.source?.includes('zewu') ? 'bg-slate-900 text-white' :
                                 'bg-slate-100 text-slate-400 border-slate-200'
                               }`}>
                                  {conn.source || '直接搜尋'}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-[10px] text-slate-400">
                               {new Date(conn.timestamp).toLocaleString('zh-TW', { hour12: false })}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <code className="text-[9px] font-mono text-slate-300">{(conn.UserId || "").substring(0, 15)}...</code>
                            </td>
                         </tr>
                       ))}
                       {filteredConnections.length === 0 && (
                         <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-300 italic font-black text-xs">此篩選區間尚無任何加入紀錄</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-slide-up">
           <div className="lg:col-span-1">
              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-6 sticky top-4">
                 <div className="flex items-center gap-3"><Terminal className="w-5 h-5 text-emerald-400" /><h3 className="font-black text-white text-sm">標籤連結工廠</h3></div>
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">快速前綴</label>
                       <div className="grid grid-cols-4 gap-2">
                          {['ig', 'fb', 'qr', 'ad'].map(p => (
                            <button key={p} onClick={() => setCustomTag(`${p}_`)} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[8px] font-black uppercase">{p}</button>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">標籤名稱</label>
                       <input type="text" value={customTag} placeholder="如: ig_zewu" onChange={(e) => setCustomTag(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-emerald-500/50" />
                    </div>
                    <button onClick={handleGenerateLink} disabled={!customTag.trim() || isGenerating} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-20 transition-all active:scale-95 shadow-lg">
                       {isGenerating ? <Activity className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}生成推廣連結
                    </button>
                 </div>
              </div>
           </div>
           <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                 <div className="p-5 bg-slate-50/50 border-b border-slate-100 font-black text-slate-400 text-[10px] uppercase tracking-widest">已存儲追蹤連結</div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead><tr className="text-[9px] text-slate-400 font-black uppercase tracking-widest bg-white border-b border-slate-50"><th className="px-8 py-4">標籤</th><th className="px-8 py-4">追蹤網址</th><th className="px-8 py-4 text-right">管理</th></tr></thead>
                       <tbody className="divide-y divide-slate-50 font-bold">
                          {marketingLinks.map((link) => (
                            <tr key={link.id} className="hover:bg-slate-50 transition-colors group">
                               <td className="px-8 py-5 font-black text-slate-700 text-xs">{link.tag}</td>
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-2"><code className="text-[9px] text-slate-300 bg-slate-100 px-3 py-1 rounded-lg truncate max-w-[200px]">{link.fullUrl}</code>
                                     <button onClick={() => {navigator.clipboard.writeText(link.fullUrl); setCopiedId(link.id); setTimeout(()=>setCopiedId(null), 2000)}} className="p-1.5 text-slate-200 hover:text-emerald-500 transition-all">
                                        {copiedId === link.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                     </button>
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-right"><button onClick={() => deleteDoc(doc(db, "marketing_links", link.id))} className="text-slate-100 group-hover:text-red-400 transition-all p-1.5"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;
