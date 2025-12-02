
import React, { useRef } from 'react';
import { LayoutDashboard, FolderKanban, Settings, PenTool, Menu, X, LogOut, Users, Download, Upload, CloudCog } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'projects' | 'team';
  onTabChange: (tab: 'dashboard' | 'projects' | 'team') => void;
  currentUser: User;
  onLogout: () => void;
  onExportData: () => void;
}

// Inline ZewuIcon to ensure availability in Layout
const ZewuIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="80" height="110" stroke="currentColor" strokeWidth="3"/>
    <path d="M10 70 C 30 70, 40 60, 90 60" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 85 C 30 85, 50 75, 90 85" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 100 C 40 100, 60 110, 90 100" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, onExportData }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Permission Checks
  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const canExport = currentUser.role === 'manager' || currentUser.role === 'engineer';

  const handleLogoClick = () => {
    if (canViewDashboard) {
        onTabChange('dashboard');
    } else {
        onTabChange('projects');
    }
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#54534d] text-white shadow-2xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={handleLogoClick}
          >
            <div className="w-8 h-10 text-white">
               <ZewuIcon />
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-wide leading-none">澤物設計</h1>
                <span className="text-[10px] text-white/60 font-medium tracking-widest uppercase">Management</span>
            </div>
          </div>
          <button className="lg:hidden p-1 hover:bg-white/10 rounded-md transition-colors" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto flex flex-col">
          {canViewDashboard && (
            <button
              onClick={() => { onTabChange('dashboard'); setIsSidebarOpen(false); }}
              className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'dashboard' 
                  ? 'bg-white/20 text-white shadow-lg' 
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-5 w-5 mr-3" />
              總覽儀表板
            </button>
          )}
          
          <button
            onClick={() => { onTabChange('projects'); setIsSidebarOpen(false); }}
            className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
              activeTab === 'projects' 
                ? 'bg-white/20 text-white shadow-lg' 
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FolderKanban className="h-5 w-5 mr-3" />
            {canViewDashboard ? '所有專案列表' : '我的專案'}
          </button>

          {/* Manager & Engineer can manage team */}
          {canManageTeam && (
            <>
              <div className="my-4 border-t border-white/10 mx-2"></div>
              <div className="px-4 text-xs font-bold text-white/40 uppercase tracking-wider mb-2">管理功能</div>
              <button
                onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }}
                className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                  activeTab === 'team' 
                    ? 'bg-white/20 text-white shadow-lg' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Users className="h-5 w-5 mr-3" />
                團隊成員管理
              </button>
            </>
          )}

          {/* Export Button (Pushed to bottom of nav) */}
          {canExport && (
            <div className="mt-auto pt-4">
               <button
                onClick={() => { onExportData(); setIsSidebarOpen(false); }}
                className="flex items-center w-full px-4 py-3.5 rounded-xl text-white/70 hover:bg-white/10 hover:text-emerald-300 transition-all font-medium text-sm border border-white/10 hover:border-emerald-500/50 group"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                匯出資料 (CSV)
              </button>
            </div>
          )}
        </nav>
        
        <div className="p-4 bg-[#43423d] border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm text-white border border-white/10 shadow-md">
                {currentUser.avatarInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate w-28">{currentUser.name}</p>
                <p className="text-xs text-white/50 capitalize flex items-center gap-1">
                  {currentUser.role === 'manager' && 'Administrator'}
                  {currentUser.role === 'engineer' && 'System Engineer'}
                  {currentUser.role === 'employee' && 'Designer'}
                </p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              title="登出"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div 
            className="flex items-center gap-2 font-bold text-[#54534d] cursor-pointer"
            onClick={handleLogoClick}
          >
             <div className="h-8 w-6 text-[#54534d]">
                <ZewuIcon />
             </div>
             澤物設計
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 -mr-2 active:bg-slate-100 rounded-full hover:bg-slate-50 transition-colors"
          >
            <Menu className="h-6 w-6 text-slate-700" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
