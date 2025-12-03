import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import ProjectDashboard from './components/SiteDashboard';
import ProjectDetail from './components/SiteDetail';
import LoginScreen from './components/LoginScreen';
import NewProjectModal from './components/NewProjectModal';
import TeamManagement from './components/TeamManagement';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SystemChangelog from './components/SystemChangelog';
import { DesignProject, User, ProjectStage } from './types';
import { INITIAL_USERS } from './constants';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';
import { db, usersCollection, projectsCollection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy } from './services/firebase';

// Filter Type Definition
export type ProjectFilterType = 'ALL' | 'CONSTRUCTION' | 'DESIGN_CONTACT' | 'UPCOMING';

// Auto Logout Time: 5 minutes (in milliseconds)
const AUTO_LOGOUT_TIME = 5 * 60 * 1000;

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data State (Managed by Firebase)
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);

  // Auth Actions (Defined early to be used in effects)
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('zewu_user'); // Clear Persistence
    setSelectedProject(null);
    setView('dashboard');
    setProjectFilter('ALL');
  }, []);

  // --- Auth Persistence Logic ---
  useEffect(() => {
    const storedUser = localStorage.getItem('zewu_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('zewu_user');
      }
    }
  }, []);

  // --- Auto Logout Logic (Idle Detection) ---
  useEffect(() => {
    if (!currentUser) return;

    let logoutTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        alert("因閒置超過 5 分鐘，系統已自動登出以確保安全。");
        handleLogout();
      }, AUTO_LOGOUT_TIME);
    };

    // Events to listen for
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initial start
    resetTimer();

    // Cleanup
    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser, handleLogout]);


  // --- FIREBASE SYNC ---
  useEffect(() => {
    // 1. Sync Users
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      
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

    return () => {
      unsubscribeUsers();
      unsubscribeProjects();
    };
  }, []);

  // Derived Data: Employee Names for Dropdowns
  // Priority: Employee (Designer) > Manager > Engineer
  const employeeNames = useMemo(() => {
    return users
      .sort((a, b) => {
        const roleOrder = { 'employee': 1, 'manager': 2, 'engineer': 3 };
        return roleOrder[a.role] - roleOrder[b.role];
      })
      .map(u => u.name);
  }, [users]);

  // View State
  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team' | 'analytics' | 'changelog'>('dashboard');
  const [previousView, setPreviousView] = useState<'dashboard' | 'projects'>('dashboard'); // Memory for "Back" button
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  // Filter State
  const [projectFilter, setProjectFilter] = useState<ProjectFilterType>('ALL');

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('zewu_user', JSON.stringify(user)); // Persist Login
    if (user.role === 'manager' || user.role === 'engineer' || user.canViewDashboard) {
      setView('dashboard');
    } else {
      setView('projects');
    }
  };

  // User Management Actions
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
        localStorage.setItem('zewu_user', JSON.stringify(updatedUser)); // Update Persistence
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
    // Remember where we came from
    if (view === 'dashboard' || view === 'projects') {
      setPreviousView(view);
    }
    setSelectedProject(project);
    setView('detail');
  };

  // New: Handle Filter Click from Dashboard
  const handleDashboardFilterClick = (filterType: ProjectFilterType) => {
    setProjectFilter(filterType);
    setPreviousView('dashboard'); // If we go back from list, go to dashboard
    setView('projects');
  };

  const handleBack = () => {
    setSelectedProject(null);
    // Go back to the remembered previous view
    setView(previousView);
  };

  const handleTabChange = (tab: 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog') => {
    setView(tab);
    if (tab === 'projects') {
        // Reset filter when manually clicking "All Projects" tab
        setProjectFilter('ALL');
    }
    if (tab === 'dashboard' || tab === 'team' || tab === 'analytics' || tab === 'changelog') setSelectedProject(null);
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
      setView(previousView);
    } catch (e) {
      console.error("Error deleting project: ", e);
      alert("刪除專案失敗");
    }
  };

  const handleCreateProject = async (newProject: DesignProject) => {
    try {
      await setDoc(doc(db, "projects", newProject.id), newProject);
      setShowNewProjectModal(false);
      handleSelectProject(newProject);
    } catch (e) {
      console.error("Error creating project: ", e);
      alert("建立專案失敗");
    }
  };

  const handleExportData = () => {
    if (projects.length === 0) {
        alert("目前無資料可匯出");
        return;
    }
    const headers = ['案名', '客戶姓名', '負責人', '目前階段', '預計完工日', '地址', '電話', '最新進度', '客戶需求', '內部備註', '完整時間軸與日誌', '工程進度時程'];
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
        `"${(p.internalNotes || '').replace(/"/g, '""')}"`,
        `"${(p.history || []).map(h => `[${new Date(h.timestamp).toLocaleDateString()} ${h.userName}]: ${h.action}`).join('\n').replace(/"/g, '""')}"`,
        `"${(p.schedule || []).map(s => `${s.phase}: ${s.startDate}~${s.endDate}`).join('\n').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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

  // --- Filter Logic ---
  let displayProjects = (currentUser.role === 'manager' || currentUser.role === 'engineer')
    ? projects
    : projects.filter(p => p.assignedEmployee === currentUser.name);

  // Apply Dashboard Filter
  if (projectFilter === 'CONSTRUCTION') {
    displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.CONSTRUCTION);
  } else if (projectFilter === 'DESIGN_CONTACT') {
    displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT);
  } else if (projectFilter === 'UPCOMING') {
     const today = new Date();
     const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
     displayProjects = displayProjects.filter(p => {
        if (p.currentStage === ProjectStage.COMPLETED) return false;
        const date = new Date(p.estimatedCompletionDate);
        return date >= today && date <= thirtyDaysLater;
     });
  }

  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  
  // Permission for Analytics: Engineer Only
  const isEngineer = currentUser.role === 'engineer';
  const canViewAnalytics = isEngineer; 

  // Helper for filter display name
  const getFilterName = () => {
      switch(projectFilter) {
          case 'CONSTRUCTION': return '施工中案件';
          case 'DESIGN_CONTACT': return '設計/接洽中案件';
          case 'UPCOMING': return '即將完工案件';
          default: return '所有專案列表';
      }
  };

  return (
    <Layout 
      activeTab={view === 'detail' ? 'projects' : view as 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog'} 
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
          onFilterClick={handleDashboardFilterClick}
        />
      )}

      {view === 'analytics' && canViewAnalytics && (
        <AnalyticsDashboard projects={projects} />
      )}

      {view === 'changelog' && isEngineer && (
        <SystemChangelog currentUser={currentUser} users={users} />
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
      
      {view === 'projects' && !selectedProject && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div>
               <div className="flex items-center gap-2">
                 {/* Show Back button if filtered from Dashboard */}
                 {projectFilter !== 'ALL' && (
                    <button onClick={() => setView('dashboard')} className="p-1 hover:bg-slate-100 rounded-full mr-1 text-slate-400">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                 )}
                 <h2 className="text-2xl font-bold text-slate-800">
                    {(currentUser.role === 'manager' || currentUser.role === 'engineer') 
                        ? getFilterName() 
                        : '我的負責案場'
                    }
                 </h2>
               </div>
              <p className="text-slate-500 text-sm mt-1 ml-1">
                共 {displayProjects.length} 個案場
              </p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                {projectFilter !== 'ALL' && (
                    <button 
                        onClick={() => setProjectFilter('ALL')}
                        className="w-full md:w-auto px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors"
                    >
                        清除篩選
                    </button>
                )}
                <button 
                onClick={() => setShowNewProjectModal(true)}
                className="w-full md:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 font-medium"
                >
                <Plus className="w-5 h-5" />
                新增案場
                </button>
            </div>
          </div>

          {displayProjects.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 mb-4 text-lg">目前沒有符合條件的案場</p>
              {projectFilter === 'ALL' && (
                <button 
                    onClick={() => setShowNewProjectModal(true)}
                    className="text-accent hover:underline font-medium"
                >
                    立即建立第一個案場
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