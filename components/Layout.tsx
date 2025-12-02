
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

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, onExportData }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Permission Checks
  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const canExport = currentUser.role === 'manager' || currentUser.role === 'engineer';

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
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white shadow-2xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2 rounded-lg">
               <PenTool className="text-accent h-6 w-6" />
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-wide leading-none">澤物專案</h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Management</span>
            </div>
          </div>
          <button className="lg:hidden p-1 hover:bg-slate-800 rounded-md transition-colors" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto flex flex-col">
          {canViewDashboard && (
            <button
              onClick={() => { onTabChange('dashboard'); setIsSidebarOpen(false); }}
              className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'dashboard' 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FolderKanban className="h-5 w-5 mr-3" />
            {canViewDashboard ? '所有專案列表' : '我的專案'}
          </button>

          {/* Manager & Engineer can manage team */}
          {canManageTeam && (
            <>
              <div className="my-4 border-t border-slate-800/50 mx-2"></div>
              <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">管理功能</div>
              <button
                onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }}
                className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                  activeTab === 'team' 
                    ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                className="flex items-center w-full px-4 py-3.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-all font-medium text-sm border border-slate-800 hover:border-emerald-900/50 group"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                匯出資料 (CSV)
              </button>
            </div>
          )}
        </nav>
        
        <div className="p-4 bg-slate-950 border-t border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-sm text-white border-2 border-slate-800 shadow-md">
                {currentUser.avatarInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate w-28">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                  {currentUser.role === 'manager' && 'Administrator'}
                  {currentUser.role === 'engineer' && 'System Engineer'}
                  {currentUser.role === 'employee' && 'Designer'}
                </p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
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
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-800">
             <div className="bg-accent/10 p-1.5 rounded-md">
                <PenTool className="text-accent h-5 w-5" />
             </div>
             澤物專案
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 active:bg-slate-100 rounded-full">
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
