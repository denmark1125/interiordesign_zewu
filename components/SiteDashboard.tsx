import React, { useState } from 'react';
import { DesignProject, ProjectStage } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Briefcase, Filter, ChevronRight, ChevronLeft } from 'lucide-react';
import { ProjectFilterType } from '../App';

interface DashboardProps {
  projects: DesignProject[];
  onSelectProject: (project: DesignProject) => void;
  employeeNames: string[];
  onFilterClick: (filter: ProjectFilterType) => void;
}

const ProjectDashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, employeeNames, onFilterClick }) => {
  // --- States ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- Filtering & Calculations ---
  // The 'projects' prop passed here is already filtered by the App component based on Role/User.
  // We can do additional filtering if needed, but for dashboard aggregates, we usually use the full list accessible to the user.
  
  const stageCounts = projects.reduce((acc, p) => {
    acc[p.currentStage] = (acc[p.currentStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: ProjectStage.CONTACT, value: stageCounts[ProjectStage.CONTACT] || 0, color: '#94a3b8' }, 
    { name: ProjectStage.DESIGN, value: stageCounts[ProjectStage.DESIGN] || 0, color: '#3b82f6' }, 
    { name: ProjectStage.CONSTRUCTION, value: stageCounts[ProjectStage.CONSTRUCTION] || 0, color: '#f59e0b' }, 
    { name: ProjectStage.ACCEPTANCE, value: stageCounts[ProjectStage.ACCEPTANCE] || 0, color: '#a855f7' }, 
    { name: ProjectStage.COMPLETED, value: stageCounts[ProjectStage.COMPLETED] || 0, color: '#10b981' }, 
  ].filter(d => d.value > 0);

  const today = new Date();
  
  // Stats for Cards
  const constructionCount = projects.filter(p => p.currentStage === ProjectStage.CONSTRUCTION).length;
  const designContactCount = projects.filter(p => p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT).length;
  
  // Calculate upcoming (just for the stat card count)
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingCount = projects.filter(p => {
    if (p.currentStage === ProjectStage.COMPLETED) return false;
    const date = new Date(p.estimatedCompletionDate);
    return date >= today && date <= thirtyDaysLater;
  }).length;

  const stats = [
    { label: '負責案場總數', value: projects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', ring: 'ring-slate-50', filterType: 'ALL' as ProjectFilterType },
    { label: '施工中案場', value: constructionCount, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', ring: 'ring-amber-50', filterType: 'CONSTRUCTION' as ProjectFilterType },
    { label: '設計/接洽中', value: designContactCount, icon: Clock, color: 'bg-blue-100 text-blue-600', ring: 'ring-blue-50', filterType: 'DESIGN_CONTACT' as ProjectFilterType },
    { label: '即將完工 (30天內)', value: upcomingCount, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', ring: 'ring-purple-50', filterType: 'UPCOMING' as ProjectFilterType },
  ];

  // --- List Logic (Sorted by Time + Pagination + NEW Badge) ---
  
  // 1. Sort by Last Updated (Desc)
  const sortedProjects = [...projects].sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp);

  // 2. Pagination
  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
  const paginatedProjects = sortedProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  // 3. NEW Badge Helper
  const isUpdatedToday = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">總覽儀表板</h2>
          <p className="text-slate-500 text-sm mt-1">
            即時案場數據與狀態追蹤
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <button 
            key={idx} 
            onClick={() => onFilterClick(stat.filterType)}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] text-left group"
          >
            <div className={`p-3 rounded-xl w-fit ${stat.color} mb-3 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
              <div className="flex justify-between items-center mt-1">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{stat.label}</p>
                 <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6 text-lg">案場階段分佈</h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-slate-600 text-xs font-medium ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* All Projects List (Sorted by Time + Pagination + NEW Badge) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Briefcase className="w-5 h-5 text-slate-600" />
                所有案場列表 (依更新時間)
             </h3>
             <span className="text-xs text-slate-400 font-mono">
                第 {currentPage} / {totalPages || 1} 頁
             </span>
          </div>
          
          <div className="flex-1 overflow-auto">
             {/* Desktop Table View */}
            <table className="w-full text-sm text-left hidden md:table">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-bold">案名</th>
                  <th className="px-4 py-3 font-bold">負責人</th>
                  <th className="px-4 py-3 font-bold">階段</th>
                  <th className="px-4 py-3 font-bold">最後更新</th>
                  <th className="px-4 py-3 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProjects.length === 0 ? (
                   <tr><td colSpan={5} className="text-center py-10 text-slate-400">目前無專案資料</td></tr>
                ) : (
                  paginatedProjects.map(project => {
                    const isNew = isUpdatedToday(project.lastUpdatedTimestamp);
                    return (
                      <tr key={project.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onSelectProject(project)}>
                        <td className="px-4 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                            {isNew && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider">NEW</span>
                            )}
                            {project.projectName}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{project.assignedEmployee}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                            project.currentStage === ProjectStage.DESIGN ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {project.currentStage}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-600 font-medium">
                            {new Date(project.lastUpdatedTimestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-colors ml-auto" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
              {paginatedProjects.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 text-sm">目前無專案資料</div>
              ) : (
                paginatedProjects.map(project => {
                  const isNew = isUpdatedToday(project.lastUpdatedTimestamp);
                  return (
                    <div key={project.id} onClick={() => onSelectProject(project)} className="p-4 rounded-xl bg-slate-50 border border-slate-100 active:bg-slate-100 active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-800 line-clamp-1 flex items-center gap-2">
                            {isNew && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider">NEW</span>
                            )}
                            {project.projectName}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-700'
                            }`}>
                            {project.currentStage}
                        </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>{project.assignedEmployee}</span>
                        <span className="font-mono text-slate-400">更新: {new Date(project.lastUpdatedTimestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
             <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-100">
                <button 
                  onClick={handlePrevPage} 
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                   <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <span className="text-sm font-bold text-slate-600">
                   {currentPage}
                </span>
                <button 
                  onClick={handleNextPage} 
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                   <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
