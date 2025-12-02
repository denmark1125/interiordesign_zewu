
import React, { useState, useMemo, useEffect } from 'react';
import Layout from './components/Layout';
import ProjectDashboard from './components/SiteDashboard';
import ProjectDetail from './components/SiteDetail';
import LoginScreen from './components/LoginScreen';
import NewProjectModal from './components/NewProjectModal';
import TeamManagement from './components/TeamManagement';
import { DesignProject, User, ProjectStage } from './types';
import { INITIAL_USERS } from './constants'; // 只在第一次初始化資料庫時使用
import { Plus, Loader2, Filter, XCircle } from 'lucide-react';
import { db, usersCollection, projectsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy } from './services/firebase';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial data fetch

  // Data State (Managed by Firebase)
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    // 1. Sync Users
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      
      // Initial Seed: If database is empty, add default users
      if (fetchedUsers.length === 0) {
        INITIAL_USERS.forEach(async (u) => {
          await setDoc(doc(db, "users", u.id), u);
        });
      } else {
        setUsers(fetchedUsers);
      }
    });

    // 2. Sync Projects
    const unsubscribeProjects = onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), (snapshot) => {
      const fetchedProjects = snapshot.docs.map(doc => doc.data() as DesignProject);
      setProjects(fetchedProjects);
      setIsLoading(false);
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeUsers();
      unsubscribeProjects();
    };
  }, []);

  // Derived Data
  const employeeNames = useMemo(() => 
    users.filter(u => u.role === 'employee').map(u => u.name), 
    [users]
  );

  // View State
  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team'>('dashboard');
  const [lastView, setLastView] = useState<'dashboard' | 'projects' | 'team'>('dashboard'); // 用於「返回」功能的記憶
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  // Filter State (新功能：專案列表篩選)
  // 'ALL' = 全部, 'DESIGN_GROUP' = 設計+接洽, 其他則是具體的 ProjectStage
  const [projectFilter, setProjectFilter] = useState<string>('ALL');

  // Auth Actions
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'manager' || user.role === 'engineer' || user.canViewDashboard) {
      setView('dashboard');
    } else {
      setView('projects');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedProject(null);
    setView('dashboard');
    setProjectFilter('ALL');
  };

  // User Management Actions (Firebase)
  const handleAddUser = async (newUser: User) => {
    try {
      await setDoc(doc(db, "users", newUser.id), newUser);
    } catch (e) {
      console.error("Error adding user: ", e);
      alert("新增使用者失敗，請檢查網路連線");
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      await setDoc(doc(db, "users", updatedUser.id), updatedUser);
      if (currentUser?.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
    } catch (e) {
      console.error("Error updating user: ", e);
      alert("更新使用者失敗");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (e) {
      console.error("Error deleting user: ", e);
      alert("刪除使用者失敗");
    }
  };

  // Project Actions
  const handleSelectProject = (project: DesignProject) => {
    if (view !== 'detail') {
      setLastView(view); // 記住現在在哪一頁 (Dashboard 或 Projects)
    }
    setSelectedProject(project);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedProject(null);
    setView(lastView); // 回到上一頁 (若是從儀表板點進來，就回儀表板；從列表點進來，就回列表)
  };

  const handleTabChange = (tab: 'dashboard' | 'projects' | 'team') => {
    setView(tab);
    if (tab === 'projects') {
      setProjectFilter('ALL'); // 手動切換到列表時，預設顯示全部
    }
    if (tab === 'dashboard' || tab === 'team') setSelectedProject(null);
  };

  // 儀表板卡片點擊處理
  const handleDashboardCardClick = (type: 'ALL' | 'CONSTRUCTION' | 'DESIGN_GROUP' | 'URGENT') => {
    setProjectFilter(type);
    setView('projects');
  };

  const handleUpdateProject = async (updatedProject: DesignProject) => {
    try {
      await setDoc(doc(db, "projects", updatedProject.id), updatedProject);
      setSelectedProject(updatedProject); 
    } catch (e) {
      console.error("Error updating project: ", e);
      alert("更新專案失敗，請檢查網路");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteDoc(doc(db, "projects", projectId));
      setSelectedProject(null);
      setView(lastView); // 刪除後回到上一頁
    } catch (e) {
      console.error("Error deleting project: ", e);
      alert("刪除專案失敗");
    }
  };

  const handleCreateProject = async (newProject: DesignProject) => {
    try {
      await setDoc(doc(db, "projects", newProject.id), newProject);
      setShowNewProjectModal(false);
      
      // 新增後直接進入詳情，並設定返回頁面為列表
      setLastView('projects');
      setProjectFilter('ALL');
      setSelectedProject(newProject);
      setView('detail');
    } catch (e) {
      console.error("Error creating project: ", e);
      alert("建立專案失敗");
    }
  };

  // Data Export Logic (CSV)
  const handleExportData = () => {
    if (projects.length === 0) {
        alert("目前無資料可匯出");
        return;
    }

    const headers = [
        '案名', '客戶姓名', '負責人', '目前階段', '預計完工日', '地址', '電話', '最新進度', '客戶需求', '內部備註'
    ];

    const rows = projects.map(p => [
        p.projectName,
        p.clientName,
        p.assignedEmployee,
        p.currentStage,
        p.estimatedCompletionDate,
        p.address,
        p.contactPhone,
        `"${(p.latestProgressNotes || '').replace(/"/g, '""')}"`, 
        `"${(p.clientRequests || '').replace(/"/g, '""')}"`,
        `"${(p.internalNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `澤物專案_匯出_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-slate-500 font-bold">正在連線至雲端資料庫...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} />;
  }

  // 權限檢查與資料過濾
  const baseProjects = (currentUser.role === 'manager' || currentUser.role === 'engineer')
    ? projects
    : projects.filter(p => p.assignedEmployee === currentUser.name);

  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';

  // 根據 projectFilter 篩選顯示的專案
  const displayProjects = baseProjects.filter(p => {
    if (projectFilter === 'ALL' || projectFilter === 'URGENT') return true; // URGENT 只是跳轉，這邊先顯示全部，UI 上會另外標示或排序
    if (projectFilter === 'DESIGN_GROUP') return p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT;
    if (projectFilter === 'CONSTRUCTION') return p.currentStage === ProjectStage.CONSTRUCTION;
    return true;
  });

  // 篩選標題顯示
  const getFilterTitle = () => {
    switch (projectFilter) {
      case 'CONSTRUCTION': return '施工中案場';
      case 'DESIGN_GROUP': return '設計與接洽中案場';
      case 'URGENT': return '所有案場 (包含即將完工)';
      default: return (currentUser.role === 'manager' || currentUser.role === 'engineer') ? '所有專案列表' : '我的負責案場';
    }
  };

  return (
    <Layout 
      activeTab={view === 'detail' ? lastView : view as 'dashboard' | 'projects' | 'team'} 
      onTabChange={handleTabChange}
      currentUser={currentUser}
      onLogout={handleLogout}
      onExportData={handleExportData}
    >
      {view === 'dashboard' && canViewDashboard && (
        <ProjectDashboard 
          projects={projects} 
          onSelectProject={handleSelectProject} 
          employeeNames={employeeNames}
          onCardClick={handleDashboardCardClick}
        />
      )}

      {view === 'team' && canManageTeam && (
        <TeamManagement 
          users={users}
          currentUser={currentUser}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />
      )}
      
      {view === 'projects' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  {getFilterTitle()}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  共 {displayProjects.length} 個案場
                </p>
              </div>
              {projectFilter !== 'ALL' && (
                <button 
                  onClick={() => setProjectFilter('ALL')}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                >
                  <XCircle className="w-4 h-4" /> 清除篩選
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setShowNewProjectModal(true)}
              className="w-full md:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 font-medium"
            >
              <Plus className="w-5 h-5" />
              新增案場
            </button>
          </div>

          {displayProjects.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 mb-4 text-lg">此分類下目前沒有案場資料</p>
              {projectFilter === 'ALL' && (
                <button 
                  onClick={() => setShowNewProjectModal(true)}
                  className="text-accent hover:underline font-medium"
                >
                  立即建立第一個案場
                </button>
              )}
               {projectFilter !== 'ALL' && (
                <button 
                  onClick={() => setProjectFilter('ALL')}
                  className="text-accent hover:underline font-medium"
                >
                  查看所有案場
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayProjects.map(project => (
                <div 
                  key={project.id} 
                  onClick={() => handleSelectProject(project)}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"
                >
                  <div className="h-48 bg-slate-100 overflow-hidden relative">
                    <img src={project.imageUrl} alt={project.projectName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent opacity-60"></div>
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm backdrop-blur-md ${
                        project.currentStage === '施工中' ? 'bg-amber-500/90 text-white' :
                        project.currentStage === '已完工' ? 'bg-emerald-500/90 text-white' :
                        'bg-white/90 text-slate-800'
                      }`}>
                        {project.currentStage}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-1">{project.projectName}</h3>
                    <p className="text-slate-500 text-sm mb-4">{project.assignedEmployee} | {project.clientName}</p>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 text-sm flex justify-between items-center text-slate-400">
                      <span className="text-xs">
                        更新: {new Date(project.lastUpdatedTimestamp).toLocaleDateString()}
                      </span>
                      <span className="text-accent font-medium text-xs bg-amber-50 px-2 py-1 rounded group-hover:bg-accent group-hover:text-white transition-colors">
                        查看詳情 &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          currentUser={currentUser}
          onBack={handleBack}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          employeeNames={employeeNames}
        />
      )}

      {showNewProjectModal && (
        <NewProjectModal 
          currentUser={currentUser}
          onClose={() => setShowNewProjectModal(false)} 
          onSubmit={handleCreateProject}
          employeeNames={employeeNames}
        />
      )}
    </Layout>
  );
};

export default App;
