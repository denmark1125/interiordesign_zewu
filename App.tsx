
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import ProjectDashboard from './components/SiteDashboard';
import ProjectDetail from './components/SiteDetail';
import LoginScreen from './components/LoginScreen';
import NewProjectModal from './components/NewProjectModal';
import TeamManagement from './components/TeamManagement';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SystemChangelog from './components/SystemChangelog';
import MarketingDashboard from './components/MarketingDashboard';
import CRMManager from './components/CRMManager';
import { DesignProject, User, ProjectStage, LineMetric, Customer, LineStat } from './types';
import { INITIAL_USERS } from './constants';
import { Plus, Loader2 } from 'lucide-react';
import { db, usersCollection, projectsCollection, lineMetricsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy, collection } from './services/firebase';

export type ProjectFilterType = 'ALL' | 'CONSTRUCTION' | 'DESIGN_CONTACT' | 'UPCOMING';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>([]);
  const [lineStats, setLineStats] = useState<LineStat[]>([]);

  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm'>('dashboard');
  const [previousView, setPreviousView] = useState<'dashboard' | 'projects'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  const [conversionData, setConversionData] = useState<Partial<DesignProject> | null>(null);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
    });
    const unsubscribeProjects = onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), (snapshot) => {
      setProjects(snapshot.docs.map(doc => doc.data() as DesignProject));
      setIsLoading(false);
    });
    const unsubscribeMetrics = onSnapshot(query(lineMetricsCollection, orderBy("date", "asc")), (snapshot) => {
      setLineMetrics(snapshot.docs.map(doc => doc.data() as LineMetric));
    });
    const unsubscribeStats = onSnapshot(query(collection(db, "line_stats"), orderBy("createdAt", "desc")), (snapshot) => {
      setLineStats(snapshot.docs.map(doc => doc.data() as LineStat));
    });

    return () => { 
      unsubscribeUsers(); 
      unsubscribeProjects(); 
      unsubscribeMetrics();
      unsubscribeStats();
    };
  }, []);

  const employeeNames = useMemo(() => users.map(u => u.name), [users]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('zewu_user', JSON.stringify(user));
    setView(user.role !== 'employee' || user.canViewDashboard ? 'dashboard' : 'projects');
  };

  const handleSelectProject = (project: DesignProject) => {
    setPreviousView(view === 'detail' ? 'projects' : (view as any));
    setSelectedProject(project);
    setView('detail');
  };

  // 強化分頁切換：確保切換標籤時清空選中的專案狀態，避免畫面衝突
  const handleTabChange = (newView: any) => {
    setSelectedProject(null);
    setView(newView);
  };

  const handleConvertToProject = (customer: Customer) => {
    setConversionData({
      projectName: `${customer.name}案`,
      clientName: customer.name,
      contactPhone: customer.phone,
      internalNotes: customer.tags.length > 0 ? `客戶標籤：${customer.tags.join(', ')}` : ''
    });
    setShowNewProjectModal(true);
  };

  if (isLoading) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="w-10 h-10 text-accent animate-spin" /><p className="text-slate-500 font-bold">同步中...</p></div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={users} />;

  return (
    <Layout 
      activeTab={view === 'detail' ? 'projects' : view as any} 
      onTabChange={handleTabChange}
      currentUser={currentUser}
      onLogout={() => {
        setCurrentUser(null);
        localStorage.removeItem('zewu_user');
      }}
      onExportData={() => {}}
    >
      {view === 'dashboard' && <ProjectDashboard projects={projects} onSelectProject={handleSelectProject} employeeNames={employeeNames} onFilterClick={() => setView('projects')} />}
      {view === 'crm' && <CRMManager currentUser={currentUser} onConvertToProject={handleConvertToProject} />}
      {view === 'marketing' && <MarketingDashboard metrics={lineMetrics} autoStats={lineStats} currentUser={currentUser} />}
      {view === 'changelog' && <SystemChangelog currentUser={currentUser} users={users} />}
      {view === 'team' && <TeamManagement users={users} currentUser={currentUser} onAddUser={(u) => setDoc(doc(db, "users", u.id), u)} onUpdateUser={(u) => setDoc(doc(db, "users", u.id), u)} onDeleteUser={(id) => deleteDoc(doc(db, "users", id))} />}
      {view === 'analytics' && <AnalyticsDashboard projects={projects} />}
      
      {/* 修正點：移除 !selectedProject 的限制條件，確保 view 是 projects 時一定顯示列表 */}
      {view === 'projects' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-800">所有案場列表</h2>
            <button onClick={() => { setConversionData(null); setShowNewProjectModal(true); }} className="bg-accent text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"><Plus className="w-5 h-5" /> 新增案場</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map(p => (
              <div key={p.id} onClick={() => handleSelectProject(p)} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                <div className="h-40 bg-slate-100 overflow-hidden">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-800 truncate">{p.projectName}</h3>
                  <p className="text-slate-400 text-sm mt-1">{p.assignedEmployee}</p>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400">目前沒有進行中的案場</div>
            )}
          </div>
        </div>
      )}

      {/* 詳情視圖：在 onBack 時務必清空 selectedProject 資料 */}
      {view === 'detail' && selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          currentUser={currentUser} 
          onBack={() => {
            setView(previousView as any);
            setSelectedProject(null); // 重要：返回時必須清空，避免邏輯衝突
          }} 
          onUpdateProject={async (p) => setDoc(doc(db, "projects", p.id), p)} 
          onDeleteProject={async (id) => {
            await deleteDoc(doc(db, "projects", id));
            setSelectedProject(null);
            setView('projects');
          }} 
          employeeNames={employeeNames} 
        />
      )}

      {showNewProjectModal && <NewProjectModal initialData={conversionData} currentUser={currentUser} onClose={() => { setShowNewProjectModal(false); setConversionData(null); }} onSubmit={(p) => { setDoc(doc(db, "projects", p.id), p); setShowNewProjectModal(false); setConversionData(null); }} employeeNames={employeeNames} />}
    </Layout>
  );
};

export default App;
