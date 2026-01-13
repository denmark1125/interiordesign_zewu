
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
const STORAGE_KEY = 'zewu_marketing_source';
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
interface JoinViewProps {
  source: string;
}

const JoinView: React.FC<JoinViewProps> = ({ source }) => {
  const [status, setStatus] = useState('正在初始化...');
  const [error, setError] = useState<string | null>(null);
  const [showManualBtn, setShowManualBtn] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
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
          source: source || 'direct',
          pictureUrl: profile.pictureUrl || '',
          platform: 'ZEWU_CORE_V2',
          createdAt: serverTimestamp(),
          lastSeen: Date.now()
        }, { merge: true });

        // 重要：在跳轉前清除 Storage，避免管理員下次訪問首頁被誤認
        sessionStorage.removeItem(STORAGE_KEY);

        setStatus('即將進入官方帳號...');
        window.location.replace(LINE_OA_URL);
        
        setTimeout(() => setShowManualBtn(true), 3000);

      } catch (err: any) {
        console.error('LIFF Error:', err);
        setError('系統處理中，請點擊下方按鈕');
        setShowManualBtn(true);
      }
    };

    initLiff();
  }, [source]);

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
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              window.location.href = LINE_OA_URL;
            }}
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
  // 1. 同步攔截與持久化偵測
  const [marketingSource] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    
    // 優先權 1: 網址參數 (src= 或 source=)
    let src = params.get('src') || params.get('source');
    
    // 容錯: 如果 URLSearchParams 失敗，使用正則表達式從 href 抓取
    if (!src && url.includes('src=')) {
      const match = url.match(/[?&]src=([^&]+)/);
      if (match) src = decodeURIComponent(match[1]);
    }

    // 如果網址有來源，立即存入 sessionStorage 並回傳
    if (src) {
      sessionStorage.setItem(STORAGE_KEY, src);
      return src;
    }

    // 優先權 2: 檢查 sessionStorage (應對 OAuth 跳轉後的狀態)
    const storedSrc = sessionStorage.getItem(STORAGE_KEY);
    if (storedSrc) return storedSrc;

    // 優先權 3: 路徑判斷
    if (window.location.pathname.includes('/join')) return 'direct_join';

    return null;
  });

  // 判定是否為 LIFF 模式
  const isLiffMode = !!marketingSource;

  // 早期回傳：防止後台程式碼載入
  if (isLiffMode) {
    return <JoinView source={marketingSource!} />;
  }

  // --- 後台管理邏輯 ---
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
