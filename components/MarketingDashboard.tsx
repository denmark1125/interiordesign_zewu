
import React, { useState, useMemo } from 'react';
import { LineMetric, User, LineStat } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { MessageCircle, TrendingUp, Users, Plus, Trash2, Calendar, Save, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { db, lineMetricsCollection, setDoc, doc, deleteDoc } from '../services/firebase';

// Fixed: Added autoStats to MarketingDashboardProps to allow passing LineStat data from parent
interface MarketingDashboardProps {
  metrics: LineMetric[];
  autoStats?: LineStat[];
  currentUser: User;
}

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ metrics, autoStats, currentUser }) => {
  const [newCount, setNewCount] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);

  // 排序數據
  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics]);

  const latestMetric = sortedMetrics[sortedMetrics.length - 1];
  
  // 計算本週成長 (與 7 天前最接近的一筆對比)
  const stats = useMemo(() => {
    if (sortedMetrics.length < 2) return { thisWeek: 0, lastWeek: 0, diff: 0, percent: 0 };
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const latest = sortedMetrics[sortedMetrics.length - 1].followerCount;
    
    // Fixed: Replaced findLast with [...sortedMetrics].reverse().find for compatibility with older TS targets
    const weekAgoMetric = [...sortedMetrics].reverse().find(m => new Date(m.date) <= sevenDaysAgo) || sortedMetrics[0];
    const twoWeeksAgoMetric = [...sortedMetrics].reverse().find(m => new Date(m.date) <= fourteenDaysAgo) || sortedMetrics[0];

    const diff = latest - weekAgoMetric.followerCount;
    const lastWeekDiff = weekAgoMetric.followerCount - twoWeeksAgoMetric.followerCount;
    const percent = weekAgoMetric.followerCount > 0 ? (diff / weekAgoMetric.followerCount) * 100 : 0;

    return {
      current: latest,
      weekAgo: weekAgoMetric.followerCount,
      diff,
      lastWeekDiff,
      percent: percent.toFixed(1)
    };
  }, [sortedMetrics]);

  const handleAddMetric = async () => {
    const count = parseInt(newCount);
    if (isNaN(count) || count < 0) {
      alert("請輸入正確的人數");
      return;
    }

    const id = `metric-${Date.now()}`;
    const metric: LineMetric = {
      id,
      timestamp: Date.now(),
      date: newDate,
      followerCount: count,
      recordedBy: currentUser.name
    };

    try {
      await setDoc(doc(db, "line_metrics", id), metric);
      setNewCount('');
      setIsAdding(false);
    } catch (e) {
      alert("儲存失敗");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("確定刪除此筆紀錄？")) return;
    await deleteDoc(doc(db, "line_metrics", id));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-[#06C755]" />
            LINE 官方帳號數據
          </h2>
          <p className="text-slate-500 text-sm mt-1">追蹤好友成長趨勢與行銷成效</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#06C755] hover:bg-[#05a647] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all font-bold"
        >
          <Plus className="w-5 h-5" /> 錄入新數據
        </button>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Users className="w-6 h-6 text-[#06C755]" />
            </div>
            {parseFloat(stats.percent as string) > 0 && (
              <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3 mr-1" /> {stats.percent}%
              </span>
            )}
          </div>
          <p className="text-3xl font-black text-slate-800">{stats.current || 0}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">目前總好友數</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-blue-50 rounded-xl w-fit mb-4">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">+{stats.diff}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">本週新增人數</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-3 bg-slate-50 rounded-xl w-fit mb-4">
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-3xl font-black text-slate-800">+{stats.lastWeekDiff}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">上週新增人數</p>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#06C755]/30 shadow-xl animate-slide-up">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            錄入追蹤人數
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">日期</label>
              <input 
                type="date" 
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#06C755]/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">總好友數</label>
              <input 
                type="number" 
                value={newCount}
                onChange={e => setNewCount(e.target.value)}
                placeholder="輸入目前數字..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#06C755]/20 outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button 
                onClick={handleAddMetric}
                className="flex-1 bg-[#06C755] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#05a647]"
              >
                <Save className="w-4 h-4" /> 儲存
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-slate-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 成長趨勢圖 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">好友成長趨勢圖</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sortedMetrics}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06C755" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#06C755" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#94a3b8'}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#94a3b8'}}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="followerCount" 
                  name="好友人數"
                  stroke="#06C755" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 歷史清單 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            錄入紀錄
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] pr-2">
            {[...sortedMetrics].reverse().map(metric => (
              <div key={metric.id} className="group flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div>
                  <p className="font-black text-slate-800">{metric.followerCount}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{metric.date} • {metric.recordedBy}</p>
                </div>
                <button 
                  onClick={() => handleDelete(metric.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {sortedMetrics.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">尚無數據紀錄</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingDashboard;
