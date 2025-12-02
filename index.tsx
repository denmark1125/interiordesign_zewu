import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  LayoutDashboard, FolderKanban, Settings, PenTool, Menu, X, LogOut, Users, 
  Download, Upload, CloudCog, Plus, Trash2, Edit2, Save, UserCog, ShieldCheck, 
  User as UserIcon, HardHat, Eye, Key, Loader2, ArrowLeft, ArrowRight, AlertCircle, 
  MapPin, CheckCircle, Clock, Briefcase, ChevronRight, ChevronLeft, AlertTriangle,
  Phone, FileText, Send, History, PlusCircle, Sparkles, Camera
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import html2canvas from 'html2canvas';
import { 
  db, storage, analytics, usersCollection, projectsCollection, 
  setDoc, doc, deleteDoc, onSnapshot, query, orderBy, updateDoc, 
  ref, uploadBytes, getDownloadURL 
} from "./services/firebase";
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
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
  action: string;
  details: string;
  field?: string;
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

// --- Constants ---
const INITIAL_USERS: User[] = [
  { id: 'admin', name: '老闆/管理員', username: 'admin', password: '1234', role: 'manager', avatarInitials: 'Boss', canViewDashboard: true },
  { id: 'eng1', name: '系統工程師', username: 'engineer', password: '1234', role: 'engineer', avatarInitials: 'Eng', canViewDashboard: true },
  { id: 'u1', name: '王小明', username: 'wang', password: '1234', role: 'employee', avatarInitials: '王', canViewDashboard: true },
];

const CONSTRUCTION_PHASES = [
  '保護工程', '拆除工程', '泥作工程', '水電工程', '空調/管線', '木作工程', 
  '油漆工程', '系統櫃安裝', '石材/磁磚', '燈具/玻璃', '地板工程', '細部清潔', 
  '家具軟裝', '驗收缺失改善', '完工交付', '其他事項'
];

// --- AI Service (Lazy Loaded) ---
const AI_KEY_FALLBACK = "AIzaSyD5y1wnTV3bsZ85Dg-PO3TGcHWADQem7Rk";
let aiClient: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    // Priority: Env Var -> Hardcoded Fallback
    const key = process.env.API_KEY || AI_KEY_FALLBACK;
    if (!key) throw new Error("API Key is missing");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

const generateProjectReport = async (project: DesignProject): Promise<string> => {
  const prompt = `請為以下室內設計專案撰寫一份專業的週報：
  專案名稱：${project.projectName}
  目前階段：${project.currentStage}
  負責人員：${project.assignedEmployee}
  本週最新進度：${project.latestProgressNotes}
  客戶需求：${project.clientRequests}
  內部備註：${project.internalNotes}
  請包含：1. 本週進度摘要 2. 下週預計事項 3. 注意事項。語氣請專業、簡潔。`;

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "AI 無法生成報告內容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成週報時發生錯誤，請稍後再試。";
  }
};

const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<{analysis: string, suggestions: string[]}> => {
  const prompt = `針對以下室內設計專案問題進行分析與建議：專案：${project.projectName} 問題：${inputContent}`;
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["analysis", "suggestions"]
        }
      }
    });
    if (response.text) return JSON.parse(response.text);
    throw new Error("Empty response");
  } catch (error) {
    return { analysis: "目前無法進行 AI 分析。", suggestions: ["建議諮詢專業技師", "與業主討論替代方案"] };
  }
};

