
import React, { useState, useEffect } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { generateProjectReport, analyzeDesignIssue } from '../services/geminiService';
import { ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, CheckCircle, AlertTriangle, Camera, Clock } from 'lucide-react';
import { storage, ref, uploadBytes, getDownloadURL } from '../services/firebase';
import html2canvas from 'html2canvas';

interface ProjectDetailProps {
  project: DesignProject;
  currentUser: User;
  onBack: () => void;
  onUpdateProject: (updatedProject: DesignProject) => void;
  onDeleteProject: (projectId: string) => void;
  employeeNames: string[];
}

// Inline ZewuIcon for the export template
const ZewuIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="80" height="110" stroke="currentColor" strokeWidth="3"/>
    <path d="M10 70 C 30 70, 40 60, 90 60" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 85 C 30 85, 50 75, 90 85" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M10 100 C 40 100, 60 110, 90 100" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, onDeleteProject, employeeNames }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ai'>('details');
  const [formData, setFormData] = useState<DesignProject>(project);
  
  const [progressCategory, setProgressCategory] = useState<string>(CONSTRUCTION_PHASES[0]);
  const [progressDescription, setProgressDescription] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [issueInput, setIssueInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{analysis: string, suggestions: string[]} | null>(null);

  useEffect(() => {
    setFormData(project);
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Image Upload Logic (Details Page)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("圖片大小超過 2MB 限制，請選擇較小的圖片。");
        return;
    }

    setIsUploading(true);
    try {
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, `projects/covers/${Date.now()}_${sanitizedName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        handleInputChange('imageUrl', downloadURL);
        alert("封面照片已更新，請記得點擊「儲存變更」！");
    } catch (error) {
        console.error("Upload failed", error);
        alert("圖片上傳失敗，請檢查網路。");
    } finally {
        setIsUploading(false);
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

    // Only log Stage changes to history as requested
    if (formData.currentStage !== project.currentStage) {
       newLogs.push({
        id: `h-${Date.now()}-3`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '變更專案階段', details: `專案階段已正式進入：${formData.currentStage}`, field: 'currentStage', oldValue: project.currentStage, newValue: formData.currentStage
      });
      hasChanges = true;
    }
    
    // Check other fields just for detecting changes to save (without log)
    if (formData.clientRequests !== project.clientRequests) hasChanges = true;
    if (formData.assignedEmployee !== project.assignedEmployee) hasChanges = true;
    if (formData.imageUrl !== project.imageUrl) hasChanges = true;

    const fieldsToCheck: (keyof DesignProject)[] = ['internalNotes', 'address', 'estimatedCompletionDate', 'contactPhone'];
    fieldsToCheck.forEach(field => {
        if (formData[field] !== project[field]) hasChanges = true;
    });

    if (!hasChanges) {
        alert("沒有偵測到資料變更");
        return;
    }

    const updatedProject = {
      ...formData,
      lastUpdatedTimestamp: Date.now(),
      history: [...newLogs, ...(formData.history || [])]
    };

    onUpdateProject(updatedProject);
    alert('資料已更新');
  };

  const handleDeleteHistoryLog = (logId: string) => {
    if (!window.confirm("確定刪除這條紀錄？")) return;
    const updatedHistory = (formData.history || []).filter(h => h.id !== logId);
    const updatedProject = { ...formData, history: updatedHistory };
    setFormData(updatedProject);
    onUpdateProject(updatedProject);
  };

  const handleDelete = () => {
    if (currentUser.role !== 'manager' && currentUser.role !== 'engineer') return;
    if (window.confirm(`確定永久刪除「${project.projectName}」？此操作無法復原。`)) {
        onDeleteProject(project.id);
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

  const handleExportImage = async () => {
    const el = document.getElementById('project-report-template');
    if (el) {
       try {
         // Temporarily make it visible for capture (but still fixed positioned)
         el.style.opacity = '1'; 
         const canvas = await html2canvas(el, { scale: 2, useCORS: true });
         const link = document.createElement('a');
         link.download = `${project.projectName}_進度報告.jpg`;
         link.href = canvas.toDataURL('image/jpeg', 0.95);
         link.click();
         el.style.opacity = '0';
       } catch (e) {
         console.error('Export failed', e);
         alert('匯出圖片失敗，請重試');
       }
    }
  };

  const sortedHistory = [...(formData.history || [])].sort((a, b) => b.timestamp - a.timestamp);
  const canDelete = currentUser.role === 'manager' || currentUser.role === 'engineer';
  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-slate-400";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up">
      {/* Header Image Area */}
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md group bg-slate-200">
        <img 
          src={formData.imageUrl} 
          alt={formData.projectName} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        {/* Upload Button Overlay */}
        <label className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full cursor-pointer backdrop-blur-sm transition-all border border-white/20">
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Camera className="w-5 h-5" />}
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
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

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
         <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold flex items-center gap-2 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回列表
         </button>
         <div className="flex gap-2">
            <button onClick={handleExportImage} className="bg-slate-100 text-slate-700 px-3 py-2 rounded font-bold text-sm hover:bg-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4"/> 匯出進度報告
            </button>
            <button 
                onClick={handleSaveGeneral}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95 text-sm"
            >
                <Save className="w-4 h-4" /> 儲存變更
            </button>
         </div>
      </div>

      {/* Tabs */}
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
              {/* Progress Update Card */}
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

              {/* History Timeline */}
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
                          {canDelete && (
                              <button 
                                onClick={() => handleDeleteHistoryLog(log.id)}
                                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="刪除紀錄"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                          )}
                          <div className="flex justify-between items-center mb-2">
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

              {/* General Info Card */}
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

              {/* Danger Zone */}
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
            /* AI Assistant Tab */
            <div className="space-y-6 animate-fade-in">
              {/* Report Generation */}
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

              {/* Design Analysis */}
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

        {/* Right Area */}
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

      {/* Hidden Report Template (Improved Layout) */}
      <div id="project-report-template" className="fixed -left-[9999px] top-0 w-[794px] bg-white text-[#54534d] p-12 opacity-0 pointer-events-none">
         {/* Header */}
         <div className="flex justify-between items-start mb-10 border-b-4 border-[#54534d] pb-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-20 text-[#54534d]">
                  <ZewuIcon/>
               </div>
               <div>
                  <h1 className="text-2xl font-bold tracking-widest leading-none">澤物設計</h1>
                  <p className="text-[10px] tracking-[0.2em] opacity-70 mt-1">ZEWU INTERIOR DESIGN</p>
               </div>
            </div>
            <div className="text-right">
               <h2 className="text-xl font-bold text-slate-400">專案進度報告書</h2>
               <p className="font-mono text-sm mt-1 text-slate-400">Date: {new Date().toLocaleDateString()}</p>
            </div>
         </div>

         {/* Project Title Row */}
         <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-[#2c2c2a] tracking-tight">{project.projectName}</h1>
         </div>

         {/* Info Grid - Compact Version */}
         <div className="grid grid-cols-2 gap-4 mb-8">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-1">業主姓名</p>
                <p className="text-base font-bold text-[#54534d]">{project.clientName}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-1">專案負責人</p>
                <p className="text-base font-bold text-[#54534d]">{project.assignedEmployee}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-1">案場地址</p>
                <p className="text-base font-bold text-[#54534d] truncate">{project.address || '未填寫'}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-1">聯絡電話</p>
                <p className="text-base font-bold text-[#54534d]">{project.contactPhone || '未填寫'}</p>
             </div>
         </div>

         {/* Status Summary */}
         <div className="mb-8">
             <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-600">專案現況摘要</h3>
                    <span className="bg-[#54534d] text-white px-3 py-1 rounded text-xs font-bold">{project.currentStage}</span>
                </div>
                <div className="p-6">
                    <div className="mb-4">
                        <p className="font-bold text-lg mb-2">【最新進度】{project.latestProgressNotes}</p>
                        {project.internalNotes && <p className="text-sm text-slate-500 mt-2">備註：{project.internalNotes}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 border-t border-slate-200 pt-4">
                        <div className="w-4 h-4 text-slate-400"><Clock size={16}/></div>
                        預計完工日：<span className="font-mono font-bold text-slate-700">{project.estimatedCompletionDate}</span>
                    </div>
                </div>
             </div>
         </div>

         {/* Timeline */}
         <div>
            <h3 className="text-xl font-bold mb-6 border-b-2 border-slate-100 pb-2">施工日誌與進度紀錄</h3>
            <div className="space-y-0 relative">
               <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-slate-200"></div>
               {project.history.filter(h=>h.field==='latestProgressNotes'||h.field==='currentStage').sort((a,b)=>b.timestamp-a.timestamp).slice(0, 8).map(h=>(
                  <div key={h.id} className="flex gap-6 mb-6 relative">
                     <div className="w-4 h-4 rounded-full bg-[#54534d] border-4 border-white shadow-sm z-10 flex-shrink-0 mt-1"></div>
                     <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                           <span className="font-mono text-slate-400 text-sm">{new Date(h.timestamp).toLocaleDateString()}</span>
                           <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{h.action}</span>
                        </div>
                        <p className="text-base text-[#54534d] leading-relaxed">{h.details}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
