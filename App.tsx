
import React, { useState, useMemo, useEffect } from 'react';
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
import JoinPage from './JoinPage'; 
import { DesignProject, User, LineMetric } from './types';
import { db, usersCollection, projectsCollection, lineMetricsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy, collection } from './services/firebase';
import { Plus, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // ---------------------------------------------------------
  // 1. 強力分流邏輯 (Gatekeeper)
  // ---------------------------------------------------------
  const [isClientMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    
    // 檢查有沒有 src 或 source 參數
    const hasSrc = searchParams.has('src') || searchParams.has('source') || 
                   hashParams.has('src') || hashParams.has('source');
    
    // 檢查是否有 Session 記憶 (防止 LINE 登入跳轉遺失參數)
    const wasClient = sessionStorage.getItem('zewu_mode') === 'client';

    if (hasSrc || wasClient) {
      sessionStorage.setItem('zewu_mode', 'client');
      return true;
    }
    return false;
  });

  // ---------------------------------------------------------
  // 2. 狀態管理
  // ---------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!isClientMode); 
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>([]);

  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [conversionData, setConversionData] = useState<Partial<DesignProject> | null>(null);

  // ---------------------------------------------------------
  // 3. 數據監聽 (僅在後台模式啟動)
  // ---------------------------------------------------------
  useEffect(() => {
    if (isClientMode) return; 

    // 監聽員工資料 (包含登入統計)
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() as User, id: doc.id }));
      setUsers(usersData);
    });

    // 監聽案場資料
    const unsubscribeProjects = onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), (snapshot) => {
      setProjects(snapshot.docs.map(doc => doc.data() as DesignProject));
      setIsLoading(false);
    });

    // 監聽 LINE 統計
    const unsubscribeMetrics = onSnapshot(query(lineMetricsCollection, orderBy("date", "asc")), (snapshot) => {
      setLineMetrics(snapshot.docs.map(doc => doc.data() as LineMetric));
    });

    return () => { 
      unsubscribeUsers(); 
      unsubscribeProjects(); 
      unsubscribeMetrics();
    };
  }, [isClientMode]);

  // ---------------------------------------------------------
  // 4. 渲染邏輯
  // ---------------------------------------------------------

  // 如果判定為客戶，直接渲染落地頁，不加載任何後台組件
  if (isClientMode) {
    return <JoinPage />;
  }

  // 檢查登入狀態
  const employeeNames = useMemo(() => users.map(u => u.name), [users]);

  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-10 h-10 text-slate-800 animate-spin" />
      <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase">正在安全載入後台系統...</p>
    </div>
  );
  
  if (!currentUser) return <LoginScreen onLogin={(user) => setCurrentUser(user)} users={users} />;

  return (
    <Layout 
      activeTab={view === 'detail' ? 'projects' : view as any} 
      onTabChange={(v) => { setSelectedProject(null); setView(v); }}
      currentUser={currentUser}
      onLogout={() => { setCurrentUser(null); sessionStorage.removeItem('zewu_mode'); }}
      onExportData={() => {}}
    >
      {view === 'dashboard' && <ProjectDashboard projects={projects} onSelectProject={(p) => { setSelectedProject(p); setView('detail'); }} employeeNames={employeeNames} onFilterClick={() => setView('projects')} />}
      {view === 'crm' && <CRMManager currentUser={currentUser} onConvertToProject={(c) => { setConversionData({ projectName: `${c.name}案`, clientName: c.name, contactPhone: c.phone }); setShowNewProjectModal(true); }} />}
      {view === 'marketing' && <MarketingDashboard metrics={lineMetrics} currentUser={currentUser} />}
      {view === 'changelog' && <SystemChangelog currentUser={currentUser} users={users} />}
      {view === 'team' && <TeamManagement users={users} currentUser={currentUser} onAddUser={(u) => setDoc(doc(db, "users", u.id), u)} onUpdateUser={(u) => setDoc(doc(db, "users", u.id), u)} onDeleteUser={(id) => deleteDoc(doc(db, "users", id))} />}
      {view === 'analytics' && <AnalyticsDashboard projects={projects} />}
      
      {view === 'projects' && !selectedProject && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800">案場列表</h2>
            <button onClick={() => setShowNewProjectModal(true)} className="bg-slate-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black shadow-lg"><Plus className="w-5 h-5" /> 新增案場</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setView('detail'); }} className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full">
                <div className="h-56 bg-slate-100 overflow-hidden relative">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-slate-800">{p.currentStage}</div>
                </div>
                <div className="p-8 flex-1">
                   <h3 className="font-black text-slate-800 line-clamp-1 mb-2 text-xl">{p.projectName}</h3>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{p.assignedEmployee}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'detail' && selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          currentUser={currentUser} 
          onBack={() => { setSelectedProject(null); setView('projects'); }} 
          onUpdateProject={async (p) => setDoc(doc(db, "projects", p.id), p)} 
          onDeleteProject={async (id) => { await deleteDoc(doc(db, "projects", id)); setSelectedProject(null); setView('projects'); }} 
          employeeNames={employeeNames} 
        />
      )}

      {showNewProjectModal && <NewProjectModal initialData={conversionData} currentUser={currentUser} onClose={() => { setShowNewProjectModal(false); setConversionData(null); }} onSubmit={(p) => { setDoc(doc(db, "projects", p.id), p); setShowNewProjectModal(false); setConversionData(null); }} employeeNames={employeeNames} />}
    </Layout>
  );
};

export default App;