// --- Helper Functions ---
const ZewuIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="80" height="110" stroke="currentColor" strokeWidth="3"/>
    <path d="M10 70 C 30 70, 40 60, 90 60" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 85 C 30 85, 50 75, 90 85" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 100 C 40 100, 60 110, 90 100" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const uploadWithRetry = async (file: File, path: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.warn(`Upload attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
    }
  }
  throw new Error("Upload failed after retries");
};

// --- Components ---

const LoginScreen: React.FC<{ onLogin: (user: User) => void; users: User[] }> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username);
    if (user && user.password === password) onLogin(user);
    else setError('帳號或密碼錯誤');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-slate-100 rounded-2xl mb-4 shadow-sm w-24 h-32 text-[#54534d]">
          <ZewuIcon />
        </div>
        <h1 className="text-3xl font-bold text-[#54534d] tracking-tight">澤物設計</h1>
        <p className="text-[#54534d]/70 mt-2 text-sm tracking-widest">ZEWU INTERIOR DESIGN</p>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="block w-full p-3 border border-slate-300 rounded-lg text-slate-900" placeholder="帳號" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="block w-full p-3 border border-slate-300 rounded-lg text-slate-900" placeholder="密碼" />
          {error && <div className="text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <button type="submit" className="w-full bg-[#54534d] hover:bg-[#43423d] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">登入系統 <ArrowRight className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
};

const ProjectDashboard: React.FC<{
  projects: DesignProject[];
  onSelectProject: (project: DesignProject) => void;
  onFilterClick: (filter: ProjectFilterType) => void;
}> = ({ projects, onSelectProject, onFilterClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const stageCounts = projects.reduce((acc, p) => { acc[p.currentStage] = (acc[p.currentStage] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.keys(stageCounts).map(stage => ({ name: stage, value: stageCounts[stage], color: ['#94a3b8', '#3b82f6', '#f59e0b', '#a855f7', '#10b981'][Object.values(ProjectStage).indexOf(stage as ProjectStage)] || '#ccc' }));
  
  const today = new Date();
  const sortedProjects = [...projects].sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp);
  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
  const paginatedProjects = sortedProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isUpdatedToday = (ts: number) => {
    const d = new Date(ts);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const stats = [
    { label: '負責案場總數', value: projects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', filter: 'ALL' },
    { label: '施工中案場', value: projects.filter(p => p.currentStage === ProjectStage.CONSTRUCTION).length, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', filter: 'CONSTRUCTION' },
    { label: '設計/接洽中', value: projects.filter(p => p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT).length, icon: Clock, color: 'bg-blue-100 text-blue-600', filter: 'DESIGN_CONTACT' },
    { label: '即將完工 (30天)', value: projects.filter(p => { if (p.currentStage === ProjectStage.COMPLETED) return false; const d = new Date(p.estimatedCompletionDate); return d >= today && d <= new Date(today.getTime() + 30 * 86400000); }).length, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', filter: 'UPCOMING' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <button key={i} onClick={() => onFilterClick(s.filter as ProjectFilterType)} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-left hover:scale-[1.02] transition-transform">
            <div className={`p-3 rounded-xl w-fit ${s.color} mb-3`}><s.icon className="w-6 h-6" /></div>
            <p className="text-3xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase">{s.label}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-[350px]">
          <h3 className="font-bold text-slate-800 mb-4">案場階段分佈</h3>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-[#54534d] flex items-center gap-2"><Briefcase className="w-5 h-5" />所有案場列表 (依更新時間)</h3>
             <span className="text-xs text-slate-400">第 {currentPage} / {totalPages || 1} 頁</span>
          </div>
          <div className="flex-1 overflow-auto">
             <table className="w-full text-sm text-left hidden md:table">
               <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">案名</th><th className="px-4 py-3">負責人</th><th className="px-4 py-3">階段</th><th className="px-4 py-3">更新</th></tr></thead>
               <tbody className="divide-y divide-slate-100">
                 {paginatedProjects.map(p => (
                   <tr key={p.id} onClick={() => onSelectProject(p)} className="hover:bg-slate-50 cursor-pointer">
                     <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                       {isUpdatedToday(p.lastUpdatedTimestamp) && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 rounded font-black">NEW</span>}
                       {p.projectName}
                     </td>
                     <td className="px-4 py-3 text-slate-500">{p.assignedEmployee}</td>
                     <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">{p.currentStage}</span></td>
                     <td className="px-4 py-3 font-mono text-slate-500">{new Date(p.lastUpdatedTimestamp).toLocaleDateString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             <div className="md:hidden space-y-3">
                {paginatedProjects.map(p => (
                   <div key={p.id} onClick={() => onSelectProject(p)} className="p-4 bg-slate-50 rounded-xl border border-slate-100 active:bg-slate-100">
                      <div className="flex justify-between mb-2">
                         <div className="font-bold text-slate-800 flex items-center gap-2">
                            {isUpdatedToday(p.lastUpdatedTimestamp) && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 rounded font-black">NEW</span>}
                            {p.projectName}
                         </div>
                         <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200">{p.currentStage}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex justify-between"><span>{p.assignedEmployee}</span><span>{new Date(p.lastUpdatedTimestamp).toLocaleDateString()}</span></div>
                   </div>
                ))}
             </div>
          </div>
          {totalPages > 1 && (
             <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
                <span className="font-bold text-slate-600 self-center">{currentPage}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProjectDetail: React.FC<{
  project: DesignProject;
  currentUser: User;
  onBack: () => void;
  onUpdate: (p: DesignProject) => void;
  onDelete: (id: string) => void;
  employeeNames: string[];
}> = ({ project, currentUser, onBack, onUpdate, onDelete, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ai'>('details');
  const [formData, setFormData] = useState(project);
  const [isUploading, setIsUploading] = useState(false);
  const [progDesc, setProgDesc] = useState('');
  const [progCat, setProgCat] = useState(CONSTRUCTION_PHASES[0]);
  const [aiReport, setAiReport] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{analysis: string, suggestions: string[]} | null>(null);
  const [issueInput, setIssueInput] = useState('');

  useEffect(() => setFormData(project), [project]);

  const handleSave = () => {
    let hasChanges = false;
    const newLogs: HistoryLog[] = [];
    if (formData.currentStage !== project.currentStage) {
      newLogs.push({ id: `h-${Date.now()}`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name, action: '變更階段', details: `專案階段：${formData.currentStage}`, field: 'currentStage' });
      hasChanges = true;
    }
    // Only verify changes for other fields, but don't log them to history to keep timeline clean
    ['clientRequests', 'internalNotes', 'assignedEmployee', 'imageUrl', 'address', 'contactPhone', 'estimatedCompletionDate'].forEach(k => {
        if (formData[k as keyof DesignProject] !== project[k as keyof DesignProject]) hasChanges = true;
    });

    if (hasChanges) {
       onUpdate({ ...formData, lastUpdatedTimestamp: Date.now(), history: [...newLogs, ...formData.history] });
       alert('已儲存變更');
    } else {
       alert('無變更');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("圖片限 2MB"); return; }
    setIsUploading(true);
    try {
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const url = await uploadWithRetry(file, `projects/covers/${Date.now()}_${sanitizedName}`);
        setFormData(p => ({ ...p, imageUrl: url }));
        alert("封面更新成功，請點擊「儲存變更」");
    } catch (e) { console.error(e); alert("上傳失敗"); } 
    finally { setIsUploading(false); }
  };

  const handleAddLog = () => {
    if (!progDesc) return;
    const newLog: HistoryLog = { id: `h-${Date.now()}`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name, action: progCat, details: progDesc, field: 'latestProgressNotes' };
    const updated = { ...formData, latestProgressNotes: `【${progCat}】${progDesc}`, lastUpdatedTimestamp: Date.now(), history: [newLog, ...formData.history] };
    setFormData(updated);
    onUpdate(updated);
    setProgDesc('');
    alert('日誌已發布');
  };

  const handleDeleteLog = (id: string) => {
    if (!window.confirm("刪除此紀錄？")) return;
    const updated = { ...formData, history: formData.history.filter(h => h.id !== id) };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleExportImage = async () => {
    const el = document.getElementById('project-report-template');
    if (el) {
       const canvas = await html2canvas(el, { scale: 2 });
       const link = document.createElement('a');
       link.download = `${project.projectName}_進度報告.jpg`;
       link.href = canvas.toDataURL('image/jpeg', 0.9);
       link.click();
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-slide-up">
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md group bg-slate-200">
         <img src={formData.imageUrl} className="w-full h-full object-cover" alt="cover"/>
         <div className="absolute inset-0 bg-black/40"></div>
         <label className="absolute top-4 right-4 bg-black/50 p-2 rounded-full cursor-pointer text-white hover:bg-black/70">{isUploading ? <Loader2 className="animate-spin"/> : <Camera/>}<input type="file" className="hidden" accept="image/*" onChange={handleImageUpload}/></label>
         <div className="absolute bottom-4 left-4 text-white">
            <h1 className="text-2xl font-bold">{project.projectName}</h1>
            <p className="text-sm opacity-90">{project.clientName} | {project.address}</p>
         </div>
      </div>

      <div className="flex justify-between bg-white p-3 rounded-xl border border-slate-100">
         <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold px-2 hover:bg-slate-50 rounded"><ArrowLeft className="w-4 h-4"/>列表</button>
         <div className="flex gap-2">
            <button onClick={handleExportImage} className="bg-slate-100 text-slate-700 px-3 py-2 rounded font-bold text-sm hover:bg-slate-200">匯出圖片</button>
            <button onClick={handleSave} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-emerald-700 flex items-center gap-2"><Save className="w-4 h-4"/>儲存</button>
         </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
         <button onClick={() => setActiveTab('details')} className={`px-4 py-2 font-bold text-sm border-b-2 ${activeTab==='details' ? 'border-[#54534d] text-[#54534d]' : 'border-transparent text-slate-400'}`}>專案日誌</button>
         <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 font-bold text-sm border-b-2 ${activeTab==='ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400'}`}>AI 助理</button>
      </div>

      {activeTab === 'details' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4">新增日誌</h3>
                 <div className="flex flex-col gap-3">
                    <select value={progCat} onChange={e => setProgCat(e.target.value)} className="p-2 border rounded">{CONSTRUCTION_PHASES.map(p=><option key={p} value={p}>{p}</option>)}</select>
                    <textarea value={progDesc} onChange={e => setProgDesc(e.target.value)} rows={3} className="p-2 border rounded w-full" placeholder="進度描述..."/>
                    <button onClick={handleAddLog} className="bg-accent text-white py-2 rounded font-bold hover:bg-amber-700 self-end px-6">發布</button>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4">時間軸</h3>
                 <div className="space-y-4 pl-4 border-l-2 border-slate-100">
                    {formData.history.sort((a,b)=>b.timestamp-a.timestamp).map(h => (
                       <div key={h.id} className="relative pl-4 pb-4">
                          <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></div>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group relative">
                             {(currentUser.role === 'manager' || currentUser.role === 'engineer') && <button onClick={()=>handleDeleteLog(h.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>}
                             <p className="text-xs text-slate-400 mb-1">{new Date(h.timestamp).toLocaleString()} | {h.action}</p>
                             <p className="text-slate-800 text-sm whitespace-pre-wrap">{h.details}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                 <h3 className="font-bold text-slate-800">基本資料</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500">階段</label><select value={formData.currentStage} onChange={e=>setFormData({...formData, currentStage: e.target.value as ProjectStage})} className="w-full border p-2 rounded">{Object.values(ProjectStage).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">完工日</label><input type="date" value={formData.estimatedCompletionDate} onChange={e=>setFormData({...formData, estimatedCompletionDate: e.target.value})} className="w-full border p-2 rounded"/></div>
                 </div>
                 <div><label className="text-xs font-bold text-slate-500">客戶需求</label><textarea value={formData.clientRequests} onChange={e=>setFormData({...formData, clientRequests: e.target.value})} className="w-full border p-2 rounded"/></div>
                 <div><label className="text-xs font-bold text-slate-500">內部備註</label><textarea value={formData.internalNotes} onChange={e=>setFormData({...formData, internalNotes: e.target.value})} className="w-full border p-2 rounded"/></div>
                 {(currentUser.role === 'manager' || currentUser.role === 'engineer') && <button onClick={() => { if(window.confirm("刪除專案？")) onDelete(project.id); }} className="text-red-500 text-sm font-bold border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">刪除專案</button>}
              </div>
           </div>
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4">負責人</h3>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">{project.assignedEmployee[0]}</div>
                    <p className="font-bold text-slate-900">{project.assignedEmployee}</p>
                 </div>
                 {(currentUser.role === 'manager' || currentUser.role === 'engineer') && <select value={formData.assignedEmployee} onChange={e=>setFormData({...formData, assignedEmployee: e.target.value})} className="w-full mt-4 border p-2 rounded text-sm">{employeeNames.map(n=><option key={n} value={n}>{n}</option>)}</select>}
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4">聯絡資訊</h3>
                 <input value={formData.contactPhone} onChange={e=>setFormData({...formData, contactPhone: e.target.value})} className="w-full border p-2 rounded mb-2 text-sm" placeholder="電話"/>
                 <input value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} className="w-full border p-2 rounded text-sm" placeholder="地址"/>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm">
              <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4"/>智能週報</h3>
              <button onClick={async ()=>{const r=await generateProjectReport(formData);setAiReport(r)}} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-700">生成週報</button>
              {aiReport && <div className="mt-4 p-4 bg-purple-50 rounded text-sm whitespace-pre-wrap">{aiReport}</div>}
           </div>
           <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm">
              <h3 className="font-bold text-purple-900 mb-2">問題分析</h3>
              <textarea value={issueInput} onChange={e=>setIssueInput(e.target.value)} className="w-full border p-2 rounded mb-2" placeholder="描述問題..."/>
              <button onClick={async ()=>{setAiAnalyzing(true);const r=await analyzeDesignIssue(formData, issueInput);setAiResult(r);setAiAnalyzing(false)}} disabled={aiAnalyzing} className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold w-full">{aiAnalyzing?'分析中...':'分析'}</button>
              {aiResult && <div className="mt-4 p-4 bg-purple-50 rounded text-sm space-y-2"><p className="font-bold">分析：</p><p>{aiResult.analysis}</p><p className="font-bold">建議：</p><ul>{aiResult.suggestions.map(s=><li key={s} className="list-disc ml-4">{s}</li>)}</ul></div>}
           </div>
        </div>
      )}

      {/* Hidden Report Template */}
      <div id="project-report-template" className="fixed -left-[9999px] w-[794px] bg-white p-12 text-[#54534d]">
         <div className="flex justify-between items-end border-b-2 border-[#54534d] pb-6 mb-8">
            <div className="w-24 h-32 text-[#54534d]"><ZewuIcon/></div>
            <div className="text-right">
               <h1 className="text-3xl font-bold tracking-widest mb-1">專案進度報告</h1>
               <p className="text-sm tracking-widest opacity-70">ZEWU INTERIOR DESIGN</p>
               <p className="mt-4 text-xs font-mono">{new Date().toLocaleDateString()}</p>
            </div>
         </div>
         <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div className="space-y-2">
               <p><span className="font-bold">專案名稱：</span>{project.projectName}</p>
               <p><span className="font-bold">業主姓名：</span>{project.clientName}</p>
               <p><span className="font-bold">案場地址：</span>{project.address}</p>
            </div>
            <div className="space-y-2 text-right">
               <p><span className="font-bold">目前階段：</span>{project.currentStage}</p>
               <p><span className="font-bold">專案負責人：</span>{project.assignedEmployee}</p>
               <p><span className="font-bold">預計完工：</span>{project.estimatedCompletionDate}</p>
            </div>
         </div>
         <div className="mb-8">
            <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4">最新進度摘要</h3>
            <div className="bg-slate-50 p-6 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">{project.latestProgressNotes}</div>
         </div>
         <div>
            <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4">施工日誌時間軸</h3>
            <div className="space-y-4">
               {project.history.filter(h=>h.field==='latestProgressNotes'||h.field==='currentStage').sort((a,b)=>b.timestamp-a.timestamp).slice(0, 8).map(h=>(
                  <div key={h.id} className="flex gap-4 text-sm border-b border-slate-100 pb-2">
                     <span className="font-mono text-slate-500 w-32 flex-shrink-0">{new Date(h.timestamp).toLocaleDateString()}</span>
                     <div className="flex-1"><span className="font-bold mr-2">[{h.action}]</span>{h.details}</div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

// --- App Root ---
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [view, setView] = useState<'dash'|'proj'|'detail'|'team'>('dash');
  const [selectedProj, setSelectedProj] = useState<DesignProject|null>(null);
  const [projFilter, setProjFilter] = useState<ProjectFilterType>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    onSnapshot(query(usersCollection, orderBy("name")), s => {
      const u = s.docs.map(d => d.data() as User);
      if (u.length === 0) INITIAL_USERS.forEach(iu => setDoc(doc(db, "users", iu.id), iu));
      else setUsers(u);
    });
    onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), s => setProjects(s.docs.map(d => d.data() as DesignProject)));
  }, []);

  const handleLogin = (u: User) => { setUser(u); setView((u.role==='manager'||u.role==='engineer'||u.canViewDashboard)?'dash':'proj'); };
  const handleSelectProj = (p: DesignProject) => { setSelectedProj(p); setView('detail'); };
  const handleCreateProj = async (p: DesignProject) => { await setDoc(doc(db, "projects", p.id), p); setShowNewModal(false); handleSelectProj(p); };
  
  // Filter logic
  let displayProjs = (user?.role==='manager'||user?.role==='engineer') ? projects : projects.filter(p=>p.assignedEmployee===user?.name);
  if (projFilter==='CONSTRUCTION') displayProjs = displayProjs.filter(p=>p.currentStage===ProjectStage.CONSTRUCTION);
  if (projFilter==='DESIGN_CONTACT') displayProjs = displayProjs.filter(p=>p.currentStage===ProjectStage.DESIGN || p.currentStage===ProjectStage.CONTACT);
  if (projFilter==='UPCOMING') displayProjs = displayProjs.filter(p=> { if(p.currentStage===ProjectStage.COMPLETED)return false; const d=new Date(p.estimatedCompletionDate); return d>=new Date() && d<=new Date(Date.now()+30*86400000); });

  const NewModal = () => {
     const [form, setForm] = useState<Partial<DesignProject>>({ currentStage: ProjectStage.CONTACT, imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3', assignedEmployee: user?.role==='employee'?user.name:users[0]?.name });
     const [uploading, setUploading] = useState(false);
     const onFile = async (e:any) => {
        const f = e.target.files[0]; if(!f)return; if(f.size>2*1024*1024){alert("2MB limit");return;}
        setUploading(true);
        try { const u = await uploadWithRetry(f, `projects/covers/${Date.now()}_${f.name.replace(/\W/g,'')}`); setForm({...form, imageUrl:u}); } 
        catch{alert("Upload failed");} finally{setUploading(false);}
     }
     return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
              <h2 className="text-xl font-bold">新增專案</h2>
              <input placeholder="案名" className="w-full border p-2 rounded" value={form.projectName||''} onChange={e=>setForm({...form,projectName:e.target.value})}/>
              <input placeholder="客戶姓名" className="w-full border p-2 rounded" value={form.clientName||''} onChange={e=>setForm({...form,clientName:e.target.value})}/>
              <div className="flex gap-2 items-center"><img src={form.imageUrl} className="w-10 h-10 rounded object-cover"/><label className="bg-slate-100 px-3 py-1 rounded cursor-pointer">{uploading?'...':'上傳封面'}<input type="file" className="hidden" onChange={onFile}/></label></div>
              <div className="flex gap-2 justify-end">
                 <button onClick={()=>setShowNewModal(false)} className="px-4 py-2 text-slate-500">取消</button>
                 <button onClick={()=>{if(form.projectName&&form.clientName)handleCreateProj({...form, id:`P${Date.now()}`, lastUpdatedTimestamp:Date.now(), history:[{id:`h-${Date.now()}`, timestamp:Date.now(), userId:user!.id, userName:user!.name, action:'建立', details:'初始化'}]} as DesignProject)}} className="bg-accent text-white px-4 py-2 rounded font-bold">建立</button>
              </div>
           </div>
        </div>
     );
  };

  if (!user) return <LoginScreen onLogin={handleLogin} users={users} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#54534d] text-white flex-col hidden lg:flex">
         <div className="p-6 flex items-center gap-3 border-b border-white/10"><div className="w-8 h-10 text-white"><ZewuIcon/></div><div><h1 className="font-bold">澤物專案</h1><p className="text-[10px] opacity-60 tracking-widest">MANAGEMENT</p></div></div>
         <nav className="p-4 space-y-2 flex-1">
            {(user.role==='manager'||user.role==='engineer'||user.canViewDashboard) && <button onClick={()=>{setView('dash');setSelectedProj(null)}} className={`w-full text-left p-3 rounded flex items-center gap-3 ${view==='dash'?'bg-white/20':'hover:bg-white/10'}`}><LayoutDashboard className="w-5 h-5"/>總覽儀表板</button>}
            <button onClick={()=>{setView('proj');setProjFilter('ALL');setSelectedProj(null)}} className={`w-full text-left p-3 rounded flex items-center gap-3 ${view==='proj'||view==='detail'?'bg-white/20':'hover:bg-white/10'}`}><FolderKanban className="w-5 h-5"/>專案列表</button>
            {(user.role==='manager'||user.role==='engineer') && <button onClick={()=>{setView('team');setSelectedProj(null)}} className={`w-full text-left p-3 rounded flex items-center gap-3 ${view==='team'?'bg-white/20':'hover:bg-white/10'}`}><Users className="w-5 h-5"/>團隊管理</button>}
         </nav>
         <div className="p-4 border-t border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">{user.avatarInitials}</div><span className="font-bold text-sm">{user.name}</span></div>
            <button onClick={()=>setUser(null)}><LogOut className="w-5 h-5 text-white/70 hover:text-white"/></button>
         </div>
      </aside>
      
      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
         <header className="lg:hidden bg-white p-4 flex justify-between items-center shadow-sm border-b z-20">
            <div className="flex items-center gap-2 font-bold text-[#54534d]"><div className="h-6 w-5"><ZewuIcon/></div>澤物專案</div>
            <button onClick={()=>{if(confirm('登出?'))setUser(null)}}><LogOut className="w-5 h-5 text-slate-500"/></button>
         </header>
         <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto">
               {view==='dash' && <ProjectDashboard projects={projects} onSelectProject={handleSelectProj} onFilterClick={(f)=>{setProjFilter(f);setView('proj')}}/>}
               {view==='proj' && (
                  <div className="space-y-6 animate-fade-in">
                     <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-800">{projFilter==='ALL'?'所有專案':projFilter==='CONSTRUCTION'?'施工中':projFilter==='DESIGN_CONTACT'?'設計/接洽':'即將完工'}</h2>
                        <button onClick={()=>setShowNewModal(true)} className="bg-accent text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md"><Plus className="w-5 h-5"/>新增</button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {displayProjs.map(p=>(
                           <div key={p.id} onClick={()=>handleSelectProj(p)} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition-all group">
                              <div className="h-48 bg-slate-200 relative">
                                 <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                                 <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold shadow">{p.currentStage}</div>
                              </div>
                              <div className="p-5">
                                 <h3 className="font-bold text-lg text-slate-800 mb-1">{p.projectName}</h3>
                                 <p className="text-sm text-slate-500 mb-4">{p.assignedEmployee} | {p.clientName}</p>
                                 <div className="text-xs text-slate-400 border-t pt-3 flex justify-between"><span>{new Date(p.lastUpdatedTimestamp).toLocaleDateString()} 更新</span><span className="text-accent font-bold">查看 &rarr;</span></div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
               {view==='detail' && selectedProj && (
                  <ProjectDetail project={selectedProj} currentUser={user} onBack={()=>setView('proj')} onUpdate={async (p)=>{await setDoc(doc(db,"projects",p.id),p);setSelectedProj(p)}} onDelete={async (id)=>{await deleteDoc(doc(db,"projects",id));setSelectedProj(null);setView('proj')}} employeeNames={users.filter(u=>u.role==='employee').map(u=>u.name)}/>
               )}
               {view==='team' && (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">團隊管理</h2></div>
                     <div className="bg-white rounded-xl border shadow-sm p-6">
                        {users.map(u=>(<div key={u.id} className="flex justify-between border-b last:border-0 py-3"><div className="font-bold">{u.name} <span className="text-slate-400 font-normal text-sm">@{u.username}</span></div><div className="text-sm text-slate-500">{u.role}</div></div>))}
                     </div>
                  </div>
               )}
            </div>
         </div>
         {showNewModal && <NewModal/>}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);