
import React, { useRef } from 'react';
import { LayoutDashboard, FolderKanban, Settings, Menu, X, LogOut, Users, Download, Upload, CloudCog, BarChart3, GitBranch } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog';
  onTabChange: (tab: 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog') => void;
  currentUser: User;
  onLogout: () => void;
  onExportData: () => void;
}

// Custom Zewu Icon (Consistent with LoginScreen)
const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, onExportData }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Permission Checks
  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const canExport = currentUser.role === 'manager' || currentUser.role === 'engineer';
  
  // Engineer-only Permissions
  const isEngineer = currentUser.role === 'engineer';
  const canViewAnalytics = isEngineer; // Analytics restricted to Engineer

  const handleLogoClick = () => {
     if (canViewDashboard) {
         onTabChange('dashboard');
     } else {
         onTabChange('projects');
     }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#54534d]/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - White Background with #54534d Accents */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 text-[#54534d] shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={handleLogoClick}
          >
            <div className="group-hover:scale-105 transition-transform">
               <ZewuIcon className="text-[#54534d] h-8 w-8" />
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-wide leading-none text-[#54534d]">澤物設計</h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Project Manager</span>
            </div>
          </div>
          <button className="lg:hidden p-1 hover:bg-slate-100 rounded-md transition-colors" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto flex flex-col">
          {canViewDashboard && (
            <button
              onClick={() => { onTabChange('dashboard'); setIsSidebarOpen(false); }}
              className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'dashboard' 
                  ? 'bg-[#54534d] text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-[#54534d]'
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
                ? 'bg-[#54534d] text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-[#54534d]'
            }`}
          >
            <FolderKanban className="h-5 w-5 mr-3" />
            {canViewDashboard ? '所有專案列表' : '我的專案'}
          </button>

          {/* Manager & Engineer can manage team and view logs/analytics */}
          {canManageTeam && (
            <>
              <div className="my-4 border-t border-slate-100 mx-2"></div>
              <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">管理功能</div>
              <button
                onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }}
                className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                  activeTab === 'team' 
                    ? 'bg-[#54534d] text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-[#54534d]'
                }`}
              >
                <Users className="h-5 w-5 mr-3" />
                團隊成員管理
              </button>

              {/* Analytics - Engineer Only - Moved to Management Section */}
              {canViewAnalytics && (
                <button
                  onClick={() => { onTabChange('analytics'); setIsSidebarOpen(false); }}
                  className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                    activeTab === 'analytics' 
                      ? 'bg-[#54534d] text-white shadow-md' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-[#54534d]'
                  }`}
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  營運數據分析
                </button>
              )}

              {/* System Changelog - Engineer Only */}
              {isEngineer && (
                <button
                  onClick={() => { onTabChange('changelog'); setIsSidebarOpen(false); }}
                  className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                    activeTab === 'changelog' 
                      ? 'bg-[#54534d] text-white shadow-md' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-[#54534d]'
                  }`}
                >
                  <GitBranch className="h-5 w-5 mr-3" />
                  系統開發日誌
                </button>
              )}
            </>
          )}

          {/* Export Button (Pushed to bottom of nav) */}
          {canExport && (
            <div className="mt-auto pt-4">
               <button
                onClick={() => { onExportData(); setIsSidebarOpen(false); }}
                className="flex items-center w-full px-4 py-3.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-[#54534d] transition-all font-medium text-sm border border-slate-200 hover:border-slate-300 group"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                匯出資料 (CSV)
              </button>
            </div>
          )}
        </nav>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center font-bold text-sm text-[#54534d] border border-slate-200 shadow-sm">
                {currentUser.avatarInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-[#54534d] truncate w-28">{currentUser.name}</p>
                <p className="text-xs text-slate-400 capitalize flex items-center gap-1">
                  {currentUser.role === 'manager' && 'Administrator'}
                  {currentUser.role === 'engineer' && 'System Engineer'}
                  {currentUser.role === 'employee' && 'Designer'}
                </p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
              title="登出"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header - Adjusted for Z-Index and Brand Color */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between relative z-30 shadow-sm">
          <div 
            className="flex items-center gap-2 font-bold text-[#54534d] cursor-pointer"
            onClick={handleLogoClick}
          >
             <ZewuIcon className="text-[#54534d] h-6 w-6" />
             澤物設計
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 active:bg-slate-100 rounded-full transition-colors">
            <Menu className="h-6 w-6 text-[#54534d]" />
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