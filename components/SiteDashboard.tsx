import React, { useState } from 'react';
import { DesignProject, ProjectStage } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Briefcase, Filter, ChevronRight } from 'lucide-react';

interface DashboardProps {
  projects: DesignProject[];
  onSelectProject: (project: DesignProject) => void;
  employeeNames: string[];
}

const ProjectDashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, employeeNames }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');

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
  ].filter(d => d.value > 0);

  const today = new Date();
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const upcomingDeadlines = filteredProjects.filter(p => {
    if (p.currentStage === ProjectStage.COMPLETED) return false;
    const date = new Date(p.estimatedCompletionDate);
    return date >= today && date <= thirtyDaysLater;
  }).sort((a, b) => new Date(a.estimatedCompletionDate).getTime() - new Date(b.estimatedCompletionDate).getTime());

  const stats = [
    { label: '負責案場總數', value: filteredProjects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', ring: 'ring-slate-50' },
    { label: '施工中案場', value: stageCounts[ProjectStage.CONSTRUCTION] || 0, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', ring: 'ring-amber-50' },
    { label: '設計/接洽中', value: (stageCounts[ProjectStage.DESIGN] || 0) + (stageCounts[ProjectStage.CONTACT] || 0), icon: Clock, color: 'bg-blue-100 text-blue-600', ring: 'ring-blue-50' },
    { label: '即將完工 (30天內)', value: upcomingDeadlines.length, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', ring: 'ring-purple-50' },
  ];

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
            className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-700 w-full md:w-auto"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="All">顯示全部員工</option>
            {employeeNames.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-xl w-fit ${stat.color} mb-3`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
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

        {/* Upcoming Deadline List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-amber-500" />
            即將完工 & 重點追蹤
          </h3>
          
          <div className="flex-1 overflow-auto">
             {/* Desktop Table View */}
            <table className="w-full text-sm text-left hidden md:table">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-bold">案名</th>
                  <th className="px-4 py-3 font-bold">負責人</th>
                  <th className="px-4 py-3 font-bold">階段</th>
                  <th className="px-4 py-3 font-bold">預計完工</th>
                  <th className="px-4 py-3 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingDeadlines.length === 0 ? (
                   <tr><td colSpan={5} className="text-center py-10 text-slate-400">目前無 30 天內需完工的案場</td></tr>
                ) : (
                  upcomingDeadlines.map(project => (
                    <tr key={project.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onSelectProject(project)}>
                      <td className="px-4 py-3.5 font-bold text-slate-800">{project.projectName}</td>
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
                      <td className="px-4 py-3.5 font-mono text-slate-600 font-medium">{project.estimatedCompletionDate}</td>
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
              {upcomingDeadlines.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 text-sm">目前無 30 天內需完工的案場</div>
              ) : (
                upcomingDeadlines.map(project => (
                  <div key={project.id} onClick={() => onSelectProject(project)} className="p-4 rounded-xl bg-slate-50 border border-slate-100 active:bg-slate-100 active:scale-[0.98] transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-slate-800 line-clamp-1">{project.projectName}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {project.currentStage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                       <span>{project.assignedEmployee}</span>
                       <span className="font-mono text-red-500 font-medium">完工: {project.estimatedCompletionDate}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;