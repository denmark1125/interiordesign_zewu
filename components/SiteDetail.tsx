
import React, { useState, useEffect, useRef } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User, ScheduleItem } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { ArrowLeft, Save, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, Calendar, Clock, Share, LayoutList, CheckCircle2, Bot, Download, User as UserIcon } from 'lucide-react';
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

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'ai'>('details');
  const [formData, setFormData] = useState<DesignProject>(project);
  const [progressCategory, setProgressCategory] = useState<string>(CONSTRUCTION_PHASES[0]);
  const [progressDescription, setProgressDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData({ ...project, history: project.history || [], schedule: project.schedule || [] });
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const updatedData = { ...formData, lastUpdatedTimestamp: Date.now() };
      await updateDoc(doc(db, "projects", formData.id), updatedData);
      onUpdateProject(updatedData);
      alert('所有變更已儲存');
    } catch (e) {
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLog = async () => {
    if (!progressDescription.trim()) return;
    setIsSaving(true);
    const timestamp = Date.now();
    const newLog: HistoryLog = {
      id: `h-${timestamp}`,
      timestamp,
      userId: currentUser.id,
      userName: currentUser.name,
      action: progressCategory,
      details: progressDescription,
      field: 'latestProgressNotes',
      newValue: `【${progressCategory}】${progressDescription}`
    };
    const updatedHistory = [newLog, ...(formData.history || [])];
    const updatedData = { ...formData, history: updatedHistory, latestProgressNotes: newLog.newValue, lastUpdatedTimestamp: timestamp };
    
    try {
      await updateDoc(doc(db, "projects", formData.id), updatedData);
      setFormData(updatedData);
      onUpdateProject(updatedData);
      setProgressDescription('');
      alert('施工日誌已發布');
    } catch (e) {
      alert('發布失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const exportToImage = async () => {
    if (!detailRef.current) return;
    const canvas = await html2canvas(detailRef.current, { scale: 2, useCORS: true });
    const link = document.createElement('a');
    link.download = `${formData.projectName}_專案報告.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const sortedHistory = [...(formData.history || [])].sort((a, b) => b.timestamp - a.timestamp);
  const inputClass = "w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-slate-100 transition-all text-sm";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in" ref={detailRef}>
      
      {/* 頂部操作列 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-20">
         <button onClick={onBack} className="px-4 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold flex items-center gap-2 text-sm transition-all">
           <ArrowLeft className="w-4 h-4" /> 返回列表
         </button>
         <div className="flex gap-3">
            <button onClick={exportToImage} className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2 font-bold text-sm hover:bg-slate-700 transition-all">
               <Download className="w-4 h-4" /> 匯出圖片
            </button>
            <button onClick={handleSaveAll} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 儲存變更
            </button>
         </div>
      </div>

      {/* 封面大圖 */}
      <div className="relative h-64 sm:h-80 rounded-[32px] overflow-hidden shadow-lg border-4 border-white">
        <img src={formData.imageUrl} className="w-full h-full object-cover" alt="Cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-8 text-white w-full">
           <h1 className="text-3xl font-black mb-2">{formData.projectName}</h1>
           <div className="flex flex-wrap items-center gap-4 text-xs font-bold opacity-90">
             <span className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> {formData.clientName}</span>
             <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {formData.address || '未填寫案址'}</span>
             <span className="bg-blue-600 px-3 py-1 rounded-md">{formData.currentStage}</span>
           </div>
        </div>
      </div>

      {/* 分頁 Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('details')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>專案執行與日誌</button>
        <button onClick={() => setActiveTab('schedule')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'schedule' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>工程進度表</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ai' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>AI 智能助理</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側內容區 */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* 新增日誌卡片 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="w-5 h-5 text-amber-600"/> 新增施工日誌</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">施工階段/類別</label>
                    <select value={progressCategory} onChange={(e) => setProgressCategory(e.target.value)} className={inputClass}>
                      {CONSTRUCTION_PHASES.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">進度詳情</label>
                  <textarea rows={4} placeholder="請輸入今日施工項目、完成進度或現場狀況..." value={progressDescription} onChange={(e) => setProgressDescription(e.target.value)} className={inputClass} />
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleAddLog} disabled={isSaving} className="bg-amber-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-100 active:scale-95 transition-all flex items-center gap-2">
                    <Send className="w-4 h-4" /> 發布日誌
                  </button>
                </div>
              </div>

              {/* 時間軸 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2"><History className="w-5 h-5 text-slate-400" /> 專案時間軸 (Timeline)</h3>
                <div className="space-y-6 relative pl-4 border-l-2 border-slate-50">
                  {sortedHistory.length > 0 ? sortedHistory.map((log) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute -left-[29px] top-1 bg-white border-2 border-slate-300 w-4 h-4 rounded-full"></div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{log.action}</span>
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{log.details}</p>
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                           <div className="w-4 h-4 rounded-full bg-slate-200"></div>
                           <span>記錄人員：{log.userName}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 text-slate-300 italic text-sm">尚無任何日誌紀錄</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
               <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                     <div className="p-3 bg-amber-50 rounded-xl"><Calendar className="w-6 h-6 text-amber-600" /></div>
                     <div>
                        <h3 className="font-bold text-slate-800 text-lg">工程進度時程表</h3>
                        <p className="text-xs text-slate-400">檢視與安排各施工階段工期。</p>
                     </div>
                  </div>
                  <button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"><LayoutList className="w-4 h-4"/> 修改排程</button>
               </div>
               
               {/* 模擬日曆視圖 (如截圖) */}
               <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/30">
                  <div className="flex justify-between items-center mb-6">
                     <span className="font-bold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400"/> 2026年 1月 施工行事曆</span>
                     <div className="flex gap-2">
                        <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><Clock className="w-4 h-4 text-slate-400" /></button>
                        <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><Clock className="w-4 h-4 text-slate-400 rotate-180" /></button>
                     </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                     {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 py-2 uppercase">{d}</div>)}
                     {Array.from({length: 4}).map((_, i) => <div key={`e-${i}`} className="h-14"></div>)}
                     {Array.from({length: 31}).map((_, i) => (
                       <div key={i} className={`h-14 border border-slate-100 rounded-lg flex flex-col items-center justify-center text-xs font-bold ${i+1 === 13 ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>
                          {i+1}
                       </div>
                     ))}
                  </div>
                  <div className="mt-6 flex justify-end gap-4 text-[10px] font-bold text-slate-400">
                     <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 有施工安排</span>
                  </div>
               </div>
               
               <div className="mt-10 py-16 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                  <p className="text-slate-300 font-bold mb-2">目前尚未安排施工時程</p>
                  <p className="text-amber-600 font-black cursor-pointer hover:underline">點擊開始安排工期</p>
               </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
               <Bot className="w-16 h-16 text-slate-200 mx-auto mb-4" />
               <h3 className="font-bold text-slate-800 mb-2">AI 智能助理</h3>
               <p className="text-sm text-slate-400 mb-6">正在分析案場歷史資料，為您提供專屬建議...</p>
               <button className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 mx-auto"><Sparkles className="w-4 h-4"/> 啟動 AI 診斷</button>
            </div>
          )}
        </div>

        {/* 右側側邊欄 */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-6 text-sm">專案負責人</h3>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-slate-400 border border-slate-200 shadow-sm">
                    {formData.assignedEmployee.charAt(0)}
                 </div>
                 <div>
                    <h4 className="font-bold text-slate-800">{formData.assignedEmployee}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lead Designer</p>
                 </div>
              </div>
              <div className="mt-6">
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">重新指派</label>
                 <select className={inputClass} value={formData.assignedEmployee} onChange={e => handleInputChange('assignedEmployee', e.target.value)}>
                    {employeeNames.map(name => <option key={name} value={name}>{name}</option>)}
                 </select>
              </div>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <h3 className="font-bold text-slate-800 mb-2 text-sm">專案基本資料</h3>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">目前階段</label>
                 <select className={inputClass} value={formData.currentStage} onChange={e => handleInputChange('currentStage', e.target.value)}>
                    {Object.values(ProjectStage).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">預計完工日</label>
                 <input type="date" value={formData.estimatedCompletionDate} onChange={e => handleInputChange('estimatedCompletionDate', e.target.value)} className={inputClass} />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">客戶需求 (Client Requests)</label>
                 <textarea rows={4} value={formData.clientRequests} onChange={e => handleInputChange('clientRequests', e.target.value)} className={inputClass} placeholder="輸入業主特殊要求..." />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">內部備註</label>
                 <textarea rows={3} value={formData.internalNotes} onChange={e => handleInputChange('internalNotes', e.target.value)} className={inputClass} placeholder="僅內部可見..." />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
