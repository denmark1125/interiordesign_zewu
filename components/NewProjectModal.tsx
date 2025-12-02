import React, { useState } from 'react';
import { DesignProject, ProjectStage, User } from '../types';
import { X, Plus, Loader2, Upload, AlertCircle } from 'lucide-react';
import { storage, ref, uploadBytes, getDownloadURL } from '../services/firebase';

interface NewProjectModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (project: DesignProject) => void;
  employeeNames: string[];
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ currentUser, onClose, onSubmit, employeeNames }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
    imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', 
  });

  // Image Upload Logic
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Check size (2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert("圖片大小超過 2MB 限制，請選擇較小的圖片。");
        return;
    }

    setIsUploading(true);
    try {
        // Sanitize filename
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, `projects/covers/${Date.now()}_${sanitizedName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (error) {
        console.error("Upload failed", error);
        alert("圖片上傳失敗，請稍後再試");
    } finally {
        setIsUploading(false);
    }
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
        history: [
          {
            id: `h-${Date.now()}`,
            timestamp: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: '建立專案',
            details: '專案初始化完成'
          }
        ]
      };

      onSubmit(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("建立專案失敗");
      setIsSubmitting(false);
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
            {/* Left Column */}
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
                <label className="block text-sm font-bold text-slate-700 mb-1">封面照片 (Cover)</label>
                <div className="flex items-center gap-3">
                   <img src={formData.imageUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                   <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                      {isUploading ? '上傳中...' : '上傳照片'}
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                   </label>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">* 限制 2MB 以內</p>
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

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">負責員工</label>
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

               <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">最新進度描述</label>
                <textarea
                  rows={4}
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.latestProgressNotes}
                  onChange={e => setFormData({...formData, latestProgressNotes: e.target.value})}
                />
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
              disabled={isSubmitting || isUploading}
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

export default NewProjectModal;
