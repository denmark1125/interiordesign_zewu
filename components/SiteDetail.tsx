
import React, { useState, useEffect } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User, ScheduleItem, AIAnalysisResult } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { generateProjectReport, analyzeDesignIssue } from '../services/geminiService';
import { ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, CheckCircle, AlertTriangle, Calendar, Clock, Camera, Share, Edit, X, ChevronLeft, ChevronRight, Eye, Plus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { uploadImage } from '../services/firebase';

interface ProjectDetailProps {
  project: DesignProject;
  currentUser: User;
  onBack: () => void;
  onUpdateProject: (updatedProject: DesignProject) => void;
  onDeleteProject: (projectId: string) => void;
  employeeNames: string[];
}

// Custom Zewu Icon for Export
const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const validateImageFile = (file: File): boolean => {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    alert(`圖片過大 (${(file.size / 1024 / 1024).toFixed(2)}MB)。請上傳小於 2MB 的圖片。`);
    return false;
  }
  return true;
};

// --- Simple Calendar Component ---
const SimpleCalendar: React.FC<{ schedule: ScheduleItem[] }> = ({ schedule }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isWorkDay = (day: number) => {
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0,0,0,0);

    return schedule.some(item => {
        if (!item.startDate || !item.endDate) return false;
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        return checkDate >= start && checkDate <= end;
    });
  };

  const getWorkPhases = (day: number) => {
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0,0,0,0);

    return schedule.filter(item => {
        if (!item.startDate || !item.endDate) return false;
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        return checkDate >= start && checkDate <= end;
    }).map(i => i.phase);
  };

  const days = [];
  // Empty slots for previous month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-10 sm:h-14"></div>);
  }
  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const active = isWorkDay(d);
    const phases = getWorkPhases(d);
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

    days.push(
      <div key={d} className={`h-10 sm:h-14 border border-slate-50 relative flex flex-col items-center justify-center rounded-lg transition-colors group ${active ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white'}`}>
        <span className={`text-xs font-bold ${isToday ? 'bg-slate-800 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-700'}`}>{d}</span>
        {active && (
            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-accent"></div>
        )}
        {/* Tooltip for desktop */}
        {active && (
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg z-10 whitespace-nowrap">
                {phases.join(', ')}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500" />
                {year}年 {month + 1}月 施工行事曆
            </h4>
            <div className="flex gap-2">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-xs font-bold text-slate-400">{d}</div>
            ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
            {days}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 justify-end">
            <div className="w-2 h-2 rounded-full bg-accent"></div>
            <span>有施工安排</span>
        </div>
    </div>
  );
};


const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, onDeleteProject, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'ai'>('details');
  const [formData, setFormData] = useState<DesignProject>(project);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [newCustomPhase, setNewCustomPhase] = useState(''); // State for custom phase input
  
  const [progressCategory, setProgressCategory] = useState<string>(CONSTRUCTION_PHASES[0]);
  const [progressDescription, setProgressDescription] = useState<string>('');

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [issueInput, setIssueInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setFormData(project);
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleScheduleChange = (phase: string, type: 'startDate' | 'endDate', value: string) => {
    const currentSchedule = formData.schedule || [];
    const existingItemIndex = currentSchedule.findIndex(item => item.phase === phase);
    
    let newSchedule = [...currentSchedule];

    if (existingItemIndex > -1) {
      newSchedule[existingItemIndex] = {
        ...newSchedule[existingItemIndex],
        [type]: value
      };
    } else {
      newSchedule.push({
        phase,
        startDate: type === 'startDate' ? value : '',
        endDate: type === 'endDate' ? value : ''
      });
    }

    // Clean up empty entries
    newSchedule = newSchedule.filter(item => item.startDate || item.endDate);

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
  };

  const handleAddCustomPhase = () => {
    if (!newCustomPhase.trim()) {
        alert("請輸入工項名稱");
        return;
    }
    // Check if already exists in standard or custom
    if (CONSTRUCTION_PHASES.includes(newCustomPhase) || (formData.schedule || []).some(s => s.phase === newCustomPhase)) {
        alert("此工項已存在");
        return;
    }

    // Add empty placeholder to schedule so it shows up in the list
    const newSchedule = [...(formData.schedule || []), { phase: newCustomPhase, startDate: '', endDate: '' }];
    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    setNewCustomPhase('');
  };

  const handleDeleteScheduleItem = (phase: string) => {
      // Immediate delete without confirm prompt for smoother UX in Edit Mode
      const newSchedule = (formData.schedule || []).filter(item => item.phase !== phase);
      const updatedProject = {
          ...formData,
          schedule: newSchedule,
          lastUpdatedTimestamp: Date.now()
      };

      setFormData(updatedProject);
      onUpdateProject(updatedProject); // Immediate save
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) {
        e.target.value = ''; 
        return;
    }

    setIsUploading(true);
    try {
        // 使用集中管理的 uploadImage
        const url = await uploadImage(file);
        const updatedProject = { ...formData, imageUrl: url, lastUpdatedTimestamp: Date.now() };
        setFormData(updatedProject);
        onUpdateProject(updatedProject);
        alert('封面照片已更新');
    } catch (error: any) {
        alert(error.message || '上傳失敗');
    } finally {
        setIsUploading(false);
        e.target.value = ''; 
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
    let hasChanges = false;
    const newLogs: HistoryLog[] = [];

    if (formData.currentStage !== project.currentStage) {
       newLogs.push({
        id: `h-${Date.now()}-3`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '變更專案階段', details: `專案階段已正式進入：${formData.currentStage}`, field: 'currentStage', oldValue: project.currentStage, newValue: formData.currentStage
      });
      hasChanges = true;
    }
    
    if (JSON.stringify(formData.schedule) !== JSON.stringify(project.schedule)) {
        hasChanges = true;
    }

    const fieldsToCheck: (keyof DesignProject)[] = ['clientRequests', 'assignedEmployee', 'internalNotes', 'address', 'estimatedCompletionDate', 'contactPhone'];
    fieldsToCheck.forEach(field => {
        if (formData[field] !== project[field]) hasChanges = true;
    });

    if (!hasChanges) {
        // If save is triggered by "Finish Edit" button, we might want to just close edit mode
        if(isEditingSchedule) setIsEditingSchedule(false);
        return;
    }

    const updatedProject = {
      ...formData,
      lastUpdatedTimestamp: Date.now(),
      history: [...newLogs, ...(formData.history || [])]
    };

    onUpdateProject(updatedProject);
    if(isEditingSchedule) setIsEditingSchedule(false);
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

  const getDuration = (start: string, end: string) => {
      if(!start || !end) return 0;
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays + 1; 
  };

  // Filter valid schedule items for display
  const activeScheduleItems = (formData.schedule || []).filter(s => s.startDate && s.endDate).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Group items by month for visual calendar in export
  const groupedSchedule = activeScheduleItems.reduce((acc, item) => {
      const date = new Date(item.startDate);
      const key = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
  }, {} as Record<string, ScheduleItem[]>);

  // Combine standard phases and any custom phases already in the schedule
  const customPhases = (formData.schedule || [])
      .map(s => s.phase)
      .filter(p => !CONSTRUCTION_PHASES.includes(p));
  
  // Use a Set to ensure uniqueness just in case
  const allDisplayPhases = [...CONSTRUCTION_PHASES, ...customPhases];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up">
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md group bg-slate-200">
        <img 
          src={formData.imageUrl} 
          alt={formData.projectName} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        <label className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 p-2 rounded-full cursor-pointer backdrop-blur-sm transition-all z-10">
            {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={isUploading}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" 
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95 text-sm"
            >
                <Save className="w-4 h-4" /> 儲存變更
            </button>
         </div>
      </div>

      <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'details' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          專案執行與日誌
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'schedule' 
              ? 'bg-white text-accent shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          工程進度表
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
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
            </>
          ) : activeTab === 'schedule' ? (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-accent/10 p-2 rounded-lg"><Calendar className="w-6 h-6 text-accent"/></div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">工程進度時程表</h3>
                            <p className="text-xs text-slate-500">檢視與安排各施工階段工期。</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            if (isEditingSchedule) {
                                handleSaveGeneral();
                            } else {
                                setIsEditingSchedule(true);
                            }
                        }}
                        className={`text-sm px-4 py-2 rounded-lg font-bold border flex items-center gap-2 transition-all ${
                            isEditingSchedule 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {isEditingSchedule ? <CheckCircle className="w-4 h-4"/> : <Edit className="w-4 h-4"/>}
                        {isEditingSchedule ? '儲存並結束' : '修改排程'}
                    </button>
                </div>

                {!isEditingSchedule && (
                    <SimpleCalendar schedule={formData.schedule || []} />
                )}

                <div className="space-y-4">
                    {/* View Mode: Show only active items */}
                    {!isEditingSchedule && activeScheduleItems.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                            <p className="text-slate-400 text-sm">目前尚未安排施工時程</p>
                            <button onClick={() => setIsEditingSchedule(true)} className="text-accent text-sm font-bold mt-2 hover:underline">
                                點擊開始安排工期
                            </button>
                        </div>
                    )}

                    {!isEditingSchedule && activeScheduleItems.map((item) => {
                         const duration = getDuration(item.startDate, item.endDate);
                         return (
                            <div key={item.phase} className="bg-white rounded-xl p-4 border-l-4 border-accent shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                                <div className="w-full md:w-1/4">
                                    <h4 className="font-bold text-slate-800 text-sm">{item.phase}</h4>
                                    <span className="text-[10px] text-accent font-bold bg-accent/5 px-2 py-0.5 rounded mt-1 inline-block">
                                        工期 {duration} 天
                                    </span>
                                </div>
                                <div className="flex-1 flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span className="font-mono font-bold text-slate-800">{item.startDate}</span>
                                    <span className="text-slate-300">to</span>
                                    <span className="font-mono font-bold text-slate-800">{item.endDate}</span>
                                </div>
                            </div>
                         )
                    })}

                    {/* Edit Mode: Show Standard Phases + Custom Phases */}
                    {isEditingSchedule && allDisplayPhases.map((phase) => {
                        const item = (formData.schedule || []).find(s => s.phase === phase) || { startDate: '', endDate: '' };
                        const hasDates = item.startDate && item.endDate;
                        const isCustom = !CONSTRUCTION_PHASES.includes(phase);

                        return (
                            <div key={phase} className={`rounded-xl p-4 border transition-colors ${hasDates ? 'bg-white border-accent/30 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-70 hover:opacity-100'}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="w-full md:w-1/4 flex items-center gap-2">
                                        <h4 className={`font-bold ${hasDates ? 'text-slate-800' : 'text-slate-500'}`}>{phase}</h4>
                                        {isCustom && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">自訂</span>}
                                    </div>
                                    <div className="flex flex-1 items-center gap-2">
                                        <div className="flex-1">
                                            <input 
                                                type="date" 
                                                className="w-full text-sm p-2 rounded border border-slate-200 focus:border-accent outline-none bg-white text-slate-700"
                                                value={item.startDate}
                                                onChange={(e) => handleScheduleChange(phase, 'startDate', e.target.value)}
                                            />
                                        </div>
                                        <div className="text-slate-300 pt-1">-</div>
                                        <div className="flex-1">
                                            <input 
                                                type="date" 
                                                className="w-full text-sm p-2 rounded border border-slate-200 focus:border-accent outline-none bg-white text-slate-700"
                                                value={item.endDate}
                                                onChange={(e) => handleScheduleChange(phase, 'endDate', e.target.value)}
                                            />
                                        </div>
                                        
                                        {/* Delete Button (For Standard: Clear / For Custom: Remove) */}
                                        {(hasDates || isCustom) && (
                                            <button 
                                                onClick={() => handleDeleteScheduleItem(phase)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title={isCustom ? "移除此工項" : "清除日期"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Custom Phase Section */}
                    {isEditingSchedule && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">新增自訂工項</h4>
                             <div className="flex gap-2">
                                 <input 
                                    type="text"
                                    value={newCustomPhase}
                                    onChange={e => setNewCustomPhase(e.target.value)}
                                    placeholder="例如：隱形鐵窗、智能家居系統..."
                                    className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-accent/50 outline-none"
                                 />
                                 <button 
                                    onClick={handleAddCustomPhase}
                                    disabled={!newCustomPhase.trim()}
                                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     <Plus className="w-4 h-4" /> 新增
                                 </button>
                             </div>
                        </div>
                    )}
                </div>
                
                {isEditingSchedule && (
                    <div className="mt-6 flex justify-end">
                         <button 
                            onClick={handleSaveGeneral}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg flex items-center gap-2 shadow-md font-bold transition-all active:scale-95 text-sm"
                        >
                            <Save className="w-4 h-4" /> 儲存設定並檢視
                        </button>
                    </div>
                )}
             </div>
          ) : activeTab === 'ai' ? (
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
                        {analysisResult.suggestions?.map((suggestion, index) => (
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
          ) : null}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide text-slate-500">專案負責人</h3>
              <div className="flex items-center gap-3 mb-5">
                 <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-600 border border-slate-200">
                    {project.assignedEmployee.charAt(0)}
                 </div>
                 <div>
                    <p className="font-bold text-slate-900 text-lg">{project.assignedEmployee}</p>
                    <p className="text-xs text-slate-500 font-medium">Lead Designer</p>
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
              <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide text-slate-500">專案基本資料</h3>
              <div className="space-y-4">
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
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">客戶需求 (Client Requests)</label>
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
           
           {canDelete && (
                <div className="border border-red-100 rounded-2xl p-6 bg-red-50/30">
                  <h3 className="text-red-700 font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><Trash2 className="w-4 h-4" /> 危險區域</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-red-500">刪除專案將無法復原</p>
                    <button onClick={handleDelete} className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-colors">刪除</button>
                  </div>
                </div>
           )}
        </div>
      </div>
      
      {/* Hidden Export Template - A4 Format (794px width, min-height 1123px) */}
      <div 
        id="project-report-template" 
        className="fixed -left-[9999px] top-0 w-[794px] h-auto min-h-[1123px] bg-white p-12 text-[#54534d] flex flex-col justify-between"
        style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
      >
         <div className="flex-1">
             {/* New Clean Header with Branding */}
             <div className="border-b-2 border-[#54534d] pb-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <ZewuIcon className="w-12 h-12 text-[#54534d]" />
                        <div>
                            <h2 className="text-xl font-bold text-[#54534d] tracking-widest">澤物設計</h2>
                            <p className="text-xs text-[#54534d] tracking-[0.2em]">ZEWU INTERIOR DESIGN</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</div>
                         <div className="font-mono text-lg font-bold text-[#54534d]">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>
                
                <div className="flex flex-col gap-2">
                     <h1 className="text-4xl font-bold tracking-tight text-[#54534d]">{project.projectName}</h1>
                     <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600 mt-3">
                        <span className="bg-[#54534d] text-white px-3 py-1 rounded text-xs inline-block leading-normal tracking-wider">{project.currentStage}</span>
                        
                        <span className="h-4 w-px bg-slate-300"></span>
                        
                        <div className="flex items-center gap-1">
                           <span className="text-slate-400 text-xs uppercase">業主</span>
                           <span className="text-[#54534d] font-bold">{project.clientName}</span>
                        </div>

                        <span className="h-4 w-px bg-slate-300"></span>

                        <div className="flex items-center gap-1">
                           <span className="text-slate-400 text-xs uppercase">負責人</span>
                           <span className="text-[#54534d] font-bold">{project.assignedEmployee}</span>
                        </div>

                        <span className="h-4 w-px bg-slate-300"></span>

                        <div className="flex items-center gap-1">
                           <span className="text-slate-400 text-xs uppercase">案場地址</span>
                           <span className="text-[#54534d] font-mono">{project.address || '未填寫'}</span>
                        </div>
                     </div>
                </div>
             </div>
             
             {/* Engineering Schedule Section (Visual Calendar) */}
             <div className="mb-8 break-inside-avoid">
                 <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4 flex items-center gap-2">
                     <Calendar className="w-5 h-5" />
                     工程進度時程表 (Construction Schedule)
                 </h3>
                 <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-6 shadow-sm">
                     {activeScheduleItems.length === 0 ? (
                         <p className="text-slate-400 italic text-sm">目前無已排程的工程項目</p>
                     ) : (
                         Object.entries(groupedSchedule).map(([monthYear, items]) => (
                             <div key={monthYear} className="flex gap-4">
                                 {/* Month Column */}
                                 <div className="w-24 flex-shrink-0 text-right pt-2 border-r-2 border-slate-100 pr-4">
                                     <div className="text-xl font-bold text-[#54534d] leading-none">{monthYear.split(' ')[2]}</div>
                                     <div className="text-xs text-slate-400 font-mono mt-1">{monthYear.split(' ')[0]}</div>
                                 </div>
                                 {/* Tasks Column */}
                                 <div className="flex-1 space-y-3">
                                     {(items as ScheduleItem[]).map(item => (
                                         <div key={item.phase} className="bg-slate-50 rounded-lg p-3 flex justify-between items-center border-l-4 border-[#54534d]">
                                             <div className="font-bold text-slate-700 text-sm">{item.phase}</div>
                                             <div className="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                                 {new Date(item.startDate).getDate()}日 - {new Date(item.endDate).getDate()}日
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
             </div>
             
             <div className="mb-8 break-inside-avoid">
                 <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4 flex items-center gap-2">
                     <Sparkles className="w-5 h-5" />
                     本週最新進度摘要
                 </h3>
                 <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-base leading-relaxed whitespace-pre-wrap shadow-sm text-slate-700">
                     {project.latestProgressNotes || "尚無最新進度"}
                 </div>
             </div>
             
             <div className="break-inside-avoid">
                 <h3 className="text-lg font-bold border-l-4 border-[#54534d] pl-3 mb-4 flex items-center gap-2">
                     <History className="w-5 h-5" />
                     近期施工日誌與變更紀錄
                 </h3>
                 <div className="space-y-0 relative border-l border-slate-200 ml-3 my-4">
                     {sortedHistory.filter(h => h.field !== 'internalNotes').slice(0, 10).map((log, idx) => (
                        <div key={idx} className="relative pl-6 pb-6 last:pb-0">
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
         </div>
         
         <div className="mt-8 pt-6 border-t border-slate-200 text-center">
             <p className="text-[10px] text-slate-400 tracking-[0.2em] font-medium">ZEWU INTERIOR DESIGN • PROJECT REPORT</p>
         </div>
      </div>
    </div>
  );
};

export default ProjectDetail;