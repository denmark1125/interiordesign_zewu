
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Layout from '../components/Layout';
import ProjectDashboard from '../components/SiteDashboard';
import ProjectDetail from '../components/SiteDetail';
import LoginScreen from '../components/LoginScreen';
import NewProjectModal from '../components/NewProjectModal';
import TeamManagement from '../components/TeamManagement';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import SystemChangelog from '../components/SystemChangelog';
import MarketingDashboard from '../components/MarketingDashboard';
import CRMManager from '../components/CRMManager';
import { DesignProject, User, LineMetric } from '../types';
import { db, usersCollection, projectsCollection, lineMetricsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy } from '../services/firebase';
import { Plus, Loader2 } from 'lucide-react';

export default function AdminPage() {
  // 後台專屬狀態
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>([]);

  // 導航與視圖
  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [conversionData, setConversionData] = useState<Partial<DesignProject> | null>(null);

  // --- 自動登出功能 (5分鐘無操作) ---
  useEffect(() => {
    if (!currentUser) return;

    // Fixed: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> to resolve namespace error in browser environment
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setCurrentUser(null);
        localStorage.removeItem('zewu_user');
        alert('由於您已超過 5 分鐘未操作，系統已自動登出以保護資料安全。');
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser]);

  // 數據監聽
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() as User, id: doc.id })));
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

  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-10 h-10 text-slate-800 animate-spin" />
      <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase">後台資料同步中...</p>
    </div>
  );
  
  if (!currentUser) return <LoginScreen onLogin={(user) => setCurrentUser(user)} users={users} />;

  return (
    <Layout 
      activeTab={view === 'detail' ? 'projects' : view as any} 
      onTabChange={(v) => { setSelectedProject(null); setView(v); }}
      currentUser={currentUser}
      onLogout={() => { setCurrentUser(null); localStorage.removeItem('zewu_user'); }}
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
}
