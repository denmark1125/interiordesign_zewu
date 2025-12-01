import React, { useState } from 'react';
import { DesignProject, ProjectStage, User } from '../types';
import { X, Plus } from 'lucide-react';

interface NewProjectModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (project: DesignProject) => void;
  employeeNames: string[];
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ currentUser, onClose, onSubmit, employeeNames }) => {
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
    imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Default image
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.clientName) {
      alert('請填寫專案名稱與客戶姓名');
      return;
    }

    const newProject: DesignProject = {
      id: `P${Date.now().toString().slice(-4)}`,
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
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
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
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
                  value={formData.clientName}
                  onChange={e => setFormData({...formData, clientName: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">預計完工日</label>
                <input
                  type="date"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
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
                      className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
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
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
                  value={formData.currentStage}
                  onChange={e => setFormData({...formData, currentStage: e.target.value as ProjectStage})}
                >
                  {Object.values(ProjectStage).map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">地址/地點</label>
                <input
                  type="text"
                  placeholder="案場地址"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
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
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
                value={formData.clientRequests}
                onChange={e => setFormData({...formData, clientRequests: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">最新進度描述 (Initial Progress)</label>
              <textarea
                rows={2}
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent"
                value={formData.latestProgressNotes}
                onChange={e => setFormData({...formData, latestProgressNotes: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-amber-700 shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
            >
              建立案場
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;