
import React, { useState, useMemo, useEffect } from 'react';
import { LineMetric, User, MarketingLink } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { MessageCircle, Globe, Share2, Copy, Check, Users, Activity, ExternalLink, Filter, Calendar, Zap, Terminal, Trash2, Link as LinkIcon, Plus, PieChart as PieChartIcon, TrendingUp, CalendarDays, Search } from 'lucide-react';
import { db, onSnapshot, query, orderBy, collection, marketingLinksCollection, setDoc, doc, serverTimestamp, deleteDoc } from '../services/firebase';

interface MarketingDashboardProps {
  metrics: LineMetric[];
  currentUser: User;
}

const LIFF_BASE_URL = "https://liff.line.me/2008826901-DGGr1P8u";

const SOURCE_COLORS: Record<string, string> = {
  'Facebook': '#1877F2',
  'Instagram': '#E4405F',
  'Google Ads': '#FBBC05',
  'Line': '#06C755',
  'Direct': '#94a3b8',
  'Other': '#64748b'
};

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ metrics, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'links' | 'growth'>('analytics');
  
  // 日期篩選狀態
  const [timeRange, setTimeRange] = useState<'1M' | '6M' | 'CUSTOM' | 'ALL'>('1M');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [userSources, setUserSources] = useState<any[]>([]);
  const [marketingLinks, setMarketingLinks] = useState<MarketingLink[]>([]);
  
  const [customTag, setCustomTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 監聽所有用戶來源
  useEffect(() => {
    const q = query(collection(db, "user_sources"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserSources(snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        id: doc.id 
      })));
    });
    return () => unsubscribe();
  }, []);

  // 監聽連結
  useEffect(() => {
    if (activeTab === 'links') {
      const q = query(marketingLinksCollection, orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMarketingLinks(snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }) as MarketingLink));
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  // --- 數據處理邏輯 ---
  
  // 1. 根據日期過濾數據
  const filteredSources = useMemo(() => {
    const now = new Date();
    let startLimit: number = 0;
    let endLimit: number = now.getTime();

    if (timeRange === '1M') {
      startLimit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '6M') {
      startLimit = now.getTime() - 180 * 24 * 60 * 60 * 1000;
    } else if (timeRange === 'CUSTOM') {
      if (startDate) startLimit = new Date(startDate).setHours(0,0,0,0);
      if (endDate) endLimit = new Date(endDate).setHours(23,59,59,999);
    } else {
      return userSources;
    }

    return userSources.filter(u => {
      const time = (u.createdAt?.seconds ? u.createdAt.seconds * 1000 : u.createdAt);
      return time >= startLimit && time <= endLimit;
    });
  }, [userSources, timeRange, startDate, endDate]);

  // 2. 管道分類歸類
  const sourceDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    filteredSources.forEach(u => {
      const src = (u.source || 'direct').toLowerCase();
      let category = 'Other';
      if (src.includes('fb') || src.includes('facebook')) category = 'Facebook';
      else if (src.includes('ig') || src.includes('instagram')) category = 'Instagram';
      else if (src.includes('ads') || src.includes('google')) category = 'Google Ads';
      else if (src.includes('line')) category = 'Line';
      else if (src === 'direct') category = 'Direct';
      
      dist[category] = (dist[category] || 0) + 1;
    });

    return Object.entries(dist).map(([name, value]) => ({ 
      name, 
      value, 
      color: SOURCE_COLORS[name] || SOURCE_COLORS['Other'] 
    })).sort((a, b) => b.value - a.value);
  }, [filteredSources]);

  // 3. 趨勢數據處理
  const trendData = useMemo(() => {
    const days: Record<string, number> = {};
    filteredSources.forEach(u => {
      const date = new Date(u.createdAt?.seconds ? u.createdAt.seconds * 1000 : u.createdAt).toLocaleDateString();
      days[date] = (days[date] || 0) + 1;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSources]);

  const handleGenerateAndSave = async () => {
    if (!customTag.trim()) return;
    setIsGenerating(true);
    const id = `ml-${Date.now()}`;
    const fullUrl = `${LIFF_BASE_URL}?src=${encodeURIComponent(customTag.trim())}`;
    try {
      await setDoc(doc(db, "marketing_links", id), {
        id, tag: customTag.trim(), fullUrl, createdAt: serverTimestamp()
      });
      setCustomTag('');
      alert('連結生成成功');
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteLink = async (link: MarketingLink) => {
    if (window.confirm(`確定要刪除「${link.tag}」的連結嗎？`)) {
      await deleteDoc(doc(db, "marketing_links", link.id));
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            管道追蹤儀表板
          </h2>
          <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Attribution & Performance</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
           <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>來源分析</button>
           <button onClick={() => setActiveTab('growth')} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all ${activeTab === 'growth' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>成長趨勢</button>
           <button onClick={() => setActiveTab('links')} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all ${activeTab === 'links' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>連結管理</button>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
           {/* 進階日期篩選器 */}
           <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex flex-wrap gap-2">
                 {(['1M', '6M', 'ALL', 'CUSTOM'] as const).map(r => (
                   <button 
                     key={r} 
                     onClick={() => setTimeRange(r)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${timeRange === r ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                   >
                     {r === '1M' ? '近 1 個月' : r === '6M' ? '近 6 個月' : r === 'CUSTOM' ? '自定義日期' : '所有時間'}
                   </button>
                 ))}
              </div>

              {timeRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 animate-fade-in">
                   <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none" 
                      />
                   </div>
                   <span className="text-slate-300 font-bold">~</span>
                   <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none" 
                      />
                   </div>
                </div>
              )}

              <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 ml-auto">
                 <CalendarDays className="w-3.5 h-3.5" /> 數據更新：{new Date().toLocaleDateString()}
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Doughnut Chart */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="font-black text-slate-800 mb-6 text-sm self-start flex items-center gap-2">
                   <PieChartIcon className="w-4 h-4 text-emerald-500" /> 來源管道佔比
                 </h3>
                 <div className="h-[280px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={sourceDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                             {sourceDistribution.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: 'bold' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-3xl font-black text-slate-800">{filteredSources.length}</span>
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Total Adds</span>
                    </div>
                 </div>
              </div>

              {/* Trend Chart - 強制整數 Y 軸 */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                 <h3 className="font-black text-slate-800 mb-6 text-sm flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-emerald-500" /> 該時段每日加入趨勢
                 </h3>
                 <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={trendData}>
                          <defs>
                             <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                               <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" hide />
                          {/* YAxis 優化：不允許小數點，確保顯示單位為 1人 */}
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#94a3b8'}} 
                            allowDecimals={false}
                            minTickGap={1}
                          />
                          <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                          <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Detailed User Table */}
              <div className="lg:col-span-3 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                 <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-3 uppercase tracking-widest">
                       <Users className="w-5 h-5 text-emerald-500" /> 用戶來源詳細明細
                    </h3>
                    <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
                       <Search className="w-3.5 h-3.5 text-slate-300" />
                       <span className="text-[10px] font-black text-slate-400">當前條件下共有 {filteredSources.length} 位用戶</span>
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                       <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-50">
                          <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                             <th className="px-8 py-4">頭像 / 用戶</th>
                             <th className="px-8 py-4">具體來源標籤</th>
                             <th className="px-8 py-4">加入日期</th>
                             <th className="px-8 py-4 text-right">LINE UID</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredSources.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                               <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                     <img src={user.pictureUrl || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full border border-slate-200" />
                                     <span className="font-black text-slate-800 text-sm">{user.displayName}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-4">
                                  <div className="flex items-center gap-2">
                                     <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                       user.source?.includes('fb') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                       user.source?.includes('ig') ? 'bg-pink-50 text-pink-600 border-pink-100' :
                                       'bg-slate-100 text-slate-500 border-slate-200'
                                     }`}>
                                       {user.source || 'Direct'}
                                     </span>
                                  </div>
                               </td>
                               <td className="px-8 py-4 text-xs font-bold text-slate-500">
                                  {formatDate(user.createdAt)}
                               </td>
                               <td className="px-8 py-4 text-right">
                                  <code className="text-[9px] text-slate-300 font-mono">
                                     {user.userId?.substring(0, 16)}...
                                  </code>
                               </td>
                            </tr>
                          ))}
                          {filteredSources.length === 0 && (
                            <tr>
                               <td colSpan={4} className="py-20 text-center text-slate-300 font-black italic">此時段內無用戶加入紀錄</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'growth' && (
        <div className="animate-fade-in space-y-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" /> 好友成長紀錄 (官方數據同步)
                </h3>
             </div>
             <div className="h-[380px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={metrics}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} allowDecimals={false} />
                   <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold' }} />
                   <Area type="monotone" dataKey="followerCount" stroke="#06C755" strokeWidth={4} fillOpacity={0.1} fill="#06C755" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-slide-up">
           <div className="lg:col-span-1">
              <div className="bg-slate-900 p-8 rounded-[32px] shadow-xl text-white space-y-6 sticky top-8 border border-slate-800">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl"><Terminal className="w-6 h-6 text-emerald-400" /></div>
                    <h3 className="font-black text-white text-lg">連結管理</h3>
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase">來源代碼</label>
                       <input 
                         type="text" 
                         placeholder="例如: fb_ad_01" 
                         value={customTag}
                         onChange={(e) => setCustomTag(e.target.value)}
                         className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                       />
                    </div>
                    <button 
                       onClick={handleGenerateAndSave}
                       disabled={!customTag.trim() || isGenerating}
                       className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-20 transition-all shadow-lg active:scale-95"
                    >
                       {isGenerating ? <Activity className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                       生成並儲存
                    </button>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-3">
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                 <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-3 uppercase tracking-widest">
                       <LinkIcon className="w-5 h-5 text-emerald-500" /> 已儲存連結
                    </h3>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white border-b border-slate-50">
                             <th className="px-8 py-5">標籤</th>
                             <th className="px-8 py-5">連結</th>
                             <th className="px-8 py-5 text-right">操作</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {marketingLinks.map((link) => (
                            <tr key={link.id} className="hover:bg-slate-50 transition-colors">
                               <td className="px-8 py-5 font-black text-slate-800 text-sm">{link.tag}</td>
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                     <code className="text-[10px] text-slate-400 bg-slate-100 px-3 py-1 rounded-lg truncate max-w-[200px] font-mono">{link.fullUrl}</code>
                                     <button onClick={() => {navigator.clipboard.writeText(link.fullUrl); setCopiedId(link.id); setTimeout(()=>setCopiedId(null), 2000)}} className="p-2 text-slate-300 hover:text-emerald-500">
                                        {copiedId === link.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                     </button>
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-right">
                                  <button onClick={() => handleDeleteLink(link)} className="text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                               </td>
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
