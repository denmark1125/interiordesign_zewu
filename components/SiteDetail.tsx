
import React, { useState, useEffect } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User, ScheduleItem, AIAnalysisResult } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { generateProjectReport, analyzeDesignIssue } from '../services/geminiService';
// Added missing Users icon import
import { ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, CheckCircle, AlertTriangle, Calendar, Clock, Camera, Share, Edit, X, ChevronLeft, ChevronRight, Eye, Plus, Users } from 'lucide-react';
import html2canvas from 'html2canvas';
import { db, updateDoc, doc } from '../services/firebase';

interface ProjectDetailProps {
  project: DesignProject;
  currentUser: User;
  onBack: () => void;
  onUpdateProject: (updatedProject: DesignProject) => void;
  onDeleteProject: (projectId: string) => void;
  employeeNames: string[];
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, onDeleteProject, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'ai'>('details');
  const [formData, setFormData] = useState<DesignProject>(project);
  
  const [progressCategory, setProgressCategory] = useState<string>(CONSTRUCTION_PHASES[0]);
  const [progressDescription, setProgressDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      ...project,
      history: project.history || []
    });
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddProgress = async () => {
    if (!progressDescription.trim()) { alert('請輸入進度內容'); return; }
    setIsSaving(true);

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

    const currentHistory = formData.history || [];
    const updatedHistory = [newLog, ...currentHistory];

    try {
      const projectRef = doc(db, "projects", formData.id);
      await updateDoc(projectRef, {
        latestProgressNotes: newNote,
        lastUpdatedTimestamp: timestamp,
        history: updatedHistory
      });
      
      const finalProject = {
        ...formData,
        latestProgressNotes: newNote,
        lastUpdatedTimestamp: timestamp,
        history: updatedHistory
      };
      
      setFormData(finalProject);
      onUpdateProject(finalProject);
      setProgressDescription('');
      alert('施工日誌已成功寫入資料庫！');
    } catch (e) {
      console.error("Save log error:", e);
      alert('寫入失敗，請確認網路連線');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      const updatedData = { ...formData, lastUpdatedTimestamp: Date.now() };
      const projectRef = doc(db, "projects", formData.id);
      await updateDoc(projectRef, updatedData);
      onUpdateProject(updatedData);
      alert('基本資料已更新');
    } catch (e) {
      alert('更新失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedHistory = [...(formData.history || [])].sort((a, b) => b.timestamp - a.timestamp);

  const inputClass = "w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-slate-800/5 transition-all";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up">
      <div className="relative h-72 rounded-[48px] overflow-hidden shadow-2xl group border-[6px] border-white ring-1 ring-slate-200">
        <img src={formData.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-12 text-white w-full">
           <h1 className="text-4xl font-black mb-4 drop-shadow-lg">{formData.projectName}</h1>
           <div className="flex flex-wrap items-center gap-8 opacity-90">
             <p className="text-sm font-black flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/20"><MapPin className="w-4 h-4 text-accent"/> {formData.address || '未填寫案址'}</p>
             <p className="text-sm font-black flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/20"><Users className="w-4 h-4 text-[#06C755]"/> 客戶：{formData.clientName}</p>
           </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-5 rounded-[32px] border border-slate-100 shadow-xl">
         <button onClick={onBack} className="px-6 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-800 font-black flex items-center gap-3 text-sm transition-all active:scale-95"><ArrowLeft className="w-5 h-5" /> 返回列表</button>
         <div className="flex gap-3">
            <button onClick={handleSaveGeneral} disabled={isSaving} className="bg-slate-800 text-white px-10 py-4 rounded-2xl flex items-center gap-2 shadow-2xl shadow-slate-200 font-black text-sm active:scale-95 transition-all disabled:opacity-50">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 
               更新專案詳情
            </button>
         </div>
      </div>

      <div className="flex gap-2 bg-slate-200/40 p-1.5 rounded-2xl w-fit border border-slate-100 backdrop-blur-sm">
        <button onClick={() => setActiveTab('details')} className={`px-10 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === 'details' ? 'bg-white shadow-md text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>日誌與動態</button>
        <button onClick={() => setActiveTab('schedule')} className={`px-10 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === 'schedule' ? 'bg-white shadow-md text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>工程進度排程</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'details' && (
            <>
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-10">
                <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 text-xl"><PlusCircle className="w-7 h-7 text-[#06C755]"/> 發布施工日誌</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">工種/分類</label>
                        <select value={progressCategory} onChange={(e) => setProgressCategory(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                          {CONSTRUCTION_PHASES.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                        </select>
                     </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">進度描述</label>
                    <textarea rows={5} placeholder="請輸入今日現場狀況、施工進度或待辦事項..." value={progressDescription} onChange={(e) => setProgressDescription(e.target.value)} className={`${inputClass} leading-relaxed`} />
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleAddProgress} disabled={isSaving} className="bg-[#06C755] text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-green-500/20 active:scale-95 transition-all flex items-center gap-3">
                       {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />} 
                       確認發布日誌
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-12">
                <h3 className="font-black text-slate-800 mb-12 flex items-center gap-3 text-xl"><History className="w-7 h-7 text-slate-300" /> 專案執行時間軸</h3>
                <div className="space-y-12 relative">
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-100"></div>
                  {sortedHistory.length > 0 ? sortedHistory.map((log) => (
                    <div key={log.id} className="relative pl-16 group">
                      <div className="absolute left-0 top-1 w-10 h-10 rounded-[14px] bg-slate-800 text-white shadow-xl z-10 flex items-center justify-center font-black text-xs">{log.userName.charAt(0)}</div>
                      <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 group-hover:bg-slate-100/50 group-hover:border-slate-200 transition-all">
                        <div className="flex justify-between items-center mb-5">
                            <span className="text-[10px] font-black text-white bg-slate-800 px-4 py-1.5 rounded-full uppercase tracking-widest">{log.action}</span>
                            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> {new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed font-bold">{log.details}</p>
                        <div className="mt-6 pt-5 border-t border-slate-200/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>
                               <p className="text-[11px] text-slate-400 font-black tracking-widest">記錄人員：{log.userName}</p>
                            </div>
                            {currentUser.role === 'manager' && (
                               <button onClick={() => { if(window.confirm("刪除此日誌？")) {
                                   const newHist = formData.history.filter(h => h.id !== log.id);
                                   const projectRef = doc(db, "projects", formData.id);
                                   updateDoc(projectRef, { history: newHist });
                                   setFormData({...formData, history: newHist});
                               }}} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 className="w-4 h-4"/></button>
                            )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-32 text-slate-200 italic font-black">
                       <History className="w-20 h-20 mx-auto mb-6 opacity-5" />
                       <p className="text-lg">尚無日誌紀錄，等待您的第一筆發布</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-8">
           <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-10">
              <h3 className="font-black text-slate-400 text-[11px] uppercase mb-10 tracking-widest border-b border-slate-50 pb-5">案場基本管控</h3>
              <div className="space-y-10">
                 <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-4 tracking-widest">當前案場階段</label>
                    <select className={inputClass} value={formData.currentStage} onChange={e => handleInputChange('currentStage', e.target.value)}>
                        {Object.values(ProjectStage).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-4 tracking-widest">客戶聯絡資訊</label>
                    <div className="relative group">
                       <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-slate-800 transition-colors" />
                       <input type="text" value={formData.contactPhone} onChange={e => handleInputChange('contactPhone', e.target.value)} className={`${inputClass} pl-14`} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-4 tracking-widest">專案主責人</label>
                    <div className="p-5 bg-slate-50 rounded-2xl font-black border border-slate-100 text-slate-700 text-sm shadow-inner">{formData.assignedEmployee}</div>
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-4 tracking-widest">目標完工日期</label>
                    <input type="date" value={formData.estimatedCompletionDate} onChange={e => handleInputChange('estimatedCompletionDate', e.target.value)} className={inputClass} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
