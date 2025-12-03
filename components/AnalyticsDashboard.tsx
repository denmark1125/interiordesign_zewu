
import React, { useState, useMemo } from 'react';
import { DesignProject, ProjectStage } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { MapPin, Hammer, Filter, Users, LayoutDashboard, CalendarRange } from 'lucide-react';
import { CONSTRUCTION_PHASES } from '../constants';

interface AnalyticsDashboardProps {
  projects: DesignProject[];
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ projects }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  // Filter Projects by Time Range based on createdAt
  const filteredProjects = useMemo(() => {
    const now = Date.now();
    let startTime = 0;
    
    switch (timeRange) {
      case '1M': startTime = now - 30 * 24 * 60 * 60 * 1000; break;
      case '3M': startTime = now - 90 * 24 * 60 * 60 * 1000; break;
      case '6M': startTime = now - 180 * 24 * 60 * 60 * 1000; break;
      case '1Y': startTime = now - 365 * 24 * 60 * 60 * 1000; break;
      default: startTime = 0;
    }

    return projects.filter(p => {
      // Use createdAt for analytics. Fallback to lastUpdated if createdAt is missing.
      const projectTime = p.createdAt || p.lastUpdatedTimestamp;
      return projectTime >= startTime;
    });
  }, [projects, timeRange]);

  // 1. Geographic Analysis (Smart Address Parsing)
  const locationData = useMemo(() => {
    const locations: Record<string, number> = {};
    
    filteredProjects.forEach(p => {
      if (!p.address) return;
      // Extract City (e.g., 台北市) and District (e.g., 信義區)
      // Regex matches Chinese characters for city/county and district
      const cityMatch = p.address.match(/([\u4e00-\u9fa5]{2,3}(?:縣|市))/);
      const city = cityMatch ? cityMatch[1] : '';
      
      // Remove city from address to avoid matching "高雄市" as "雄市" in district
      const addressWithoutCity = city ? p.address.replace(city, '') : p.address;
      
      const districtMatch = addressWithoutCity.match(/([\u4e00-\u9fa5]{2,4}(?:區|市|鎮|鄉))/);
      const district = districtMatch ? districtMatch[1] : '其他';

      const key = city ? `${city} ${district}` : district;
      if (key.length > 1) {
          locations[key] = (locations[key] || 0) + 1;
      }
    });

    return Object.entries(locations)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 locations
  }, [filteredProjects]);

  // 2. Trade/Resource Analysis (Schedule Parsing)
  const tradeData = useMemo(() => {
    const tradeDays: Record<string, number> = {};
    
    filteredProjects.forEach(p => {
      if (!p.schedule) return;
      p.schedule.forEach(item => {
        if (!item.startDate || !item.endDate) return;
        
        // Calculate duration
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Simplify phase name (e.g., "木作工程" -> "木作")
        const phaseName = item.phase.replace('工程', '');
        tradeDays[phaseName] = (tradeDays[phaseName] || 0) + days;
      });
    });

    // Default phases if no data to show empty chart structure
    if (Object.keys(tradeDays).length === 0) {
        CONSTRUCTION_PHASES.slice(0, 6).forEach(p => {
            tradeDays[p.replace('工程', '')] = 0;
        });
    }

    return Object.entries(tradeDays)
      .map(([subject, A]) => ({ subject, A, fullMark: 100 })) // A = Actual Days
      .sort((a, b) => b.A - a.A)
      .slice(0, 8); // Top 8 trades
  }, [filteredProjects]);

  // 3. Project Conversion Funnel
  const funnelData = useMemo(() => {
    const counts = {
      [ProjectStage.CONTACT]: 0,
      [ProjectStage.DESIGN]: 0,
      [ProjectStage.CONSTRUCTION]: 0,
      [ProjectStage.COMPLETED]: 0,
      CLOSED: 0
    };

    filteredProjects.forEach(p => {
      if (p.currentStage === ProjectStage.CLOSED_DESIGN || p.currentStage === ProjectStage.CLOSED_REJECTED) {
        counts.CLOSED++;
      } else if (counts[p.currentStage] !== undefined) {
        counts[p.currentStage]++;
      }
    });

    return [
      { name: '接洽中', value: counts[ProjectStage.CONTACT], color: '#94a3b8' },
      { name: '設計中', value: counts[ProjectStage.DESIGN], color: '#3b82f6' },
      { name: '施工中', value: counts[ProjectStage.CONSTRUCTION], color: '#f59e0b' },
      { name: '已完工', value: counts[ProjectStage.COMPLETED], color: '#10b981' },
      { name: '未成案/結案', value: counts.CLOSED, color: '#cbd5e1' },
    ].filter(d => d.value > 0);
  }, [filteredProjects]);

  // 4. Designer Workload
  const workloadData = useMemo(() => {
    const loads: Record<string, { active: number, design: number }> = {};
    
    filteredProjects.forEach(p => {
       if (!loads[p.assignedEmployee]) loads[p.assignedEmployee] = { active: 0, design: 0 };
       
       if (p.currentStage === ProjectStage.CONSTRUCTION) {
         loads[p.assignedEmployee].active++;
       } else if (p.currentStage === ProjectStage.DESIGN) {
         loads[p.assignedEmployee].design++;
       }
    });

    return Object.entries(loads)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.active + b.design) - (a.active + a.design));
  }, [filteredProjects]);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-slate-600" />
            營運數據分析中心
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            透過數據洞察業務分佈、資源配置與團隊效能。僅工程師可見。
          </p>
        </div>
        
        {/* Time Range Filter */}
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex items-center overflow-x-auto max-w-full">
            <CalendarRange className="w-4 h-4 text-slate-400 ml-2 mr-2 flex-shrink-0" />
            <div className="flex gap-1">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                        timeRange === range 
                            ? 'bg-[#54534d] text-white shadow-sm' 
                            : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    {range === 'ALL' ? '所有時間' : `近 ${range.replace('M', ' 個月').replace('1Y', '1 年')}`}
                </button>
            ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Geographic Heatmap */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            案源地理分佈熱點
          </h3>
          <div className="h-[300px]">
            {locationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} name="案件數" />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">此區間無地址資料</div>
            )}
          </div>
        </div>

        {/* 2. Trade Resource Analysis */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-blue-500" />
            工程工種耗時統計 (天數)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={tradeData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                <Radar name="總工期天數" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Project Funnel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Filter className="w-5 h-5 text-purple-500" />
            專案轉換與成案率
          </h3>
          <div className="h-[300px] flex items-center justify-center">
             {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={funnelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="text-slate-400 text-sm">此區間無專案資料</div>
             )}
          </div>
        </div>

        {/* 4. Team Workload */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            設計師專案負載量
          </h3>
          <div className="h-[300px]">
            {workloadData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="active" name="施工中" stackId="a" fill="#f59e0b" barSize={30} />
                    <Bar dataKey="design" name="設計中" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">此區間無負載資料</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsDashboard;