import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { LayoutDashboard, FolderKanban, Users, Download, PenTool, Menu, X, LogOut, CheckCircle, Clock, Briefcase, AlertTriangle, Filter, ChevronRight, ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, Plus, User as UserIcon, Lock, ArrowRight as ArrowRightIcon, AlertCircle, UserCog, ShieldCheck, HardHat, Eye, Key, Edit2, Upload, Camera, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GoogleGenAI, Type } from "@google/genai";

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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

const usersCollection = collection(db, "users");
const projectsCollection = collection(db, "projects");

// --- UTILITIES ---

const getRandomCover = () => {
  return DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)];
};

const validateImageFile = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // 1. Check Size (1MB = 1,048,576 bytes)
    if (file.size > 1024 * 1024) {
      alert("圖片大小超過 1MB 限制，請壓縮後再上傳。");
      reject(false);
      return;
    }

    // 2. Check Aspect Ratio (Tolerance for 16:9)
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = img.width / img.height;
      if (ratio < 1.0) { // Vertical image
         const proceed = window.confirm("偵測到您上傳的是「直式圖片」，建議使用 16:9 橫式圖片以獲得最佳瀏覽體驗。\n\n是否仍要繼續？");
         if (!proceed) {
           reject(false);
           return;
         }
      }
      resolve(true);
    };
    img.onerror = () => {
      alert("無法讀取圖片檔案，請確認檔案格式是否正確。");
      reject(false);
    };
  });
};

const uploadImageFile = async (file: File, projectId: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `project-covers/${projectId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Upload failed", error);
    throw new Error("圖片上傳失敗，請檢查網路連線或稍後再試。");
  }
};

// ==========================================
// 3. GEMINI SERVICE (Lazy Init for APK Safety)
// ==========================================

const generateProjectReport = async (project: DesignProject): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API Key 未設定或環境變數讀取失敗，無法使用 AI 功能。");
      return "AI 服務目前無法使用。";
    }
    
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

    const ai = new GoogleGenAI({ apiKey });
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
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API Key 未設定，無法使用 AI 功能。");
      return { analysis: "無法連接 AI 服務", suggestions: [] };
    }

    const prompt = `
    針對以下室內設計專案問題進行分析與建議：
    專案：${project.projectName} (${project.currentStage})
    問題：${inputContent}
    `;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      analysis: "目前無法進行 AI 分析，請稍後再試。",
      suggestions: ["建議諮詢專業技師", "確認現場施工圖面", "與業主討論替代方案"]
    };
  }
};

// ==========================================
// 4. COMPONENTS
// ==========================================

// --- LoginScreen ---
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-2xl mb-4 shadow-xl">
          <PenTool className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">澤物專案管理</h1>
        <p className="text-slate-500 mt-2 font-medium">Interior Design Project Management</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">員工登入</h2>
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">帳號</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900 font-medium" placeholder="請輸入員工帳號" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">密碼</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900 font-medium" placeholder="請輸入密碼" />
            </div>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4" />{error}</div>}
          <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2">登入系統 <ArrowRightIcon className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
};

// --- NewProjectModal ---
const NewProjectModal: React.FC<{ currentUser: User; onClose: () => void; onSubmit: (project: DesignProject) => void; employeeNames: string[] }> = ({ currentUser, onClose, onSubmit, employeeNames }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(getRandomCover());

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
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const isValid = await validateImageFile(file);
        if (isValid) {
          setImageFile(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      } catch (err) {
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleRandomCover = () => {
    setPreviewUrl(getRandomCover());
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.clientName) {
      alert('請填寫專案名稱與客戶姓名');
      return;
    }
    setIsSubmitting(true);
    try {
      const projectId = `P${Date.now().toString().slice(-4)}`;
      let finalImageUrl = previewUrl;

      // Upload image if selected
      if (imageFile) {
        finalImageUrl = await uploadImageFile(imageFile, projectId);
      }

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
        imageUrl: finalImageUrl,
        history: [{ id: `h-${Date.now()}`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name, action: '建立專案', details: '專案初始化完成' }]
      };
      onSubmit(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("建立專案失敗，請稍後再試");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><div className="bg-accent p-1.5 rounded-lg"><Plus className="w-5 h-5 text-white" /></div>新增案場</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cover Image Selection - Improved for Mobile Touch */}
          <div className="space-y-3">
             <label className="block text-sm font-bold text-slate-700">封面照片</label>
             <div className="relative h-48 rounded-xl overflow-hidden border border-slate-200 group bg-slate-100">
                <img src={previewUrl} className="w-full h-full object-cover transition-opacity duration-300" alt="Cover Preview" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity">
                    <div className="relative">
                      <button type="button" className="bg-white text-slate-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-lg pointer-events-none">
                        <Upload className="w-4 h-4" /> 上傳照片
                      </button>
                      <input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                      />
                    </div>
                    <button type="button" onClick={handleRandomCover} className="bg-white/90 text-slate-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-white transition-colors shadow-lg z-10">
                       <RefreshCw className="w-4 h-4" /> 隨機產生
                    </button>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                   建議比例 16:9 | 限 1MB
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">案名 *</label><input type="text" required className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} placeholder="例如：信義區張公館" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">客戶姓名 *</label><input type="text" required className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">地址/地點</label><input type="text" className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">預計完工日</label><input type="date" className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.estimatedCompletionDate} onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})} /></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">負責員工</label>
                {currentUser.role === 'manager' || currentUser.role === 'engineer' ? (
                   <select className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.assignedEmployee} onChange={e => setFormData({...formData, assignedEmployee: e.target.value})}>
                     {employeeNames.map(name => <option key={name} value={name}>{name}</option>)}
                   </select>
                ) : <input type="text" disabled className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-100 text-slate-500" value={formData.assignedEmployee} />}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">目前階段</label>
                <select className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.currentStage} onChange={e => setFormData({...formData, currentStage: e.target.value as ProjectStage})}>
                  {Object.values(ProjectStage).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>
               <div><label className="block text-sm font-bold text-slate-700 mb-1">最新進度描述</label><textarea rows={4} className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.latestProgressNotes} onChange={e => setFormData({...formData, latestProgressNotes: e.target.value})} /></div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-4">
             <div><label className="block text-sm font-bold text-slate-700 mb-1">客戶需求</label><textarea rows={2} className="w-full border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-900 focus:ring-accent focus:border-accent" value={formData.clientRequests} onChange={e => setFormData({...formData, clientRequests: e.target.value})} /></div>
          </div>
        </form>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition-colors">取消</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg bg-accent text-white font-bold hover:bg-amber-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95">{isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />處理中...</> : '建立案場'}</button>
        </div>
      </div>
    </div>
  );
};

// --- TeamManagement ---
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
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) { alert("請填寫完整資訊"); return; }
    if (users.some(u => u.username === newUsername)) { alert("此帳號已存在"); return; }
    const newUser: User = { id: `u-${Date.now()}`, name: newName, username: newUsername, password: newPassword, role: newRole, avatarInitials: newName.charAt(0), canViewDashboard: newRole !== 'employee' ? true : newCanViewDashboard };
    onAddUser(newUser);
    setNewName(''); setNewUsername(''); setNewPassword(''); setNewRole('employee'); setNewCanViewDashboard(false); setIsAdding(false);
  };

  const startEdit = (user: User) => { setEditingId(user.id); setEditName(user.name); setEditRole(user.role); setEditCanViewDashboard(user.canViewDashboard || false); setEditPassword(''); };
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

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'manager': return <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><ShieldCheck className="w-3 h-3" /> Admin</span>;
      case 'engineer': return <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><HardHat className="w-3 h-3" /> Engineer</span>;
      default: return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><UserIcon className="w-3 h-3" /> Designer</span>;
    }
  };
  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none font-medium";

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCog className="w-6 h-6 text-slate-600" />團隊成員管理</h2></div>
        <button onClick={() => setIsAdding(true)} className="w-full sm:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold"><Plus className="w-4 h-4" />新增員工</button>
      </div>
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Plus className="w-5 h-5 text-accent" /> 新增成員帳號</h3><button onClick={() => setIsAdding(false)}><X className="w-5 h-5 text-slate-500"/></button></div>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">姓名</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">帳號</label><input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">密碼</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="w-full md:w-64"><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色</label><select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className={inputClass}><option value="employee">設計師</option><option value="manager">管理員</option><option value="engineer">工程師</option></select></div>
              {newRole === 'employee' && <div className="flex items-center gap-3 pb-3"><input type="checkbox" checked={newCanViewDashboard} onChange={e => setNewCanViewDashboard(e.target.checked)} className="w-5 h-5 rounded" /><label className="text-sm font-bold text-slate-700">允許查看儀表板</label></div>}
              <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold ml-auto">建立帳號</button>
            </div>
          </form>
        </div>
      )}
      
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.length === 0 ? <p className="text-center text-slate-400 py-4">讀取中或無成員資料...</p> : users.map(user => (
          <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-base font-bold border border-slate-200 shadow-sm">
                      {user.avatarInitials}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {user.name}
                        {user.id === currentUser.id && <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">ME</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded w-fit mt-1">@{user.username}</div>
                    </div>
                  </div>
                  {renderRoleBadge(user.role)}
             </div>
             <div className="border-t border-slate-100 pt-3 flex justify-end gap-2">
                 {user.id !== currentUser.id && <button onClick={() => onDeleteUser(user.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4"/></button>}
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="px-6 py-4">姓名 / 帳號</th><th className="px-6 py-4">角色</th><th className="px-6 py-4">權限設定</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-4">{editingId === user.id ? <><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} /><div className="text-xs text-slate-400">@{user.username}</div></> : <div className="font-bold text-slate-800">{user.name}<div className="text-xs text-slate-400 font-normal">@{user.username}</div></div>}</td>
                <td className="px-6 py-4">{editingId === user.id ? <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} className={inputClass}><option value="employee">設計師</option><option value="manager">管理員</option><option value="engineer">工程師</option></select> : renderRoleBadge(user.role)}</td>
                <td className="px-6 py-4">{editingId === user.id ? <div className="space-y-2"><div className="flex gap-2"><input type="checkbox" disabled={editRole !== 'employee'} checked={editRole !== 'employee' ? true : editCanViewDashboard} onChange={e => setEditCanViewDashboard(e.target.checked)} /> <span>查看儀表板</span></div><input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="新密碼" className="text-xs border rounded p-1" /></div> : ((user.role === 'manager' || user.role === 'engineer') ? '全域權限' : user.canViewDashboard ? '可看儀表板' : '限制存取')}</td>
                <td className="px-6 py-4 text-right">{editingId === user.id ? <div className="flex justify-end gap-2"><button onClick={saveEdit}><Save className="w-4 h-4 text-emerald-600"/></button><button onClick={() => setEditingId(null)}><X className="w-4 h-4 text-slate-400"/></button></div> : <div className="flex justify-end gap-2"><button onClick={() => startEdit(user)}><Edit2 className="w-4 h-4 text-slate-400"/></button>{user.id !== currentUser.id && <button onClick={() => onDeleteUser(user.id)}><Trash2 className="w-4 h-4 text-red-400"/></button>}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- ProjectDashboard ---
const ProjectDashboard: React.FC<{ projects: DesignProject[]; onSelectProject: (project: DesignProject) => void; employeeNames: string[]; onFilterClick: (filter: ProjectFilterType) => void; }> = ({ projects, onSelectProject, employeeNames, onFilterClick }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');
  const filteredProjects = selectedEmployee === 'All' ? projects : projects.filter(p => p.assignedEmployee === selectedEmployee);
  const stageCounts = filteredProjects.reduce((acc, p) => { acc[p.currentStage] = (acc[p.currentStage] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = [{ name: ProjectStage.CONTACT, value: stageCounts[ProjectStage.CONTACT] || 0, color: '#94a3b8' }, { name: ProjectStage.DESIGN, value: stageCounts[ProjectStage.DESIGN] || 0, color: '#3b82f6' }, { name: ProjectStage.CONSTRUCTION, value: stageCounts[ProjectStage.CONSTRUCTION] || 0, color: '#f59e0b' }, { name: ProjectStage.ACCEPTANCE, value: stageCounts[ProjectStage.ACCEPTANCE] || 0, color: '#a855f7' }, { name: ProjectStage.COMPLETED, value: stageCounts[ProjectStage.COMPLETED] || 0, color: '#10b981' },].filter(d => d.value > 0);
  
  const today = new Date();
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = filteredProjects.filter(p => { if (p.currentStage === ProjectStage.COMPLETED) return false; const date = new Date(p.estimatedCompletionDate); return date >= today && date <= thirtyDaysLater; }).sort((a, b) => new Date(a.estimatedCompletionDate).getTime() - new Date(b.estimatedCompletionDate).getTime());

  const stats = [
    { label: '負責案場總數', value: filteredProjects.length, icon: Briefcase, color: 'bg-slate-100 text-slate-600', filterType: 'ALL' as ProjectFilterType },
    { label: '施工中案場', value: stageCounts[ProjectStage.CONSTRUCTION] || 0, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600', filterType: 'CONSTRUCTION' as ProjectFilterType },
    { label: '設計/接洽中', value: (stageCounts[ProjectStage.DESIGN] || 0) + (stageCounts[ProjectStage.CONTACT] || 0), icon: Clock, color: 'bg-blue-100 text-blue-600', filterType: 'DESIGN_CONTACT' as ProjectFilterType },
    { label: '即將完工', value: upcomingDeadlines.length, icon: CheckCircle, color: 'bg-purple-100 text-purple-600', filterType: 'UPCOMING' as ProjectFilterType },
  ];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex flex-col md:flex-row justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-800">總覽儀表板</h2><p className="text-slate-500 text-sm font-medium">{selectedEmployee === 'All' ? '全公司案場' : `${selectedEmployee} 的案場`}</p></div><div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200"><Filter className="w-4 h-4 text-slate-400" /><select className="bg-transparent font-bold text-slate-700 outline-none" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}><option value="All">顯示全部員工</option>{employeeNames.map(emp => <option key={emp} value={emp}>{emp}</option>)}</select></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <button key={idx} onClick={() => onFilterClick(stat.filterType)} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:scale-[1.02] transition-all text-left group">
            <div className={`p-3 rounded-xl w-fit ${stat.color} mb-3`}><stat.icon className="w-6 h-6" /></div><div><p className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</p><div className="flex justify-between items-center mt-1"><p className="text-xs font-bold text-slate-500 uppercase">{stat.label}</p><ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" /></div></div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col"><h3 className="font-bold text-slate-800 mb-6">階段分佈</h3><div className="flex-1 min-h-[250px]"><ResponsiveContainer><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col"><h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" />即將完工 (30天內)</h3><div className="flex-1 overflow-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-slate-500 uppercase bg-slate-50 rounded-lg"><tr><th className="px-4 py-3">案名</th><th className="px-4 py-3">負責人</th><th className="px-4 py-3">階段</th><th className="px-4 py-3">完工日</th></tr></thead><tbody>{upcomingDeadlines.map(p => <tr key={p.id} onClick={() => onSelectProject(p)} className="hover:bg-slate-50 cursor-pointer transition-colors"><td className="px-4 py-3 font-bold">{p.projectName}</td><td className="px-4 py-3">{p.assignedEmployee}</td><td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{p.currentStage}</span></td><td className="px-4 py-3 font-mono text-slate-600 font-medium">{p.estimatedCompletionDate}</td></tr>)}</tbody></table></div></div>
      </div>
    </div>
  );
};

// --- ProjectDetail ---
const ProjectDetail: React.FC<{ project: DesignProject; currentUser: User; onBack: () => void; onUpdateProject: (p: DesignProject) => void; onDeleteProject: (id: string) => void; employeeNames: string[] }> = ({ project, currentUser, onBack, onUpdateProject, onDeleteProject, employeeNames }) => {
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

  useEffect(() => setFormData(project), [project]);
  const handleInputChange = (field: keyof DesignProject, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleAddProgress = () => {
    if (!progressDescription.trim()) { alert('請輸入進度'); return; }
    const timestamp = Date.now();
    const newNote = `【${progressCategory}】${progressDescription}`;
    const newLog: HistoryLog = { id: `h-${timestamp}`, timestamp, userId: currentUser.id, userName: currentUser.name, action: progressCategory, details: progressDescription, field: 'latestProgressNotes', oldValue: formData.latestProgressNotes, newValue: newNote };
    const updated = { ...formData, latestProgressNotes: newNote, lastUpdatedTimestamp: timestamp, history: [newLog, ...(formData.history || [])] };
    setFormData(updated); onUpdateProject(updated); setProgressDescription('');
  };
  const handleSaveGeneral = () => { onUpdateProject({...formData, lastUpdatedTimestamp: Date.now()}); alert('已儲存'); };
  const handleDelete = () => { if (window.confirm('確定刪除？')) onDeleteProject(project.id); };
  const handleGenerateReport = async () => { setIsGeneratingReport(true); const report = await generateProjectReport(formData); setReportResult(report); setIsGeneratingReport(false); };
  const handleAnalyzeIssue = async () => { if (!issueInput.trim()) return; setIsAnalyzing(true); const res = await analyzeDesignIssue(formData, issueInput); setAnalysisResult(res); setIsAnalyzing(false); };
  
  const handleUpdateCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       try {
         setIsUploading(true);
         const isValid = await validateImageFile(file);
         if (isValid) {
            const url = await uploadImageFile(file, project.id);
            handleInputChange('imageUrl', url);
            // Auto save the image update
            onUpdateProject({ ...formData, imageUrl: url, lastUpdatedTimestamp: Date.now() });
            alert("封面更新成功！");
         }
       } catch (err) {
         console.error(err);
         // Error handled in utility
       } finally {
         setIsUploading(false);
       }
    }
  };

  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 outline-none font-medium transition-shadow";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up font-sans">
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md group">
        <img src={formData.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
            <h1 className="text-3xl font-bold leading-tight">{project.projectName}</h1>
            <p className="font-medium text-slate-200">{project.clientName} | {project.address}</p>
        </div>
        <div className="absolute top-4 right-4 z-10">
             {/* Mobile-Friendly File Input Overlay */}
             <div className="relative">
                <button className={`bg-white/90 backdrop-blur text-slate-800 p-2 rounded-lg hover:bg-white transition-colors shadow-lg flex items-center gap-2 font-bold text-xs ${isUploading ? 'opacity-50' : ''}`}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4"/>}
                    更換封面
                </button>
                <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept="image/*" 
                    onChange={handleUpdateCover} 
                    disabled={isUploading}
                />
            </div>
        </div>
      </div>
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm"><button onClick={onBack} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold transition-colors"><ArrowLeft className="w-4 h-4"/>返回</button><button onClick={handleSaveGeneral} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4"/>儲存</button></div>
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200"><button onClick={() => setActiveTab('details')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>專案執行</button><button onClick={() => setActiveTab('ai')} className={`px-4 py-2 rounded-lg font-bold flex gap-2 transition-all ${activeTab === 'ai' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}><Sparkles className="w-4 h-4"/>AI 助理</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'details' ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4"><h3 className="font-bold text-slate-800 flex gap-2 items-center"><PlusCircle className="w-5 h-5 text-accent"/>新增施工日誌</h3><div className="flex flex-col sm:flex-row gap-4"><select value={progressCategory} onChange={e => setProgressCategory(e.target.value)} className="border border-slate-300 rounded-lg p-2.5 font-medium text-sm text-slate-700 bg-slate-50">{CONSTRUCTION_PHASES.map(p => <option key={p} value={p}>{p}</option>)}</select><input value={progressDescription} onChange={e => setProgressDescription(e.target.value)} placeholder="輸入今日進度..." className="flex-1 border border-slate-300 rounded-lg p-2.5 font-medium text-sm bg-white" /><button onClick={handleAddProgress} className="bg-accent text-white px-4 rounded-lg flex items-center justify-center hover:bg-amber-700 transition-colors"><Send className="w-4 h-4"/></button></div></div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"><h3 className="font-bold mb-6 flex gap-2 items-center text-slate-800"><History className="w-5 h-5 text-slate-400"/>時間軸</h3><div className="space-y-6 pl-4 border-l-2 border-slate-100">{(formData.history || []).sort((a,b) => b.timestamp - a.timestamp).map(log => <div key={log.id} className="relative pl-4 group"><div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-slate-200 border-4 border-white shadow-sm group-hover:bg-accent transition-colors"></div><div className="text-xs font-bold text-slate-400 mb-1">{new Date(log.timestamp).toLocaleString()} - {log.userName}</div><div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group-hover:border-slate-200 transition-colors"><p className="font-bold text-slate-800 text-sm mb-1">{log.action}</p><p className="text-slate-600 text-sm leading-relaxed">{log.details}</p></div></div>)}</div></div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"><h3 className="font-bold flex gap-2 text-slate-800"><FileText className="w-5 h-5"/>基本資料</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 uppercase mb-1">階段</label><select value={formData.currentStage} onChange={e => handleInputChange('currentStage', e.target.value)} className={inputClass}>{Object.values(ProjectStage).map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500 uppercase mb-1">完工日</label><input type="date" value={formData.estimatedCompletionDate} onChange={e => handleInputChange('estimatedCompletionDate', e.target.value)} className={inputClass}/></div></div><div><label className="text-xs font-bold text-slate-500 uppercase mb-1">客戶需求</label><textarea rows={3} value={formData.clientRequests} onChange={e => handleInputChange('clientRequests', e.target.value)} className={inputClass}/></div><div><label className="text-xs font-bold text-slate-500 uppercase mb-1">內部備註</label><textarea rows={2} value={formData.internalNotes} onChange={e => handleInputChange('internalNotes', e.target.value)} className={inputClass}/></div></div>
              {(currentUser.role === 'manager' || currentUser.role === 'engineer') && <div className="border border-red-200 bg-red-50 p-4 rounded-xl flex justify-between items-center"><span className="text-red-600 font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>危險區域</span><button onClick={handleDelete} className="text-red-600 border border-red-200 bg-white px-3 py-1.5 rounded-lg hover:bg-red-50 font-bold text-sm transition-colors">刪除專案</button></div>}
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm"><div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex gap-2"><FileText className="text-purple-600 w-5 h-5"/>智能週報</h3><button onClick={handleGenerateReport} disabled={isGeneratingReport} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">{isGeneratingReport ? '生成中...' : '生成週報'}</button></div>{reportResult && <div className="bg-slate-50 p-4 rounded-xl text-sm whitespace-pre-wrap leading-relaxed border border-slate-200 text-slate-700">{reportResult}</div>}</div>
              <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm"><h3 className="font-bold mb-4 flex gap-2 text-slate-800"><AlertTriangle className="text-purple-600 w-5 h-5"/>問題分析</h3><textarea value={issueInput} onChange={e => setIssueInput(e.target.value)} className={inputClass} placeholder="輸入問題..."/><button onClick={handleAnalyzeIssue} disabled={isAnalyzing} className="w-full bg-slate-800 hover:bg-slate-900 text-white mt-3 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50">{isAnalyzing ? '分析中...' : '開始分析'}</button>{analysisResult && <div className="mt-4 bg-purple-50 p-4 rounded-xl border border-purple-100"><p className="text-purple-900 mb-3 font-medium">{analysisResult.analysis}</p><ul className="space-y-2">{analysisResult.suggestions.map((s, i) => <li key={i} className="flex gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-purple-100"><CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0"/>{s}</li>)}</ul></div>}</div>
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-500 text-xs mb-4 uppercase tracking-wide">負責人</h3><div className="flex items-center gap-3"><div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-lg text-slate-600 border border-slate-200">{project.assignedEmployee.charAt(0)}</div><div><span className="font-bold text-lg text-slate-900">{project.assignedEmployee}</span><p className="text-xs text-slate-500 font-medium">Lead Designer</p></div></div>{(currentUser.role === 'manager' || currentUser.role === 'engineer') && <select value={formData.assignedEmployee} onChange={e => handleInputChange('assignedEmployee', e.target.value)} className="mt-4 w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 font-medium text-sm outline-none">{employeeNames.map(n => <option key={n} value={n}>{n}</option>)}</select>}</div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-500 text-xs mb-4 uppercase tracking-wide">聯絡資訊</h3><div className="space-y-4"><div><div className="flex gap-2 mb-1.5"><Phone className="w-4 h-4 text-slate-400"/><span className="text-xs font-bold text-slate-600">電話</span></div><input value={formData.contactPhone} onChange={e => handleInputChange('contactPhone', e.target.value)} className={inputClass}/></div><div><div className="flex gap-2 mb-1.5"><MapPin className="w-4 h-4 text-slate-400"/><span className="text-xs font-bold text-slate-600">地址</span></div><input value={formData.address} onChange={e => handleInputChange('address', e.target.value)} className={inputClass}/></div></div></div>
        </div>
      </div>
    </div>
  );
};

// --- Layout ---
const Layout: React.FC<{ children: React.ReactNode; activeTab: string; onTabChange: (tab: any) => void; currentUser: User; onLogout: () => void; onExportData: () => void }> = ({ children, activeTab, onTabChange, currentUser, onLogout, onExportData }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canViewDashboard = currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard;
  const canManageTeam = currentUser.role === 'manager' || currentUser.role === 'engineer';
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0 flex flex-col shadow-2xl lg:shadow-none`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center"><div className="flex gap-3 items-center"><div className="bg-accent/10 p-2 rounded-lg"><PenTool className="text-accent"/></div><div><h1 className="font-bold tracking-wide">澤物專案</h1><span className="text-[10px] text-slate-400 tracking-widest uppercase font-medium">Management</span></div></div><button className="lg:hidden p-1 hover:bg-slate-800 rounded" onClick={() => setIsSidebarOpen(false)}><X className="text-slate-400 w-5 h-5"/></button></div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {canViewDashboard && <button onClick={() => { onTabChange('dashboard'); setIsSidebarOpen(false); }} className={`flex w-full p-3 rounded-xl gap-3 font-medium text-sm transition-all ${activeTab === 'dashboard' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard className="w-5 h-5"/>總覽儀表板</button>}
          <button onClick={() => { onTabChange('projects'); setIsSidebarOpen(false); }} className={`flex w-full p-3 rounded-xl gap-3 font-medium text-sm transition-all ${activeTab === 'projects' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><FolderKanban className="w-5 h-5"/>{canViewDashboard ? '所有專案' : '我的專案'}</button>
          {canManageTeam && <><div className="my-2 border-t border-slate-800 mx-2"></div><p className="text-xs text-slate-500 font-bold px-4 mb-2 uppercase tracking-wider">管理</p><button onClick={() => { onTabChange('team'); setIsSidebarOpen(false); }} className={`flex w-full p-3 rounded-xl gap-3 font-medium text-sm transition-all ${activeTab === 'team' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Users className="w-5 h-5"/>團隊成員</button></>}
          {(currentUser.role === 'manager' || currentUser.role === 'engineer') && <div className="pt-4 mt-auto"><button onClick={onExportData} className="flex w-full p-3 rounded-xl gap-3 text-slate-400 hover:bg-slate-800 hover:text-emerald-400 border border-slate-800 transition-colors font-medium text-sm"><Download className="w-5 h-5"/>匯出資料 (CSV)</button></div>}
        </nav>
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center"><div className="flex gap-3 items-center"><div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm border-2 border-slate-800">{currentUser.avatarInitials}</div><div><p className="text-sm font-bold truncate w-24">{currentUser.name}</p><p className="text-xs text-slate-500 font-medium">{currentUser.role}</p></div></div><button onClick={onLogout} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><LogOut className="text-slate-500 hover:text-white w-5 h-5"/></button></div>
      </aside>
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm"><div className="flex gap-2 font-bold text-slate-800 items-center"><PenTool className="text-accent w-5 h-5"/>澤物專案</div><button onClick={() => setIsSidebarOpen(true)} className="p-2 active:bg-slate-100 rounded-full"><Menu className="text-slate-700 w-6 h-6"/></button></header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth"><div className="max-w-7xl mx-auto">{children}</div></main>
      </div>
    </div>
  );
};

// ==========================================
// 5. MAIN APP
// ==========================================

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [view, setView] = useState<'dashboard' | 'projects' | 'detail' | 'team'>('dashboard');
  const [previousView, setPreviousView] = useState<'dashboard' | 'projects'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectFilter, setProjectFilter] = useState<ProjectFilterType>('ALL');

  useEffect(() => {
    // 1. Sync Users
    const unsubUsers = onSnapshot(query(usersCollection, orderBy("name")), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      if (fetchedUsers.length === 0) {
        // Init default users if DB empty
        INITIAL_USERS.forEach(async (u) => {
          await setDoc(doc(db, "users", u.id), u);
        });
      } else {
        setUsers(fetchedUsers);
      }
    }, (error) => {
      console.error("Users Sync Error:", error);
    });

    // 2. Sync Projects
    const unsubProjects = onSnapshot(query(projectsCollection, orderBy("lastUpdatedTimestamp", "desc")), (snapshot) => {
      const fetchedProjects = snapshot.docs.map(doc => doc.data() as DesignProject);
      setProjects(fetchedProjects);
      setIsLoading(false);
    }, (error) => {
      console.error("Projects Sync Error:", error);
      setIsLoading(false);
    });

    return () => { unsubUsers(); unsubProjects(); };
  }, []);

  const employeeNames = useMemo(() => users.filter(u => u.role === 'employee').map(u => u.name), [users]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'manager' || user.role === 'engineer' || user.canViewDashboard) setView('dashboard');
    else setView('projects');
  };
  const handleLogout = () => { setCurrentUser(null); setSelectedProject(null); setView('dashboard'); setProjectFilter('ALL'); };
  const handleAddUser = async (u: User) => setDoc(doc(db, "users", u.id), u);
  const handleUpdateUser = async (u: User) => { await setDoc(doc(db, "users", u.id), u); if (currentUser?.id === u.id) setCurrentUser(u); };
  const handleDeleteUser = async (id: string) => deleteDoc(doc(db, "users", id));
  
  const handleSelectProject = (p: DesignProject) => { if (view === 'dashboard' || view === 'projects') setPreviousView(view); setSelectedProject(p); setView('detail'); };
  const handleDashboardFilterClick = (type: ProjectFilterType) => { setProjectFilter(type); setPreviousView('dashboard'); setView('projects'); };
  const handleBack = () => { setSelectedProject(null); setView(previousView); };
  const handleTabChange = (tab: any) => { setView(tab); if (tab === 'projects') setProjectFilter('ALL'); if (tab === 'dashboard' || tab === 'team') setSelectedProject(null); };
  
  const handleUpdateProject = async (p: DesignProject) => { await setDoc(doc(db, "projects", p.id), p); setSelectedProject(p); };
  const handleDeleteProject = async (id: string) => { await deleteDoc(doc(db, "projects", id)); setSelectedProject(null); setView(previousView); };
  const handleCreateProject = async (p: DesignProject) => { await setDoc(doc(db, "projects", p.id), p); setShowNewProjectModal(false); handleSelectProject(p); };
  
  // --- Updated Export Function with Full History ---
  const handleExportData = () => {
    if (projects.length === 0) return alert("無資料");
    
    // Headers
    const headers = ['案名', '客戶', '負責人', '階段', '完工日', '地址', '電話', '進度', '需求', '備註', '完整時間軸紀錄'];
    
    // Process Rows
    const rows = projects.map(p => {
        // Format History Logs
        const historyText = (p.history || [])
          .sort((a, b) => b.timestamp - a.timestamp) // Newest first
          .map(h => {
             const time = new Date(h.timestamp).toLocaleString();
             return `[${time}] ${h.userName} (${h.action}): ${h.details}`;
          })
          .join('\n'); // Separate by newline

        return [
            p.projectName, 
            p.clientName, 
            p.assignedEmployee, 
            p.currentStage, 
            p.estimatedCompletionDate, 
            p.address, 
            p.contactPhone, 
            `"${(p.latestProgressNotes||'').replace(/"/g,'""')}"`, 
            `"${(p.clientRequests||'').replace(/"/g,'""')}"`, 
            `"${(p.internalNotes||'').replace(/"/g,'""')}"`,
            `"${historyText.replace(/"/g,'""')}"` // Add history column
        ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `Projects_Full_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(link); link.click();
  };

  if (isLoading) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 font-sans"><Loader2 className="w-10 h-10 text-accent animate-spin"/><p className="text-slate-500 font-bold">載入資料中...</p></div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={users} />;

  let displayProjects = (currentUser.role === 'manager' || currentUser.role === 'engineer') ? projects : projects.filter(p => p.assignedEmployee === currentUser.name);
  if (projectFilter === 'CONSTRUCTION') displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.CONSTRUCTION);
  else if (projectFilter === 'DESIGN_CONTACT') displayProjects = displayProjects.filter(p => p.currentStage === ProjectStage.DESIGN || p.currentStage === ProjectStage.CONTACT);
  else if (projectFilter === 'UPCOMING') {
    const today = new Date(); const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    displayProjects = displayProjects.filter(p => { if (p.currentStage === ProjectStage.COMPLETED) return false; const d = new Date(p.estimatedCompletionDate); return d >= today && d <= thirtyDaysLater; });
  }

  const getFilterName = () => { switch(projectFilter) { case 'CONSTRUCTION': return '施工中案件'; case 'DESIGN_CONTACT': return '設計/接洽中'; case 'UPCOMING': return '即將完工'; default: return '所有專案列表'; }};

  return (
    <Layout activeTab={view === 'detail' ? 'projects' : view} onTabChange={handleTabChange} currentUser={currentUser} onLogout={handleLogout} onExportData={handleExportData}>
      {view === 'dashboard' && (currentUser.role === 'manager' || currentUser.role === 'engineer' || currentUser.canViewDashboard) && <ProjectDashboard projects={projects} onSelectProject={handleSelectProject} employeeNames={employeeNames} onFilterClick={handleDashboardFilterClick}/>}
      {view === 'team' && (currentUser.role === 'manager' || currentUser.role === 'engineer') && <TeamManagement users={users} currentUser={currentUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser}/>}
      {view === 'projects' && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200"><div><div className="flex items-center gap-2">{projectFilter !== 'ALL' && <button onClick={() => setView('dashboard')}><ArrowLeft className="w-5 h-5 text-slate-400"/></button>}<h2 className="text-2xl font-bold text-slate-800">{(currentUser.role === 'manager' || currentUser.role === 'engineer') ? getFilterName() : '我的專案'}</h2></div><p className="text-slate-500 text-sm mt-1 font-medium">共 {displayProjects.length} 個案場</p></div><div className="flex gap-2 w-full md:w-auto">{projectFilter !== 'ALL' && <button onClick={() => setProjectFilter('ALL')} className="px-4 py-2 border rounded-lg text-slate-600 font-medium hover:bg-slate-50">清除篩選</button>}<button onClick={() => setShowNewProjectModal(true)} className="bg-accent text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-amber-700 transition-colors"><Plus className="w-5 h-5"/>新增案場</button></div></div>
          {displayProjects.length === 0 ? <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200"><p className="text-slate-400 font-medium text-lg">無符合資料</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{displayProjects.map(p => <div key={p.id} onClick={() => handleSelectProject(p)} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"><div className="h-48 bg-slate-100 relative overflow-hidden"><img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/><div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/50 to-transparent"></div><div className="absolute top-3 right-3"><span className={`px-2.5 py-1 rounded-md text-xs font-bold backdrop-blur-md shadow-sm ${p.currentStage === '施工中' ? 'bg-amber-500/90 text-white' : 'bg-white/90 text-slate-800'}`}>{p.currentStage}</span></div></div><div className="p-5 flex-1 flex flex-col"><h3 className="font-bold text-lg mb-1 text-slate-800 line-clamp-1">{p.projectName}</h3><p className="text-slate-500 text-sm mb-4 font-medium">{p.assignedEmployee} | {p.clientName}</p><div className="mt-auto pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400 font-medium"><span>更新: {new Date(p.lastUpdatedTimestamp).toLocaleDateString()}</span><span className="text-accent font-bold group-hover:text-amber-700 transition-colors flex items-center gap-1">查看詳情 <ArrowRightIcon className="w-3 h-3"/></span></div></div></div>)}</div>}
        </div>
      )}
      {view === 'detail' && selectedProject && <ProjectDetail project={selectedProject} currentUser={currentUser} onBack={handleBack} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} employeeNames={employeeNames}/>}
      {showNewProjectModal && <NewProjectModal currentUser={currentUser} onClose={() => setShowNewProjectModal(false)} onSubmit={handleCreateProject} employeeNames={employeeNames}/>}
    </Layout>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);