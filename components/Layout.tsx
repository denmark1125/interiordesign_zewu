
import React from 'react';
import { LayoutDashboard, FolderKanban, Menu, X, LogOut, Users, MessageCircle, UserCircle, ShieldAlert } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm';
  onTabChange: (tab: 'dashboard' | 'projects' | 'team' | 'analytics' | 'changelog' | 'marketing' | 'crm') => void;
  currentUser: User;
  onLogout: () => void;
  onExportData: () => void;
}

const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const isEngineer = currentUser.role === 'engineer';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-[#54534d]/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ZewuIcon className="text-[#54534d] h-8 w-8" />
            <h1 className="text-lg font-bold text-[#54534d]">澤物設計</h1>
          </div>
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto font-sans">
          {canViewDashboard && (
            <button onClick={() => { onTabChange('dashboard'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutDashboard className="w-5 h-5 mr-3" /> 總覽儀表板
            </button>
          )}
          <button onClick={() => { onTabChange('projects'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'projects' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <FolderKanban className="w-5 h-5 mr-3" /> 案場管理
          </button>
          
          <div className="my-4 border-t border-slate-100 mx-2"></div>
          <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">自動化與行銷</div>
          
          <button onClick={() => { onTabChange('crm'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'crm' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <UserCircle className="w-5 h-5 mr-3" /> 預約與 CRM
          </button>
          <button onClick={() => { onTabChange('marketing'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'marketing' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <MessageCircle className="w-5 h-5 mr-3" /> LINE 數據分析
          </button>

          {canManageTeam && (
            <>
              <div className="my-4 border-t border-slate-100 mx-2"></div>
              <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">管理設定</div>
              <button onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'team' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Users className="w-5 h-5 mr-3" /> 團隊成員管理
              </button>
              {isEngineer && (
                <button onClick={() => { onTabChange('changelog'); setIsSidebarOpen(false); }} className={`flex items-center w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'changelog' ? 'bg-[#54534d] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <ShieldAlert className="w-5 h-5 mr-3 text-red-400" /> 工程師控制台
                </button>
              )}
            </>
          )}
        </nav>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center font-bold text-sm text-[#54534d] border border-slate-200">
                {currentUser.avatarInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-[#54534d] truncate w-24">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{currentUser.role}</p>
              </div>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[#54534d]"><ZewuIcon className="h-6 w-6" /> 澤物設計</div>
          <button onClick={() => setIsSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
