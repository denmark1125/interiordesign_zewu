
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User, ScheduleItem } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { ArrowLeft, Save, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, Calendar, Clock, Download, Edit3, X, Plus, CalendarDays, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import { db, updateDoc, doc } from '../services/firebase';

interface ProjectDetailProps {
  project: DesignProject;
  currentUser: User;
  onBack: void;
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
  
  // 工程行事曆狀態
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // 新增排程的暫存狀態
  const [newPhase, setNewPhase] = useState(CONSTRUCTION_PHASES[0]);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const detailRef = useRef<HTMLDivElement>(null);

  // Fix: Added sortedHistory memo to resolve the reference error in the template
  const sortedHistory = useMemo(() => {
    return [...(formData.history || [])].sort((a, b) => b.timestamp - a.timestamp);
  }, [formData.history]);

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
      alert('✅ 所有變更已同步');
    } catch (e) {
      alert('❌ 儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddScheduleItem = () => {
    if (!newStartDate || !newEndDate) {
      alert("請選擇開始與結束日期");
      return;
    }
    const newItem: ScheduleItem = {
      phase: newPhase,
      startDate: newStartDate,
      endDate: newEndDate
    };
    const updatedSchedule = [...(formData.schedule || []), newItem];
    setFormData(prev => ({ ...prev, schedule: updatedSchedule }));
    setNewStartDate('');
    setNewEndDate('');
  };

  const handleDeleteScheduleItem = (index: number) => {
    if (!window.confirm("⚠️ 您確定要刪除此筆工程排程嗎？\n此動作將從進度表與行事曆中移除，且無法復原。")) return;
    const updatedSchedule = [...(formData.schedule || [])];
    updatedSchedule.splice(index, 1);
    setFormData(prev => ({ ...prev, schedule: updatedSchedule }));
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
      alert('✅ 施工日誌已發布');
    } catch (e) {
      alert('❌ 發布失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 行事曆輔助函式
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // 填充空白
    for (let i = 0; i < firstDay; i++) days.push(null);
    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [calendarDate]);

  const getItemsForDate = useCallback((date: Date) => {
    if (!formData.schedule) return [];
    const dateStr = date.toISOString().split('T')[0];
    return formData.schedule.filter(item => {
      return dateStr >= item.startDate && dateStr <= item.endDate;
    });
  }, [formData.schedule]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 font-bold outline-none focus:border-slate-400 transition-all";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in font-sans" ref={detailRef}>
      
      {/* 置頂操作列 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm sticky top-0 z-30">
         <button onClick={onBack} className="px-4 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold flex items-center gap-2 text-xs transition-all active:scale-95">
           <ArrowLeft className="w-4 h-4" /> 返回列表
         </button>
         <div className="flex gap-2">
            <button onClick={handleSaveAll} disabled={isSaving} className="px-5 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2 font-black text-xs hover:bg-slate-700 transition-all shadow-md active:scale-95">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 儲存變更
            </button>
         </div>
      </div>

      {/* 封面資訊 */}
      <div className="relative h-60 rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <img src={formData.imageUrl} className="w-full h-full object-cover" alt="Cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
           <h1 className="text-xl font-black mb-1 tracking-tight">{formData.projectName}</h1>
           <div className="flex items-center gap-3 text-[11px] font-bold opacity-90">
             <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {formData.address || '未填寫案址'}</span>
             <span className="bg-white/20 px-2 py-0.5 rounded uppercase">{formData.currentStage}</span>
           </div>
        </div>
      </div>

      {/* 分頁 Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/50">
        <button onClick={() => setActiveTab('details')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>日誌動態</button>
        <button onClick={() => setActiveTab('schedule')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'schedule' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>工程進度表</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'ai' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>AI 診斷</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><PlusCircle className="w-4 h-4 text-amber-500"/> 新增施工日誌</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">施工類別</label>
                    <select value={progressCategory} onChange={(e) => setProgressCategory(e.target.value)} className={inputClass}>
                      {CONSTRUCTION_PHASES.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                    </select>
                  </div>
                </div>
                <textarea rows={3} placeholder="今日施工重點..." value={progressDescription} onChange={(e) => setProgressDescription(e.target.value)} className={inputClass} />
                <div className="flex justify-end mt-4">
                  <button onClick={handleAddLog} disabled={isSaving} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> 發布紀錄
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm"><History className="w-4 h-4 text-slate-300" /> 專案動態</h3>
                <div className="space-y-6 relative pl-3 border-l-2 border-slate-50">
                  {sortedHistory.map((log) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute -left-[11px] top-1 bg-white border-2 border-slate-200 w-3.5 h-3.5 rounded-full"></div>
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{log.action}</span>
                            <span className="text-[9px] text-slate-300 font-bold">{new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-bold">{log.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. 工程進度行事曆 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-blue-500" /> 工程排程行事曆
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 mr-2">{calendarDate.getFullYear()} / {calendarDate.getMonth() + 1}</span>
                    <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-slate-500"/></button>
                    <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-slate-500"/></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-[9px] font-black text-slate-300 py-2 uppercase tracking-widest">{d}</div>)}
                  {calendarDays.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} className="h-16 bg-slate-50/30 rounded-lg"></div>;
                    const items = getItemsForDate(date);
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div key={idx} className={`h-16 p-1 rounded-lg border flex flex-col items-center gap-1 transition-all ${isToday ? 'border-blue-200 bg-blue-50/30' : 'border-slate-50'}`}>
                        <span className={`text-[11px] font-black ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{date.getDate()}</span>
                        <div className="w-full space-y-0.5 overflow-hidden">
                          {items.map((it, i) => (
                            <div key={i} className="h-1 w-full bg-slate-800/80 rounded-full" title={it.phase} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. 新增排程表單 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h3 className="font-black text-slate-800 mb-4 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-slate-300" /> 新增階段規劃</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block tracking-widest">階段名稱</label>
                    <select value={newPhase} onChange={(e) => setNewPhase(e.target.value)} className={inputClass}>
                      {CONSTRUCTION_PHASES.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block tracking-widest">起</label>
                    <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block tracking-widest">迄</label>
                    <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleAddScheduleItem} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-2 active:scale-95">
                    加入進度表
                  </button>
                </div>
              </div>

              {/* 3. 排程清單表 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-3">工程階段</th>
                      <th className="px-5 py-3">期間 (開始 ~ 結束)</th>
                      <th className="px-5 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {formData.schedule && formData.schedule.length > 0 ? formData.schedule.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-5 py-3.5 text-slate-800">{item.phase}</td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono tracking-tighter">
                          {item.startDate} <span className="mx-2 opacity-30">→</span> {item.endDate}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button 
                            onClick={() => handleDeleteScheduleItem(idx)} 
                            className="text-slate-200 group-hover:text-red-400 transition-all p-1.5 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-16 text-center text-slate-300 italic font-black">點擊上方按鈕開始規劃工程排程</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
               <Bot className="w-10 h-10 text-slate-200 mx-auto mb-4" />
               <h3 className="font-black text-slate-800 mb-1 text-base">AI 專案診斷</h3>
               <p className="text-[11px] text-slate-400 mb-6 font-bold max-w-xs mx-auto">正在分析該案場的施工頻率與日誌內容...</p>
               <button className="bg-slate-800 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all"><Sparkles className="w-4 h-4 mr-2"/> 啟動智能分析</button>
            </div>
          )}
        </div>

        {/* 右側側邊欄 */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-black text-slate-400 mb-4 text-[9px] uppercase tracking-widest border-b border-slate-50 pb-3">負責人員</h3>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-slate-400 border border-slate-100 shadow-sm text-sm">
                    {formData.assignedEmployee.charAt(0)}
                 </div>
                 <div>
                    <h4 className="font-black text-slate-800 text-sm">{formData.assignedEmployee}</h4>
                    <p className="text-[9px] text-slate-300 font-black uppercase">Project Lead</p>
                 </div>
              </div>
              <select className={inputClass} value={formData.assignedEmployee} onChange={e => handleInputChange('assignedEmployee', e.target.value)}>
                {employeeNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="font-black text-slate-400 mb-2 text-[9px] uppercase tracking-widest border-b border-slate-50 pb-3">專案設定</h3>
              <div>
                 <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">當前進度</label>
                 <select className={inputClass} value={formData.currentStage} onChange={e => handleInputChange('currentStage', e.target.value)}>
                    {Object.values(ProjectStage).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">業主備註</label>
                 <textarea rows={3} value={formData.clientRequests} onChange={e => handleInputChange('clientRequests', e.target.value)} className={inputClass} placeholder="..." />
              </div>
              <div>
                 <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">內部備註</label>
                 <textarea rows={2} value={formData.internalNotes} onChange={e => handleInputChange('internalNotes', e.target.value)} className={inputClass} placeholder="..." />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
