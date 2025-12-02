
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { LayoutDashboard, FolderKanban, Users, Download, PenTool, Menu, X, LogOut, CheckCircle, Clock, Briefcase, AlertTriangle, Filter, ChevronRight, ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, Plus, User as UserIcon, Lock, ArrowRight as ArrowRightIcon, AlertCircle, UserCog, ShieldCheck, HardHat, Eye, Key, Edit2, Upload, Camera, RefreshCw, Image as ImageIcon, ListChecks, Share, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GoogleGenAI, Type } from "@google/genai";
import html2canvas from 'html2canvas';

// ==========================================
// 1. TYPES & CONSTANTS
// ==========================================

export enum ProjectStage {
  CONTACT = '接洽中',
  DESIGN = '設計中',
  CONSTRUCTION = '施工中',
  ACCEPTANCE = '待驗收',
  COMPLETED = '已完工'
}

export interface HistoryLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: string;     // e.g., "更新進度", "修改客戶需求"
  details: string;    // e.g., "從 A 改為 B" (可選)
  field?: string;     // 改變的欄位名稱
  oldValue?: string;
  newValue?: string;
}

export interface DesignProject {
  id: string;
  projectName: string;
  clientName: string;
  assignedEmployee: string;
  estimatedCompletionDate: string;
  currentStage: ProjectStage;
  latestProgressNotes: string;
  clientRequests: string;
  internalNotes: string;
  lastUpdatedTimestamp: number;
  address: string;
  contactPhone: string;
  imageUrl: string;
  history: HistoryLog[];
}

export type UserRole = 'manager' | 'employee' | 'engineer';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  avatarInitials: string;
  canViewDashboard?: boolean;
}

export type ProjectFilterType = 'ALL' | 'CONSTRUCTION' | 'DESIGN_CONTACT' | 'UPCOMING';

export const INITIAL_USERS: User[] = [
  { id: 'admin', name: '老闆/管理員', username: 'admin', password: '1234', role: 'manager', avatarInitials: 'Boss', canViewDashboard: true },
  { id: 'eng1', name: '系統工程師', username: 'engineer', password: '1234', role: 'engineer', avatarInitials: 'Eng', canViewDashboard: true },
  { id: 'u1', name: '王小明', username: 'wang', password: '1234', role: 'employee', avatarInitials: '王', canViewDashboard: true },
  { id: 'u2', name: '李雅婷', username: 'lee', password: '1234', role: 'employee', avatarInitials: '李', canViewDashboard: false },
  { id: 'u3', name: '陳志豪', username: 'chen', password: '1234', role: 'employee', avatarInitials: '陳', canViewDashboard: false },
];

export const CONSTRUCTION_PHASES = [
  '保護工程', '拆除工程', '泥作工程', '水電工程', '空調/管線', '木作工程', '油漆工程',
  '系統櫃安裝', '石材/磁磚', '燈具/玻璃', '地板工程', '細部清潔', '家具軟裝',
  '驗收缺失改善', '完工交付', '其他事項'
];

export const DEFAULT_PROJECT_COVERS = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
];

// --- Custom SVG Logo Component ---
const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Frame */}
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    
    {/* Stylized Waves */}
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ==========================================
// 2. FIREBASE SERVICE
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyD9PObC6An5d6Zl41Y3bBRgXh0KyFUdx2I",
  authDomain: "zewu-a6e5d.firebaseapp.com",
  projectId: "zewu-a6e5d",
  storageBucket: "zewu-a6e5d.firebasestorage.app",
  messagingSenderId: "832889344248",
  appId: "1:832889344248:web:a8652243e91fc085112b0d",
  measurementId: "G-36LJQSCXCW"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const storage = getStorage(app);

export const usersCollection = collection(db, "users");
export const projectsCollection = collection(db, "projects");

// ==========================================
// 3. UTILS & AI SERVICE
// ==========================================

// --- AI Client Helper (Lazy Init & APK Fallback) ---
const getAIClient = () => {
  // Try getting from Env (Web/Vercel)
  let apiKey = process.env.API_KEY;
  
  // Fallback for APK/Mobile where process.env might fail
  if (!apiKey) {
      // Hardcoded key for APK stability as requested by user
      apiKey = "AIzaSyD5y1wnTV3bsZ85Dg-PO3TGcHWADQem7Rk"; 
  }
  
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateProjectReport = async (project: DesignProject): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `
    請為以下室內設計專案撰寫一份專業的週報：
    
    專案名稱：${project.projectName}
    目前階段：${project.currentStage}
    負責人員：${project.assignedEmployee}
    
    本週最新進度：
    ${project.latestProgressNotes}

    客戶需求：
    ${project.clientRequests}

    內部備註：
    ${project.internalNotes}

    請包含：
    1. 本週進度摘要
    2. 下週預計事項
    3. 注意事項 (基於客戶需求與內部備註)
    
    語氣請專業、簡潔。`;

    // Use gemini-2.5-flash for speed and stability
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "AI 無法生成報告內容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 服務暫時無法使用 (請檢查網路或 API Key)。";
  }
};

export const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<{analysis: string, suggestions: string[]}> => {
  try {
    const ai = getAIClient();
    const prompt = `
    針對以下室內設計專案問題進行分析與建議：
    專案：${project.projectName} (${project.currentStage})
    問題：${inputContent}
    `;

    // Use gemini-2.5-flash for reliability
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            suggestions: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["analysis", "suggestions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      analysis: "目前無法進行 AI 分析，請稍後再試。",
      suggestions: ["建議諮詢專業技師", "確認現場施工圖面", "與業主討論替代方案"]
    };
  }
};

const validateImageFile = (file: File): boolean => {
  // 2MB Limit
  const MAX_SIZE = 2 * 1024 * 1024; 
  if (file.size > MAX_SIZE) {
    alert(`圖片過大 (${(file.size / 1024 / 1024).toFixed(2)}MB)。請上傳小於 2MB 的圖片。`);
    return false;
  }
  return true;
};

