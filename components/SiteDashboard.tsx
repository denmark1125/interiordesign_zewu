
import React, { useState } from 'react';
import { DesignProject, ProjectStage } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Briefcase, Filter, ChevronRight, ListChecks, ChevronLeft } from 'lucide-react';
import { ProjectFilterType } from '../App';

interface DashboardProps {
  projects: DesignProject[];
  onSelectProject: (project: DesignProject) => void;
  employeeNames: string[];
  onFilterClick: (filter: ProjectFilterType) => void;
}

const ProjectDashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, employeeNames, onFilterClick }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredProjects = selectedEmployee === 'All' 
    ? projects 
    : projects.filter(p => p.assignedEmployee === selectedEmployee);

  const stageCounts = filteredProjects.reduce((acc, p) => {
    acc[p.currentStage] = (acc[p.currentStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: ProjectStage.CONTACT, value: stageCounts[ProjectStage.CONTACT] || 0, color: '#94a3b8' }, 
    { name: ProjectStage.DESIGN, value: stageCounts[ProjectStage.DESIGN] || 0, color: '#3b82f6' }, 
    { name: ProjectStage.CONSTRUCTION, value: stageCounts[ProjectStage.CONSTRUCTION] || 0, color: '#f59e0b' }, 
    { name: ProjectStage.ACCEPTANCE, value: stageCounts[ProjectStage.ACCEPTANCE] || 0, color: '#a855f7' }, 
    { name: ProjectStage.COMPLETED, value: stageCounts[ProjectStage.COMPLETED] || 0, color: '#10b981' }, 
    { name: ProjectStage.CLOSED_DESIGN, value: stageCounts[ProjectStage.CLOSED_DESIGN] || 0, color: '#64748b' }, 
    { name: ProjectStage.CLOSED_REJECTED, value: stageCounts[ProjectStage.CLOSED_REJECTED] || 0, color: '#cbd5e1' }, 
  ].filter(d => d.value > 0);

  const today = new Date();
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const upcomingDeadlines = filteredProjects.filter(p => {
    if (p.currentStage === ProjectStage.COMPLETED || p.currentStage === ProjectStage.CLOSED_DESIGN || p.currentStage === ProjectStage.CLOSED_REJECTED) return false;
    const date = new Date(p.estimatedCompletionDate);
    return date >= today && date <= thirtyDaysLater;
  });

  const stats = [
    { label: '負責案場總數', value: filteredProjects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', ring: 'ring-slate-50', filterType: 'ALL' as ProjectFilterType },
    { label: '施工中案場', value: stageCounts[ProjectStage.CONSTRUCTION] || 0, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', ring: 'ring-amber-50', filterType: 'CONSTRUCTION' as ProjectFilterType },
    { label: '設計/接洽中', value: (stageCounts[ProjectStage.DESIGN] || 0) + (stageCounts[ProjectStage.CONTACT] || 0), icon: Clock, color: 'bg-blue-100 text-blue-600', ring: 'ring-blue-50', filterType: 'DESIGN_CONTACT' as ProjectFilterType },
    { label: '即將完工 (30天內)', value: upcomingDeadlines.length, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', ring: 'ring-purple-50', filterType: 'UPCOMING' as ProjectFilterType },
  ];

  // Helper to check if updated today
  const isUpdatedToday = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    return date.getDate() === now.getDate() &&
           date.getMonth() === now.getMonth() &&
           date.getFullYear() === now.getFullYear();
  };

  // 1. Sort by Time (Latest first)
  const sortedListProjects = [...filteredProjects].sort((a, b) => {
      return b.lastUpdatedTimestamp - a.lastUpdatedTimestamp;
  });

  // 2. Pagination Logic
  const totalPages = Math.ceil(sortedListProjects.length / itemsPerPage);
  const paginatedProjects = sortedListProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">總覽儀表板</h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedEmployee === 'All' ? '全公司案場即時數據' : `${selectedEmployee} 的案場數據`}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          <select 
            className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-700 w-full md:w-auto outline-none cursor-pointer"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="All">顯示全部人員</option>
            {employeeNames.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>
        </div>
      </div>

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

        {/* All Projects List (Sorted by Time) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
            <ListChecks className="w-5 h-5 text-slate-600" />
            所有案場列表 (依更新時間排序)
          </h3>
          
          <div className="flex-1 overflow-auto min-h-[400px]">
             {/* Desktop Table View */}
            <table className="w-full text-sm text-left hidden md:table">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 rounded-lg sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-bold">案名</th>
                  <th className="px-4 py-3 font-bold">負責人</th>
                  <th className="px-4 py-3 font-bold">階段</th>
                  <th className="px-4 py-3 font-bold">預計完工</th>
                  <th className="px-4 py-3 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProjects.length === 0 ? (
                   <tr><td colSpan={5} className="text-center py-10 text-slate-400">目前無案場資料</td></tr>
                ) : (
                  paginatedProjects.map(project => (
                    <tr key={project.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onSelectProject(project)}>
                      <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        {isUpdatedToday(project.lastUpdatedTimestamp) && (
                             <span className="text-red-500 font-extrabold text-[10px] tracking-wider animate-pulse">NEW</span>
                        )}
                        {project.projectName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{project.assignedEmployee}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                          project.currentStage === ProjectStage.DESIGN ? 'bg-blue-100 text-blue-700' :
                          project.currentStage === ProjectStage.COMPLETED ? 'bg-emerald-100 text-emerald-700' :
                          (project.currentStage === ProjectStage.CLOSED_DESIGN || project.currentStage === ProjectStage.CLOSED_REJECTED) ? 'bg-slate-200 text-slate-500' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {project.currentStage}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-900 font-bold">{project.estimatedCompletionDate}</td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
              {paginatedProjects.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 text-sm">目前無案場資料</div>
              ) : (
                paginatedProjects.map(project => (
                  <div key={project.id} onClick={() => onSelectProject(project)} className="p-4 rounded-xl bg-slate-50 border border-slate-100 active:bg-slate-100 active:scale-[0.98] transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-slate-900 line-clamp-1 text-base flex items-center gap-2">
                        {isUpdatedToday(project.lastUpdatedTimestamp) && (
                            <span className="text-red-500 font-extrabold text-[10px] tracking-wider animate-pulse">NEW</span>
                        )}
                        {project.projectName}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                          (project.currentStage === ProjectStage.CLOSED_DESIGN || project.currentStage === ProjectStage.CLOSED_REJECTED) ? 'bg-slate-200 text-slate-500' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {project.currentStage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
                       <span>{project.assignedEmployee}</span>
                       <span className="font-mono text-slate-900 font-bold">完工: {project.estimatedCompletionDate}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-bold text-slate-500">
                    第 {currentPage} 頁 / 共 {totalPages} 頁
                </span>
                <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;