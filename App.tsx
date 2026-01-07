
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
import { DesignProject, User, ProjectStage, LineMetric, Customer } from './types';
import { INITIAL_USERS } from './constants';
// Added MapPin to the lucide-react imports
import { Plus, Loader2, MapPin } from 'lucide-react';
import { db, usersCollection, projectsCollection, lineMetricsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy } from './services/firebase';

export type ProjectFilterType = 'ALL' | 'CONSTRUCTION' | 'DESIGN_CONTACT' | 'UPCOMING';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>([]);

  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm'>('dashboard');
  const [previousView, setPreviousView] = useState<'dashboard' | 'projects'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  // 轉案場緩存
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
    return () => { 
      unsubscribeUsers(); 
      unsubscribeProjects(); 
      unsubscribeMetrics();
    };
  }, []);

  const employeeNames = useMemo(() => users.map(u => u.name), [users]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('zewu_user', JSON.stringify(user));
    setView(user.role !== 'employee' || user.canViewDashboard ? 'dashboard' : 'projects');
  };

  const handleSelectProject = (project: DesignProject) => {
    setPreviousView(view as any);
    setSelectedProject(project);
    setView('detail');
  };

  // 修改：將客戶地址帶入專案地址
  const handleConvertToProject = (customer: Customer) => {
    setConversionData({
      projectName: `${customer.name}室內設計案`,
      clientName: customer.name,
      contactPhone: customer.phone,
      address: customer.address || '',
      internalNotes: customer.tags && customer.tags.length > 0 ? `來源標籤：${customer.tags.join(', ')}` : ''
    });
    setShowNewProjectModal(true);
  };

  if (isLoading) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="w-10 h-10 text-accent animate-spin" /><p className="text-slate-500 font-bold">同步中...</p></div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={users} />;

  return (
    <Layout 
      activeTab={view === 'detail' ? 'projects' : view as any} 
      onTabChange={setView as any}
      currentUser={currentUser}
      onLogout={() => {
        setCurrentUser(null);
        localStorage.removeItem('zewu_user');
      }}
      onExportData={() => {}}
    >
      {view === 'dashboard' && <ProjectDashboard projects={projects} onSelectProject={handleSelectProject} employeeNames={employeeNames} onFilterClick={() => setView('projects')} />}
      {view === 'crm' && <CRMManager currentUser={currentUser} onConvertToProject={handleConvertToProject} />}
      {view === 'marketing' && <MarketingDashboard metrics={lineMetrics} currentUser={currentUser} />}
      {view === 'changelog' && <SystemChangelog currentUser={currentUser} users={users} />}
      {view === 'team' && <TeamManagement users={users} currentUser={currentUser} onAddUser={(u) => setDoc(doc(db, "users", u.id), u)} onUpdateUser={(u) => setDoc(doc(db, "users", u.id), u)} onDeleteUser={(id) => deleteDoc(doc(db, "users", id))} />}
      {view === 'analytics' && <AnalyticsDashboard projects={projects} />}
      
      {view === 'projects' && !selectedProject && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-800">案場列表</h2>
            <button onClick={() => { setConversionData(null); setShowNewProjectModal(true); }} className="bg-[#54534d] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"><Plus className="w-5 h-5" /> 手動新增案場</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div key={p.id} onClick={() => handleSelectProject(p)} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer group">
                <div className="h-48 bg-slate-100 overflow-hidden relative">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[10px] font-black text-slate-800 shadow-sm uppercase tracking-widest">{p.currentStage}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-slate-800 text-lg truncate mb-1">{p.projectName}</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{p.address || '未填寫地址'}</span>
                  </div>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 font-bold">目前沒有案場資料</div>
            )}
          </div>
        </div>
      )}
      {view === 'detail' && selectedProject && <ProjectDetail project={selectedProject} currentUser={currentUser} onBack={() => setView(previousView as any)} onUpdateProject={async (p) => setDoc(doc(db, "projects", p.id), p)} onDeleteProject={async (id) => deleteDoc(doc(db, "projects", id))} employeeNames={employeeNames} />}
      {showNewProjectModal && <NewProjectModal initialData={conversionData} currentUser={currentUser} onClose={() => { setShowNewProjectModal(false); setConversionData(null); }} onSubmit={(p) => { setDoc(doc(db, "projects", p.id), p); setShowNewProjectModal(false); setConversionData(null); }} employeeNames={employeeNames} />}
    </Layout>
  );
};

export default App;