const uploadImageFile = async (file: File): Promise<string> => {
  try {
    const storageRef = ref(storage, `project-covers/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error("圖片上傳失敗");
  }
};

// ==========================================
// 4. COMPONENTS
// ==========================================

// --- Login Screen ---
const LoginScreen: React.FC<{ onLogin: (user: User) => void; users: User[] }> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = users.find(u => u.username === username);
    if (user && user.password === password) {
      onLogin(user);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-xl border border-slate-100">
           <ZewuIcon className="w-16 h-16 text-[#54534d]" />
        </div>
        <h1 className="text-3xl font-bold text-[#54534d] tracking-tight">澤物設計</h1>
        <p className="text-[#54534d]/70 mt-2 font-light tracking-widest text-sm">ZEWU INTERIOR DESIGN</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">員工登入</h2>
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900"
                placeholder="請輸入帳號"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900"
                placeholder="請輸入密碼"
              />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-[#54534d] hover:bg-[#3e3d39] text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            登入系統 <ArrowRightIcon className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Layout ---
interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'projects' | 'team';
  onTabChange: (tab: 'dashboard' | 'projects' | 'team') => void;
  currentUser: User;
  onLogout: () => void;
  onExportData: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, onExportData }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const canExport = currentUser.role === 'manager' || currentUser.role === 'engineer';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white text-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out border-r border-slate-200
        lg:translate-x-0 lg:static lg:inset-auto lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex items-center justify-center">
                <ZewuIcon className="w-full h-full text-[#54534d]" />
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
                  ? 'bg-[#54534d] text-white shadow-lg shadow-slate-400/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
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
                ? 'bg-[#54534d] text-white shadow-lg shadow-slate-400/20' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FolderKanban className="h-5 w-5 mr-3" />
            {canViewDashboard ? '所有專案列表' : '我的專案'}
          </button>

          {canManageTeam && (
            <>
              <div className="my-4 border-t border-slate-100 mx-2"></div>
              <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">管理功能</div>
              <button
                onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }}
                className={`flex items-center w-full px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${
                  activeTab === 'team' 
                    ? 'bg-[#54534d] text-white shadow-lg shadow-slate-400/20' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Users className="h-5 w-5 mr-3" />
                團隊成員管理
              </button>
            </>
          )}

          {canExport && (
            <div className="mt-auto pt-4">
               <button
                onClick={() => { onExportData(); setIsSidebarOpen(false); }}
                className="flex items-center w-full px-4 py-3.5 rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-medium text-sm border border-slate-200 hover:border-emerald-200 group"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                匯出資料 (CSV)
              </button>
            </div>
          )}
        </nav>
        
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-600 border border-slate-300">
                {currentUser.avatarInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-800 truncate w-28">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                  {currentUser.role === 'manager' && 'Administrator'}
                  {currentUser.role === 'engineer' && 'System Engineer'}
                  {currentUser.role === 'employee' && 'Designer'}
                </p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-200 rounded-lg"
              title="登出"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[#54534d]">
             <div className="w-6 h-6">
               <ZewuIcon className="w-full h-full text-[#54534d]" />
             </div>
             澤物設計
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

// --- Project Dashboard ---
interface DashboardProps {
  projects: DesignProject[];
  onSelectProject: (project: DesignProject) => void;
  selectedEmployeeFilter: string; // Passed from App
  onFilterClick: (filter: ProjectFilterType) => void;
}

const ProjectDashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, selectedEmployeeFilter, onFilterClick }) => {
  // Use projects directly - filtering is handled by App before passing projects, OR we filter here based on logic.
  // BUT the requirements say Dashboard Filter controls the List View.
  // So here we display stats based on 'selectedEmployeeFilter' to be consistent.
  
  const filteredProjects = selectedEmployeeFilter === 'All' 
    ? projects 
    : projects.filter(p => p.assignedEmployee === selectedEmployeeFilter);

  const stageCounts = filteredProjects.reduce((acc, p) => {
    acc[p.currentStage] = (acc[p.currentStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: ProjectStage.CONTACT, value: stageCounts[ProjectStage.CONTACT] || 0, color: '#94a3b8' }, 
    { name: ProjectStage.DESIGN, value: stageCounts[ProjectStage.DESIGN] || 0, color: '#3b82f6' }, 
    { name: ProjectStage.CONSTRUCTION, value: stageCounts[ProjectStage.CONSTRUCTION] || 0, color: '#f59e0b' }, 
    { name: ProjectStage.ACCEPTANCE, value: stageCounts[ProjectStage.ACCEPTANCE] || 0, color: '#a855f7' }, 
    { name: ProjectStage.COMPLETED, value: stageCounts[ProjectStage.COMPLETED] || 0, color: '#10b981' }, 
  ].filter(d => d.value > 0);

  const stats = [
    { label: '負責案場總數', value: filteredProjects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', ring: 'ring-slate-50', filterType: 'ALL' as ProjectFilterType },
    { label: '施工中案場', value: stageCounts[ProjectStage.CONSTRUCTION] || 0, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', ring: 'ring-amber-50', filterType: 'CONSTRUCTION' as ProjectFilterType },
    { label: '設計/接洽中', value: (stageCounts[ProjectStage.DESIGN] || 0) + (stageCounts[ProjectStage.CONTACT] || 0), icon: Clock, color: 'bg-blue-100 text-blue-600', ring: 'ring-blue-50', filterType: 'DESIGN_CONTACT' as ProjectFilterType },
    { label: '即將完工 (30天內)', value: filteredProjects.filter(p => {
       if (p.currentStage === ProjectStage.COMPLETED) return false;
       const today = new Date();
       const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
       const d = new Date(p.estimatedCompletionDate);
       return d >= today && d <= thirtyDaysLater;
    }).length, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', ring: 'ring-purple-50', filterType: 'UPCOMING' as ProjectFilterType },
  ];

  // For the list below, show ALL projects sorted by stage status priority (Construction > Design > Others)
  const sortedListProjects = [...filteredProjects].sort((a, b) => {
      // Custom sort order
      const stageOrder = { 
          [ProjectStage.CONSTRUCTION]: 1, 
          [ProjectStage.DESIGN]: 2, 
          [ProjectStage.CONTACT]: 3, 
          [ProjectStage.ACCEPTANCE]: 4, 
          [ProjectStage.COMPLETED]: 5 
      };
      return (stageOrder[a.currentStage] || 99) - (stageOrder[b.currentStage] || 99);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">總覽儀表板</h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedEmployeeFilter === 'All' ? '全公司案場即時數據' : `${selectedEmployeeFilter} 的案場數據`}
          </p>
        </div>
        {/* Filter selector is in App.tsx header now, or passed down? 
            Requirement said "Dashboard Filter logic moved to App". 
            We just display the result here. Control is via App header/selector.
        */}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <button 
            key={idx} 
            onClick={() => onFilterClick(stat.filterType)}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] text-left group"
          >
            <div className={`p-3 rounded-xl w-fit ${stat.color} mb-3 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
              <div className="flex justify-between items-center mt-1">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{stat.label}</p>
                 <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6 text-lg">案場階段分佈</h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}/>
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-slate-600 text-xs font-medium ml-1">{value}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
            <ListChecks className="w-5 h-5 text-slate-600" />
            所有案場列表 (依狀態排序)
          </h3>
          <div className="flex-1 overflow-auto max-h-[400px]">
             {/* Desktop Table View */}
            <table className="w-full text-sm text-left hidden md:table">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 rounded-lg sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg font-bold">案名</th>
                  <th className="px-4 py-3 font-bold">負責人</th>
                  <th className="px-4 py-3 font-bold">階段</th>
                  <th className="px-4 py-3 font-bold">預計完工</th>
                  <th className="px-4 py-3 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedListProjects.length === 0 ? (
                   <tr><td colSpan={5} className="text-center py-10 text-slate-400">目前無案場資料</td></tr>
                ) : (
                  sortedListProjects.map(project => (
                    <tr key={project.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onSelectProject(project)}>
                      <td className="px-4 py-3.5 font-bold text-slate-900">{project.projectName}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{project.assignedEmployee}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                          project.currentStage === ProjectStage.DESIGN ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {project.currentStage}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-900 font-bold">{project.estimatedCompletionDate}</td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
              {sortedListProjects.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 text-sm">目前無案場資料</div>
              ) : (
                sortedListProjects.map(project => (
                  <div key={project.id} onClick={() => onSelectProject(project)} className="p-4 rounded-xl bg-slate-50 border border-slate-100 active:bg-slate-100 active:scale-[0.98] transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-slate-900 line-clamp-1 text-base">{project.projectName}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {project.currentStage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
                       <span>{project.assignedEmployee}</span>
                       <span className="font-mono text-slate-900 font-bold">完工: {project.estimatedCompletionDate}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Project Detail ---
interface ProjectDetailProps {
  project: DesignProject;
  currentUser: User;
  onBack: () => void;
  onUpdateProject: (updatedProject: DesignProject) => void;
  onDeleteProject: (projectId: string) => void;
  employeeNames: string[];
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, onDeleteProject, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ai'>('details');
  const [formData, setFormData] = useState<DesignProject>(project);
  
  const [progressCategory, setProgressCategory] = useState<string>(CONSTRUCTION_PHASES[0]);
  const [progressDescription, setProgressDescription] = useState<string>('');

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [issueInput, setIssueInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{analysis: string, suggestions: string[]} | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);

  // Sync if project prop updates (e.g. background sync)
  useEffect(() => {
    setFormData(project);
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) {
        e.target.value = ''; // Reset input
        return;
    }

    setIsUploading(true);
    try {
        const url = await uploadImageFile(file);
        const updatedProject = { ...formData, imageUrl: url, lastUpdatedTimestamp: Date.now() };
        setFormData(updatedProject);
        onUpdateProject(updatedProject);
        alert('封面照片已更新');
    } catch (error) {
        alert('上傳失敗');
    } finally {
        setIsUploading(false);
        e.target.value = ''; // Reset
    }
  };

  const handleAddProgress = () => {
    if (!progressDescription.trim()) {
      alert('請輸入進度描述');
      return;
    }

    const timestamp = Date.now();
    const newNote = `【${progressCategory}】${progressDescription}`;

    const newLog: HistoryLog = {
      id: `h-${timestamp}`,
      timestamp: timestamp,
      userId: currentUser.id,
      userName: currentUser.name,
      action: progressCategory,
      details: progressDescription,
      field: 'latestProgressNotes',
      oldValue: formData.latestProgressNotes,
      newValue: newNote
    };

    const updatedProject = {
      ...formData,
      latestProgressNotes: newNote,
      lastUpdatedTimestamp: timestamp,
      history: [newLog, ...(formData.history || [])]
    };

    setFormData(updatedProject);
    onUpdateProject(updatedProject);
    setProgressDescription('');
    alert('施工日誌已發布並更新最新進度！');
  };

  const handleSaveGeneral = () => {
    // Only log STAGE changes to history. Do NOT log client requests or notes changes to history.
    // Just save the data.

    const newLogs: HistoryLog[] = [];

    if (formData.currentStage !== project.currentStage) {
       // Removed window.confirm to prevent mobile blocking
       newLogs.push({
        id: `h-${Date.now()}-3`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '變更專案階段', details: `專案階段已正式進入：${formData.currentStage}`, field: 'currentStage', oldValue: project.currentStage, newValue: formData.currentStage
      });
    }
    
    // For other fields, we just update the data without adding history logs
    const updatedProject = {
      ...formData,
      lastUpdatedTimestamp: Date.now(),
      history: [...newLogs, ...(formData.history || [])]
    };

    onUpdateProject(updatedProject);
    alert('資料已更新');
  };
  
  const handleDeleteHistoryLog = (logId: string) => {
    if(!window.confirm('確定要刪除這條時間軸紀錄嗎？')) return;
    
    const newHistory = formData.history.filter(h => h.id !== logId);
    const updatedProject = {
        ...formData,
        history: newHistory
    };
    
    setFormData(updatedProject);
    onUpdateProject(updatedProject);
  };

  const handleDelete = () => {
    if (currentUser.role !== 'manager' && currentUser.role !== 'engineer') return;
    if (window.confirm(`確定永久刪除「${project.projectName}」？此操作無法復原。`)) {
        onDeleteProject(project.id);
    }
  };

  const handleExportImage = async () => {
     const element = document.getElementById('project-report-template');
     if(!element) return;
     
     try {
         const canvas = await html2canvas(element, { scale: 2, useCORS: true });
         const link = document.createElement('a');
         link.download = `${project.projectName}_週報_${new Date().toISOString().split('T')[0]}.jpg`;
         link.href = canvas.toDataURL('image/jpeg', 0.9);
         link.click();
     } catch(e) {
         console.error('Export failed', e);
         alert('圖片生成失敗，請稍後再試');
     }
  };

  // AI Mocks
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await generateProjectReport(formData);
      setReportResult(report);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAnalyzeIssue = async () => {
    if (!issueInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeDesignIssue(formData, issueInput);
      setAnalysisResult(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sortedHistory = [...(formData.history || [])].sort((a, b) => b.timestamp - a.timestamp);
  const canDelete = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const canManageHistory = currentUser.role === 'manager' || currentUser.role === 'engineer';

  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-slate-400";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up">
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md group bg-slate-200">
        <img 
          src={formData.imageUrl} 
          alt={formData.projectName} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        {/* Image Upload Overlay */}
        <label className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 p-2 rounded-full cursor-pointer backdrop-blur-sm transition-all z-10">
            {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" // Use opacity-0 overlay for better mobile touch support
            />
        </label>

        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
           <div className="flex justify-between items-end">
             <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight shadow-sm text-white">{project.projectName}</h1>
                <div className="flex flex-wrap items-center gap-2 text-slate-200 text-sm mt-2 font-medium">
                  <span>{project.clientName}</span>
                  <span className="hidden sm:inline">|</span>
                  <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{project.address}</span>
                  </div>
                </div>
             </div>
             <div className={`px-3 py-1 rounded-lg text-sm font-bold backdrop-blur-md border border-white/20 shadow-lg ${
                project.currentStage === ProjectStage.CONSTRUCTION ? 'bg-amber-500/90 text-white' :
                project.currentStage === ProjectStage.DESIGN ? 'bg-blue-500/90 text-white' :
                'bg-white/20 text-white'
             }`}>
               {project.currentStage}
             </div>
           </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
         <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold flex items-center gap-2 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回列表
         </button>
         <div className="flex gap-2">
            <button 
                onClick={handleExportImage}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95 text-sm"
            >
                <Share className="w-4 h-4" /> 匯出圖片
            </button>
            <button 
                onClick={handleSaveGeneral}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95 text-sm"
            >
                <Save className="w-4 h-4" /> 儲存變更
            </button>
         </div>
      </div>

      <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'details' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          專案執行與日誌
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'ai' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI 智能助理
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {activeTab === 'details' ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                    <div className="bg-accent/10 p-1.5 rounded-md">
                        <PlusCircle className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-bold text-slate-800">新增施工日誌</h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="sm:w-1/3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">施工階段/類別</label>
                        <select 
                          value={progressCategory}
                          onChange={(e) => setProgressCategory(e.target.value)}
                          className={inputClass}
                        >
                          {CONSTRUCTION_PHASES.map(phase => (
                            <option key={phase} value={phase}>{phase}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">進度詳情</label>
                          <textarea 
                            rows={3}
                            placeholder="請輸入今日施工項目、完成進度或現場狀況..."
                            value={progressDescription}
                            onChange={(e) => setProgressDescription(e.target.value)}
                            className={inputClass}
                          />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={handleAddProgress}
                        className="bg-accent hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95"
                      >
                          <Send className="w-4 h-4" /> 發布日誌
                      </button>
                    </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-400" />
                  專案時間軸 (Timeline)
                </h3>
                <div className="relative pl-6 space-y-8">
                  <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-slate-100"></div>
                  {sortedHistory.length === 0 ? (
                    <p className="text-slate-400 text-sm italic pl-4">尚無紀錄</p>
                  ) : (
                    sortedHistory.map((log) => (
                      <div key={log.id} className="relative pl-2 group">
                        <div className={`
                          absolute -left-[21px] top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm z-10
                          ${log.field === 'currentStage' ? 'bg-purple-500' : log.field === 'latestProgressNotes' ? 'bg-accent' : 'bg-slate-300'}
                        `}></div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-slate-200 transition-colors relative">
                          {canManageHistory && (
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHistoryLog(log.id);
                                }}
                                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-1"
                                title="刪除此紀錄"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          )}
                          <div className="flex justify-between items-center mb-2 mr-6">
                              <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wide">{log.action}</span>
                              <span className="text-xs text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{log.details}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                              <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">{log.userName.charAt(0)}</div>
                              <span>{log.userName}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    專案基本資料與客戶需求
                </h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">目前階段</label>
                      <select
                        className={inputClass}
                        value={formData.currentStage}
                        onChange={e => handleInputChange('currentStage', e.target.value)}
                      >
                          {Object.values(ProjectStage).map(stage => (
                            <option key={stage} value={stage}>{stage}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">預計完工日</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={formData.estimatedCompletionDate}
                        onChange={e => handleInputChange('estimatedCompletionDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">客戶事項 / 需求</label>
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={formData.clientRequests}
                      onChange={e => handleInputChange('clientRequests', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">內部備註</label>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={formData.internalNotes}
                      onChange={e => handleInputChange('internalNotes', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {canDelete && (
                <div className="border border-red-100 rounded-2xl p-6 bg-red-50/30">
                  <h3 className="text-red-700 font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><Trash2 className="w-4 h-4" /> 危險區域</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-red-500">刪除專案將無法復原，請謹慎操作。</p>
                    <button onClick={handleDelete} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-colors">刪除此專案</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    智能週報生成
                  </h3>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50 font-medium shadow-md shadow-purple-500/20"
                  >
                    {isGeneratingReport ? <Loader2 className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
                    {isGeneratingReport ? '生成中...' : '一鍵生成週報'}
                  </button>
                </div>
                {reportResult && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                    {reportResult}
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-purple-600" />
                  設計/施工問題分析
                </h3>
                <textarea
                  value={issueInput}
                  onChange={e => setIssueInput(e.target.value)}
                  className={inputClass}
                  rows={3}
                  placeholder="請簡述遇到的設計變更或施工困難..."
                />
                <button 
                  onClick={handleAnalyzeIssue}
                  disabled={isAnalyzing}
                  className="w-full mt-3 bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 font-bold"
                >
                  {isAnalyzing ? 'AI 分析中...' : '開始分析與建議'}
                </button>

                {analysisResult && (
                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-purple-900 text-sm font-medium leading-relaxed">
                      {analysisResult.analysis}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">建議方案</h4>
                      <ul className="space-y-2">
                        {analysisResult.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex gap-3 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide text-slate-500">專案負責人</h3>
              <div className="flex items-center gap-3 mb-5">
                 <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-600 border border-slate-200">
                    {project.assignedEmployee.charAt(0)}
                 </div>
                 <div>
                    <p className="font-bold text-slate-900 text-lg">{project.assignedEmployee}</p>
                    <p className="text-xs text-slate-500 font-medium">Project Lead</p>
                 </div>
              </div>
              
              {(currentUser.role === 'manager' || currentUser.role === 'engineer') && (
                 <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">重新指派</label>
                    <select
                      value={formData.assignedEmployee}
                      onChange={(e) => {
                         handleInputChange('assignedEmployee', e.target.value);
                      }}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg text-slate-900 p-2.5 outline-none focus:ring-2 focus:ring-accent/50"
                    >
                       {employeeNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                       ))}
                    </select>
                 </div>
              )}
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide text-slate-500">聯絡資訊</h3>
              <div className="space-y-4">
                 <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">聯絡電話</span>
                    </div>
                    <input 
                       type="text" 
                       value={formData.contactPhone}
                       onChange={e => handleInputChange('contactPhone', e.target.value)}
                       className={inputClass}
                    />
                 </div>
                 <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">案場地址</span>
                    </div>
                    <input 
                       type="text" 
                       value={formData.address}
                       onChange={e => handleInputChange('address', e.target.value)}
                       className={inputClass}
                    />
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      {/* Hidden Export Template */}
      <div 
        id="project-report-template" 
        className="fixed -left-[9999px] top-0 w-[794px] bg-white p-12 text-[#54534d]"
        style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
      >
         <div className="flex justify-between items-center border-b-2 border-[#54534d] pb-6 mb-8">
             <div className="flex items-center gap-4">
                 <ZewuIcon className="w-16 h-16 text-[#54534d]" />
                 <div>
                     <h1 className="text-3xl font-bold tracking-widest text-[#54534d]">澤物設計</h1>
                     <p className="text-sm tracking-[0.3em] font-light mt-1 text-[#54534d]">ZEWU INTERIOR DESIGN</p>
                 </div>
             </div>
             <div className="text-right">
                 <h2 className="text-xl font-bold mb-1">專案進度週報</h2>
                 <p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
             </div>
         </div>
         
         <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
             <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">專案名稱</span><span className="text-lg font-bold">{project.projectName}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">目前階段</span><span className="inline-block bg-[#54534d] text-white text-xs px-2 py-1 rounded font-bold">{project.currentStage}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">業主名稱</span><span>{project.clientName}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">專案負責人</span><span>{project.assignedEmployee}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">案場地址</span><span>{project.address}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">聯絡電話</span><span>{project.contactPhone}</span></div>
                 <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">預計完工</span><span className="font-mono">{project.estimatedCompletionDate}</span></div>
             </div>
         </div>
         
         <div className="mb-8">
             <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4 flex items-center gap-2">
                 <Sparkles className="w-5 h-5" />
                 本週最新進度摘要
             </h3>
             <div className="bg-white border border-slate-200 rounded-lg p-5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
                 {project.latestProgressNotes || "尚無最新進度"}
             </div>
         </div>
         
         <div>
             <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4 flex items-center gap-2">
                 <History className="w-5 h-5" />
                 近期施工日誌與變更紀錄
             </h3>
             <div className="space-y-0 relative border-l border-slate-200 ml-3 my-4">
                 {sortedHistory.slice(0, 8).map((log, idx) => (
                    <div key={idx} className="relative pl-6 pb-6">
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#54534d]"></div>
                        <div className="flex justify-between items-center mb-1">
                             <span className="font-bold text-sm text-slate-800">{log.action}</span>
                             <span className="text-xs text-slate-500 font-mono">{new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{log.details}</p>
                    </div>
                 ))}
                 {sortedHistory.length === 0 && <p className="text-sm text-slate-400 pl-6 italic">尚無紀錄</p>}
             </div>
         </div>
         
         <div className="mt-12 pt-6 border-t border-slate-200 text-center">
             <p className="text-xs text-slate-400 tracking-wider">ZEWU INTERIOR DESIGN PROJECT MANAGEMENT SYSTEM</p>
         </div>
      </div>
    </div>
  );
};

// --- NewProjectModal ---
const NewProjectModal: React.FC<{ currentUser: User; onClose: () => void; onSubmit: (project: DesignProject) => void; employeeNames: string[] }> = ({ currentUser, onClose, onSubmit, employeeNames }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<DesignProject>>({
    projectName: '',
    clientName: '',
    assignedEmployee: currentUser.role === 'employee' ? currentUser.name : (employeeNames[0] || ''),
    currentStage: ProjectStage.CONTACT,
    estimatedCompletionDate: '',
    latestProgressNotes: '新立案，等待初步接洽。',
    clientRequests: '',
    internalNotes: '',
    address: '',
    contactPhone: '',
    imageUrl: DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.clientName) {
      alert('請填寫專案名稱與客戶姓名');
      return;
    }
    setIsSubmitting(true);
    try {
      const projectId = `P${Date.now().toString().slice(-4)}`;
      const newProject: DesignProject = {
        id: projectId,
        projectName: formData.projectName!,
        clientName: formData.clientName!,
        assignedEmployee: formData.assignedEmployee || currentUser.name,
        currentStage: formData.currentStage || ProjectStage.CONTACT,
        estimatedCompletionDate: formData.estimatedCompletionDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        latestProgressNotes: formData.latestProgressNotes || '',
        clientRequests: formData.clientRequests || '',
        internalNotes: formData.internalNotes || '',
        lastUpdatedTimestamp: Date.now(),
        address: formData.address || '',
        contactPhone: formData.contactPhone || '',
        imageUrl: formData.imageUrl!,
        history: [{ id: `h-${Date.now()}`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name, action: '建立專案', details: '專案初始化完成' }]
      };
      onSubmit(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("建立專案失敗");
      setIsSubmitting(false);
    }
  };

  const regenerateRandomCover = () => {
      const randomCover = DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)];
      setFormData({ ...formData, imageUrl: randomCover });
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (!validateImageFile(file)) {
            e.target.value = '';
            return;
        }
        try {
            // Show loading state or preview immediately if possible, here we just wait for upload
            const url = await uploadImageFile(file);
            setFormData({ ...formData, imageUrl: url });
        } catch(e) {
            alert('圖片上傳失敗');
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div className="bg-accent p-1.5 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            新增案場 (New Project)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">案名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：信義區張公館"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.projectName}
                  onChange={e => setFormData({...formData, projectName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">客戶姓名 *</label>
                <input
                  type="text"
                  required
                  placeholder="客戶聯絡人"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.clientName}
                  onChange={e => setFormData({...formData, clientName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">地址/地點</label>
                <input
                  type="text"
                  placeholder="案場地址"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
               <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">預計完工日</label>
                <input
                  type="date"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.estimatedCompletionDate}
                  onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">封面照片</label>
                 <div className="relative h-32 rounded-lg overflow-hidden group border border-slate-200">
                    <img src={formData.imageUrl} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button type="button" onClick={regenerateRandomCover} className="bg-white/20 hover:bg-white/40 p-2 rounded-full text-white backdrop-blur-sm" title="隨機更換">
                            <RefreshCw className="w-4 h-4" />
                         </button>
                         <label className="bg-white/20 hover:bg-white/40 p-2 rounded-full text-white backdrop-blur-sm cursor-pointer" title="上傳照片">
                            <Upload className="w-4 h-4" />
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                         </label>
                    </div>
                 </div>
                 <p className="text-[10px] text-slate-400 mt-1 text-right">若未上傳將使用隨機圖庫</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">負責人</label>
                {currentUser.role === 'manager' || currentUser.role === 'engineer' ? (
                   <select
                      className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                      value={formData.assignedEmployee}
                      onChange={e => setFormData({...formData, assignedEmployee: e.target.value})}
                   >
                     {employeeNames.map(name => (
                       <option key={name} value={name}>{name}</option>
                     ))}
                   </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-100 text-slate-500"
                    value={formData.assignedEmployee}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">目前階段</label>
                <select
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.currentStage}
                  onChange={e => setFormData({...formData, currentStage: e.target.value as ProjectStage})}
                >
                  {Object.values(ProjectStage).map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
             <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">客戶需求 (Client Requests)</label>
              <textarea
                rows={2}
                placeholder="紀錄客戶的初步需求..."
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                value={formData.clientRequests}
                onChange={e => setFormData({...formData, clientRequests: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-amber-700 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  建立中...
                </>
              ) : (
                '建立案場'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Team Management ---
const TeamManagement: React.FC<{ users: User[]; currentUser: User; onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void }> = ({ users, currentUser, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newCanViewDashboard, setNewCanViewDashboard] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editCanViewDashboard, setEditCanViewDashboard] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) {
      alert("請填寫完整資訊");
      return;
    }
    if (users.some(u => u.username === newUsername)) {
      alert("此帳號已存在");
      return;
    }
    const newUser: User = { id: `u-${Date.now()}`, name: newName, username: newUsername, password: newPassword, role: newRole, avatarInitials: newName.charAt(0), canViewDashboard: newRole !== 'employee' ? true : newCanViewDashboard };
    onAddUser(newUser);
    setNewName(''); setNewUsername(''); setNewPassword(''); setNewRole('employee'); setNewCanViewDashboard(false); setIsAdding(false);
  };

  const startEdit = (user: User) => {
    setEditingId(user.id); setEditName(user.name); setEditRole(user.role); setEditCanViewDashboard(user.canViewDashboard || false); setEditPassword('');
  };

  const saveEdit = () => {
    if (!editName.trim() || !editingId) return;
    const user = users.find(u => u.id === editingId);
    if (user) {
      const updatedUser: User = { ...user, name: editName, role: editRole, avatarInitials: editName.charAt(0), canViewDashboard: editRole !== 'employee' ? true : editCanViewDashboard };
      if (editPassword.trim()) updatedUser.password = editPassword.trim();
      onUpdateUser(updatedUser);
    }
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUser.id) return alert("無法刪除自己");
    if (window.confirm(`確定刪除「${name}」？`)) onDeleteUser(id);
  };

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'manager': return <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><ShieldCheck className="w-3 h-3" /> Admin</span>;
      case 'engineer': return <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><HardHat className="w-3 h-3" /> Engineer</span>;
      default: return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><UserIcon className="w-3 h-3" /> Designer</span>;
    }
  };

  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none";

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCog className="w-6 h-6 text-slate-600" /> 團隊成員管理</h2>
        </div>
        <button onClick={() => setIsAdding(true)} className="w-full sm:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all font-bold"><Plus className="w-4 h-4" /> 新增員工</button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-slide-up">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Plus className="w-5 h-5 text-accent" /> 新增成員帳號</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">姓名</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} className={inputClass} autoFocus /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">帳號</label><input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">密碼</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-end">
              <div className="w-full md:w-64">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className={inputClass}>
                  <option value="employee">設計師</option><option value="manager">管理員</option><option value="engineer">工程師</option>
                </select>
              </div>
              {newRole === 'employee' && (
                <div className="flex items-center gap-3 pb-3">
                  <input type="checkbox" id="newCanView" checked={newCanViewDashboard} onChange={e => setNewCanViewDashboard(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-accent focus:ring-accent" />
                  <label htmlFor="newCanView" className="text-sm font-bold text-slate-700 cursor-pointer select-none">允許查看儀表板</label>
                </div>
              )}
              <div className="w-full md:w-auto md:ml-auto">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold shadow-md shadow-emerald-500/20 transition-all"><Save className="w-4 h-4" /> 建立帳號</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="md:hidden space-y-4">
        {users.length === 0 ? <p className="text-center text-slate-400 py-4">載入中或無資料...</p> : users.map(user => (
          <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {editingId === user.id ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2"><h4 className="font-bold text-slate-800">編輯成員</h4><button onClick={() => setEditingId(null)} className="p-1"><X className="w-5 h-5 text-slate-400"/></button></div>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} placeholder="姓名" />
                <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} className={inputClass}><option value="employee">設計師</option><option value="manager">管理員</option><option value="engineer">工程師</option></select>
                <input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} className={inputClass} placeholder="重設密碼(選填)" />
                <div className="flex items-center gap-3 py-2 bg-slate-50 rounded-lg px-3 border border-slate-100">
                    <input type="checkbox" disabled={editRole !== 'employee'} checked={editRole !== 'employee' ? true : editCanViewDashboard} onChange={e => setEditCanViewDashboard(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-accent focus:ring-accent" />
                    <span className={`text-sm font-bold ${editRole !== 'employee' ? 'text-slate-400' : 'text-slate-700'}`}>允許查看儀表板</span>
                </div>
                <button onClick={saveEdit} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg mt-2"><Save className="w-4 h-4" /> 儲存</button>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-base font-bold border border-slate-200 shadow-sm">{user.avatarInitials}</div>
                    <div><div className="font-bold text-slate-900 text-lg flex items-center gap-2">{user.name}</div><div className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded w-fit mt-1">@{user.username}</div></div>
                  </div>
                  {renderRoleBadge(user.role)}
                </div>
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                   <div className="flex gap-3 ml-auto">
                      <button onClick={() => startEdit(user)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm"><Edit2 className="w-4 h-4" /></button>
                      {user.id !== currentUser.id && <button onClick={() => handleDelete(user.id, user.name)} className="p-2 bg-red-50 border border-red-100 rounded-lg text-red-500 hover:bg-red-100 shadow-sm"><Trash2 className="w-4 h-4" /></button>}
                   </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="px-6 py-4">姓名 / 帳號</th><th className="px-6 py-4">角色</th><th className="px-6 py-4">權限設定</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4">{editingId === user.id ? <div className="space-y-2 max-w-[200px]"><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={`${inputClass} py-1.5`} /><div className="text-xs text-slate-400 font-mono px-1">@{user.username}</div></div> : <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold border border-slate-200">{user.avatarInitials}</div><div><div className="font-bold text-slate-800 text-sm">{user.name}</div><div className="text-xs text-slate-400 font-mono">@{user.username}</div></div></div>}</td>
                <td className="px-6 py-4">{editingId === user.id ? <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} className={`${inputClass} py-1.5`}><option value="employee">設計師</option><option value="manager">管理員</option><option value="engineer">工程師</option></select> : renderRoleBadge(user.role)}</td>
                <td className="px-6 py-4">{editingId === user.id ? <div className="space-y-3"><div className="flex items-center gap-2"><input type="checkbox" disabled={editRole !== 'employee'} checked={editRole !== 'employee' ? true : editCanViewDashboard} onChange={e => setEditCanViewDashboard(e.target.checked)} className="rounded border-slate-300 text-accent focus:ring-accent" /><span className={`text-xs font-bold ${editRole !== 'employee' ? 'text-slate-300' : 'text-slate-600'}`}>允許查看儀表板</span></div><div className="flex items-center gap-2 border-t border-slate-100 pt-2"><Key className="w-3 h-3 text-slate-400" /><input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="重設密碼" className={`${inputClass} py-1 text-xs`} /></div></div> : ((user.role === 'manager' || user.role === 'engineer') ? <span className="text-xs text-slate-300 italic font-medium">全域權限</span> : user.canViewDashboard ? <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Eye className="w-3 h-3" /> 可查看儀表板</span> : <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">限制存取</span>)}</td>
                <td className="px-6 py-4 text-right">{editingId === user.id ? <div className="flex items-center justify-end gap-2"><button onClick={saveEdit} className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 shadow-sm"><Save className="w-4 h-4" /></button><button onClick={() => setEditingId(null)} className="bg-white border border-slate-200 text-slate-500 p-1.5 rounded-lg hover:bg-slate-50"><X className="w-4 h-4" /></button></div> : <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEdit(user)} className="text-slate-400 hover:text-accent p-2 hover:bg-slate-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>{user.id !== currentUser.id && <button onClick={() => handleDelete(user.id, user.name)} className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold"><Trash2 className="w-4 h-4" /> 刪除</button>}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// 5. APP ROOT
// ==========================================
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  
  // State for views (Declared BEFORE usage in useEffect to prevent ReferenceError)
  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team'>('dashboard');
  const [previousView, setPreviousView] = useState<'dashboard' | 'projects'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectFilter, setProjectFilter] = useState<ProjectFilterType>('ALL');
  const [dashboardEmployeeFilter, setDashboardEmployeeFilter] = useState<string>('All'); // Lifted up

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      if (fetchedUsers.length === 0) {
        INITIAL_USERS.forEach(async (u) => { await setDoc(doc(db, "users", u.id), u); });
      } else {
        setUsers(fetchedUsers);
      }
    });

    const unsubscribeProjects = onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), (snapshot) => {
      const fetchedProjects = snapshot.docs.map(doc => doc.data() as DesignProject);
      setProjects(fetchedProjects);
      setIsLoading(false);

      // Real-time update for selected project if open
      if (selectedProject) {
        const updatedSelected = fetchedProjects.find(p => p.id === selectedProject.id);
        if (updatedSelected) {
            setSelectedProject(updatedSelected);
        }
      }
    });

    return () => { unsubscribeUsers(); unsubscribeProjects(); };
  }, [selectedProject?.id]); // Add dependency to ensure closure has access, though selectedProject inside might be stale if not handled carefully. 
  // Actually, standard pattern: useEffect(() => ... setProjects ...) updates state.
  // We need another useEffect to update selectedProject when 'projects' changes.
  
  // Sync selectedProject with latest data
  useEffect(() => {
    if (selectedProject) {
        const currentVersion = projects.find(p => p.id === selectedProject.id);
        if (currentVersion && currentVersion.lastUpdatedTimestamp !== selectedProject.lastUpdatedTimestamp) {
            setSelectedProject(currentVersion);
        }
    }
  }, [projects, selectedProject]);


  const employeeNames = useMemo(() => 
    users.filter(u => u.role === 'employee' || u.role === 'manager' || u.role === 'engineer').sort((a,b) => {
        // Sort: Employee -> Manager -> Engineer
        const roleOrder = { 'employee': 1, 'manager': 2, 'engineer': 3 };
        return roleOrder[a.role] - roleOrder[b.role];
    }).map(u => u.name), 
    [users]
  );

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'manager' || user.role === 'engineer' || user.canViewDashboard) {
      setView('dashboard');
    } else {
      setView('projects');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null); setSelectedProject(null); setView('dashboard'); setProjectFilter('ALL'); setDashboardEmployeeFilter('All');
  };

  const handleAddUser = async (newUser: User) => { try { await setDoc(doc(db, "users", newUser.id), newUser); } catch (e) { alert("失敗"); } };
  const handleUpdateUser = async (updatedUser: User) => { try { await setDoc(doc(db, "users", updatedUser.id), updatedUser); if (currentUser?.id === updatedUser.id) setCurrentUser(updatedUser); } catch (e) { alert("失敗"); } };
  const handleDeleteUser = async (userId: string) => { try { await deleteDoc(doc(db, "users", userId)); } catch (e) { alert("失敗"); } };

  const handleSelectProject = (project: DesignProject) => {
    if (view === 'dashboard' || view === 'projects') setPreviousView(view);
    setSelectedProject(project); setView('detail');
  };

  const handleDashboardFilterClick = (filterType: ProjectFilterType) => {
    setProjectFilter(filterType); setPreviousView('dashboard'); setView('projects');
  };

  const handleBack = () => { setSelectedProject(null); setView(previousView); };

  const handleTabChange = (tab: 'dashboard' | 'projects' | 'team') => {
    setView(tab);
    if (tab === 'projects') { setProjectFilter('ALL'); } // Reset filter only if clicking sidebar, not navigating from dashboard
    if (tab === 'dashboard') { setDashboardEmployeeFilter('All'); } // Optional: reset dashboard filter? Maybe keep it.
    if (tab === 'dashboard' || tab === 'team') setSelectedProject(null);
  };

  const handleUpdateProject = async (updatedProject: DesignProject) => {
    try { await setDoc(doc(db, "projects", updatedProject.id), updatedProject); setSelectedProject(updatedProject); } catch (e) { alert("失敗"); }
  };

  const handleDeleteProject = async (projectId: string) => {
    try { await deleteDoc(doc(db, "projects", projectId)); setSelectedProject(null); setView(previousView); } catch (e) { alert("失敗"); }
  };

  const handleCreateProject = async (newProject: DesignProject) => {
    try { await setDoc(doc(db, "projects", newProject.id), newProject); setShowNewProjectModal(false); handleSelectProject(newProject); } catch (e) { alert("失敗"); }
  };

  const handleExportData = () => {
    if (projects.length === 0) return alert("無資料");
    const headers = ['案名', '客戶姓名', '負責人', '目前階段', '預計完工日', '地址', '電話', '最新進度', '客戶需求', '內部備註', '完整時間軸與日誌'];
    const rows = projects.map(p => {
        // Format history into a readable string block
        const historyText = (p.history || [])
            .sort((a,b) => a.timestamp - b.timestamp)
            .map(h => `[${new Date(h.timestamp).toLocaleDateString()} ${h.userName}]: ${h.action} - ${h.details}`)
            .join('\n');
            
        return [
            p.projectName, p.clientName, p.assignedEmployee, p.currentStage, p.estimatedCompletionDate, p.address, p.contactPhone,
            `"${(p.latestProgressNotes || '').replace(/"/g, '""')}"`,
            `"${(p.clientRequests || '').replace(/"/g, '""')}"`,
            `"${(p.internalNotes || '').replace(/"/g, '""')}"`,
            `"${historyText.replace(/"/g, '""')}"`
        ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', `澤物專案_匯出_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (isLoading) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="w-10 h-10 text-[#54534d] animate-spin" /><p className="text-slate-500 font-bold">系統載入中...</p></div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={users} />;

  // Filter Logic
  let displayProjects = (currentUser.role === 'manager' || currentUser.role === 'engineer') ? projects : projects.filter(p => p.assignedEmployee === currentUser.name);

  // 1. Apply Employee Filter (from Dashboard)
  if (dashboardEmployeeFilter !== 'All') {
      displayProjects = displayProjects.filter(p => p.assignedEmployee === dashboardEmployeeFilter);
  }

  // 2. Apply Status/Type Filter
  if (projectFilter === 'CONSTRUCTION') {
    displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.CONSTRUCTION);
  } else if (projectFilter === 'DESIGN_CONTACT') {
    displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT);
  } else if (projectFilter === 'UPCOMING') {
     // Show ALL projects in list when clicked from dashboard, sorted by date in UI, but if strict filter needed:
     // displayProjects = displayProjects; // Keep all for now as requested "Show all projects"
     // Or apply strict filter? User said "Show all projects" in previous turn.
     // But let's keep it somewhat filtered if they clicked a specific category? 
     // Re-reading: "另外即將完工這個總表區塊請幫我顯示全部的案子" -> This referred to the Dashboard bottom list.
     // If clicking the top cards, it should probably still filter? 
     // Let's keep logic: Clicking "Upcoming" card filters to upcoming. 
     const today = new Date();
     const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
     displayProjects = displayProjects.filter(p => {
        if (p.currentStage === ProjectStage.COMPLETED) return false;
        const date = new Date(p.estimatedCompletionDate);
        return date >= today && date <= thirtyDaysLater;
     });
  }

  const getFilterName = () => {
      let prefix = dashboardEmployeeFilter !== 'All' ? `${dashboardEmployeeFilter} 的 ` : '';
      switch(projectFilter) {
          case 'CONSTRUCTION': return prefix + '施工中案件';
          case 'DESIGN_CONTACT': return prefix + '設計/接洽中案件';
          case 'UPCOMING': return prefix + '即將完工案件';
          default: return prefix + '所有專案列表';
      }
  };

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  return (
    <Layout activeTab={view === 'detail' ? 'projects' : view as 'dashboard' | 'projects' | 'team'} onTabChange={handleTabChange} currentUser={currentUser} onLogout={handleLogout} onExportData={handleExportData}>
      {view === 'dashboard' && (currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard) && (
        <>
            <div className="flex justify-end mb-4">
                 <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                  <Filter className="w-4 h-4 text-slate-400 ml-2" />
                  <select 
                    className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-700 outline-none cursor-pointer"
                    value={dashboardEmployeeFilter}
                    onChange={(e) => setDashboardEmployeeFilter(e.target.value)}
                  >
                    <option value="All">顯示全部人員</option>
                    {employeeNames.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </select>
                </div>
            </div>
            <ProjectDashboard projects={projects} onSelectProject={handleSelectProject} selectedEmployeeFilter={dashboardEmployeeFilter} onFilterClick={handleDashboardFilterClick} />
        </>
      )}

      {view === 'team' && (currentUser.role === 'manager' || currentUser.role === 'engineer') && (
        <TeamManagement users={users} currentUser={currentUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />
      )}
      
      {view === 'projects' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div>
               <div className="flex items-center gap-2">
                 {(projectFilter !== 'ALL' || dashboardEmployeeFilter !== 'All') && (
                    <button onClick={() => setView('dashboard')} className="p-1 hover:bg-slate-100 rounded-full mr-1 text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                 )}
                 <h2 className="text-2xl font-bold text-slate-800">{(currentUser.role === 'manager' || currentUser.role === 'engineer') ? getFilterName() : '我的負責案場'}</h2>
               </div>
              <p className="text-slate-500 text-sm mt-1 ml-1">共 {displayProjects.length} 個案場</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                {(projectFilter !== 'ALL' || dashboardEmployeeFilter !== 'All') && (
                    <button onClick={() => { setProjectFilter('ALL'); setDashboardEmployeeFilter('All'); }} className="w-full md:w-auto px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors">清除篩選</button>
                )}
                <button onClick={() => setShowNewProjectModal(true)} className="w-full md:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 font-medium"><Plus className="w-5 h-5" /> 新增案場</button>
            </div>
          </div>

          {displayProjects.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 mb-4 text-lg">目前沒有符合條件的案場</p>
              {projectFilter === 'ALL' && <button onClick={() => setShowNewProjectModal(true)} className="text-accent hover:underline font-medium">立即建立第一個案場</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayProjects.map(project => (
                <div key={project.id} onClick={() => handleSelectProject(project)} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col">
                  <div className="h-48 bg-slate-100 overflow-hidden relative">
                    <img src={project.imageUrl} alt={project.projectName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent opacity-60"></div>
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm backdrop-blur-md ${project.currentStage === '施工中' ? 'bg-amber-500/90 text-white' : project.currentStage === '已完工' ? 'bg-emerald-500/90 text-white' : 'bg-white/90 text-slate-800'}`}>{project.currentStage}</span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-1">{project.projectName}</h3>
                    <p className="text-slate-500 text-sm mb-4">{project.assignedEmployee} | {project.clientName}</p>
                    <div className="mt-auto pt-4 border-t border-slate-100 text-sm flex justify-between items-center text-slate-400">
                      <span className="text-xs">更新: {new Date(project.lastUpdatedTimestamp).toLocaleDateString()}</span>
                      <span className="text-accent font-medium text-xs bg-amber-50 px-2 py-1 rounded group-hover:bg-accent group-hover:text-white transition-colors">查看詳情 &rarr;</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && selectedProject && (
        <ProjectDetail project={selectedProject} currentUser={currentUser} onBack={handleBack} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} employeeNames={employeeNames} />
      )}

      {showNewProjectModal && (
        <NewProjectModal currentUser={currentUser} onClose={() => setShowNewProjectModal(false)} onSubmit={handleCreateProject} employeeNames={employeeNames} />
      )}
    </Layout>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
