
import React, { useState, useEffect } from 'react';
import { DesignProject, ProjectStage, HistoryLog, User } from '../types';
import { CONSTRUCTION_PHASES } from '../constants';
import { generateProjectReport, analyzeDesignIssue } from '../services/geminiService';
import { ArrowLeft, Phone, Save, FileText, Send, MapPin, History, PlusCircle, Trash2, Sparkles, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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

  useEffect(() => {
    setFormData(project);
  }, [project]);

  const handleInputChange = (field: keyof DesignProject, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
       if(!window.confirm(`確認將階段變更為「${formData.currentStage}」？`)) return;
       newLogs.push({
        id: `h-${Date.now()}-3`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '變更專案階段', details: `專案階段已正式進入：${formData.currentStage}`, field: 'currentStage', oldValue: project.currentStage, newValue: formData.currentStage
      });
      hasChanges = true;
    }
    
    if (formData.clientRequests !== project.clientRequests) {
      newLogs.push({
        id: `h-${Date.now()}-1`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '更新客戶需求', details: '修改了客戶需求項目', field: 'clientRequests', oldValue: project.clientRequests, newValue: formData.clientRequests
      });
      hasChanges = true;
    }

    if (formData.assignedEmployee !== project.assignedEmployee) {
       newLogs.push({
        id: `h-${Date.now()}-4`, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name,
        action: '變更負責人', details: `負責人從 ${project.assignedEmployee} 變更為 ${formData.assignedEmployee}`, field: 'assignedEmployee', oldValue: project.assignedEmployee, newValue: formData.assignedEmployee
      });
      hasChanges = true;
    }

    // Check other fields
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

  const handleDelete = () => {
    if (currentUser.role !== 'manager' && currentUser.role !== 'engineer') return;
    if (window.confirm(`確定永久刪除「${project.projectName}」？此操作無法復原。`)) {
        onDeleteProject(project.id);
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

  // Common input style class
  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-slate-400";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 p-2 bg-white hover:bg-slate-100 rounded-full border border-slate-200 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">{project.projectName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-sm mt-1">
              <span className="font-medium">{project.clientName}</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{project.address}</span>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSaveGeneral}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 font-bold transition-transform active:scale-95"
        >
          <Save className="w-4 h-4" /> 儲存變更
        </button>
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
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-slate-200 transition-colors">
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
                      className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 p-2.5 outline-none focus:ring-2 focus:ring-accent/50"
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
    </div>
  );
};

export default ProjectDetail;
