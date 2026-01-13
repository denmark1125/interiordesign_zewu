
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
import { DesignProject, User, LineMetric, ProjectStage } from './types';
import { db, usersCollection, projectsCollection, lineMetricsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy } from './services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { Plus, Loader2, MessageCircle, ExternalLink } from 'lucide-react';

// --- 常數設定 ---
const MY_LIFF_ID = "2008826901-DGGr1P8u";
const LINE_OA_URL = "https://lin.ee/GRgdkQe";
declare const liff: any;

// --- 輔助組件：Zewu Logo ---
const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// --- 子組件：LIFF 落地頁 (JoinView) ---
const JoinView: React.FC = () => {
  const [status, setStatus] = useState('正在初始化...');
  const [error, setError] = useState<string | null>(null);
  const [showManualBtn, setShowManualBtn] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const url = window.location.href;
        const params = new URLSearchParams(window.location.search);
        // 如果 search 沒抓到（可能是 hash router），改從 href 抓
        const source = params.get('src') || params.get('source') || 
                      (url.includes('src=') ? url.split('src=')[1].split('&')[0] : 'direct');

        setStatus('正在連接 LINE...');
        await liff.init({ liffId: MY_LIFF_ID });

        if (!liff.isLoggedIn()) {
          setStatus('正在導向登入...');
          liff.login({ redirectUri: window.location.href }); 
          return;
        }

        setStatus('正在同步追蹤數據...');
        const profile = await liff.getProfile();

        // 寫入 Firestore 追蹤
        const userSourceRef = doc(db, "user_sources", profile.userId);
        await setDoc(userSourceRef, {
          userId: profile.userId,
          displayName: profile.displayName,
          lineUserId: profile.displayName,
          source: decodeURIComponent(source),
          pictureUrl: profile.pictureUrl || '',
          platform: 'ZEWU_VITE_CORE',
          createdAt: serverTimestamp(),
          lastSeen: Date.now()
        }, { merge: true });

        setStatus('即將進入官方帳號...');
        window.location.replace(LINE_OA_URL);
        
        // 保險機制：如果三秒後還沒跳轉成功
        setTimeout(() => setShowManualBtn(true), 3000);

      } catch (err: any) {
        console.error('LIFF Error:', err);
        setError('系統處理中，請點擊下方按鈕');
        setShowManualBtn(true);
      }
    };

    initLiff();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center font-sans fixed inset-0 z-[9999]">
      <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 relative">
        <ZewuIcon className="w-12 h-12 text-[#54534d]" />
        <div className="absolute inset-0 border-4 border-[#54534d] border-t-transparent rounded-[40px] animate-spin opacity-20"></div>
      </div>
      <div className="space-y-4 max-w-xs">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">澤物設計</h2>
        <div className="flex items-center justify-center gap-2">
          {error ? (
            <p className="text-red-400 font-bold text-sm tracking-widest">{error}</p>
          ) : (
            <>
              <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
              <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">{status}</p>
            </>
          )}
        </div>
        {showManualBtn && (
          <button 
            onClick={() => window.location.href = LINE_OA_URL}
            className="w-full mt-8 bg-[#06C755] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            點此加入 LINE 好友
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// --- 主組件 (App) ---
const App: React.FC = () => {
  // 1. 同步攔截 (Synchronous Hijacking)
  // 使用惰性初始化，在組件掛載前立即判斷模式
  const [isLiffMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      // 只要網址包含 src=, source= 或路徑含有 join 則視為 LIFF 模式
      return url.includes('src=') || url.includes('source=') || url.includes('/join');
    }
    return false;
  });

  // 2. LIFF 模式早期回傳 (Early Return)
  // 這能防止後台組件、Firebase 監聽器被初始化
  if (isLiffMode) {
    return <JoinView />;
  }

  // --- 以下為後台管理系統邏輯 (只有管理員會看到) ---

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('zewu_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>([]);

  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [conversionData, setConversionData] = useState<Partial<DesignProject> | null>(null);

  // 資料監聽
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

  // 管理後台渲染邏輯
  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4 font-sans text-center">
      <div className="w-12 h-12 relative">
        <ZewuIcon className="w-12 h-12 text-slate-200" />
        <Loader2 className="w-12 h-12 text-slate-800 animate-spin absolute top-0 left-0" />
      </div>
      <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase mt-2">安全加密同步中...</p>
    </div>
  );
  
  if (!currentUser) return (
    <LoginScreen 
      onLogin={(user) => {
        setCurrentUser(user);
        localStorage.setItem('zewu_user', JSON.stringify(user));
      }} 
      users={users} 
    />
  );

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
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">案場列表</h2>
            <button onClick={() => setShowNewProjectModal(true)} className="bg-slate-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black shadow-lg hover:bg-slate-700 transition-all"><Plus className="w-5 h-5" /> 新增案場</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setView('detail'); }} className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full">
                <div className="h-56 bg-slate-100 overflow-hidden relative">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-slate-800">{p.currentStage}</div>
                </div>
                <div className="p-8 flex-1">
                   <h3 className="font-black text-slate-800 line-clamp-1 mb-2 text-xl tracking-tight">{p.projectName}</h3>
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
