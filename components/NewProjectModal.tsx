
import React, { useState } from 'react';
import { DesignProject, ProjectStage, User } from '../types';
import { X, Plus, Loader2, RefreshCw, Upload } from 'lucide-react';
import { uploadImage } from '../services/firebase';

interface NewProjectModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (project: DesignProject) => void;
  employeeNames: string[];
}

const DEFAULT_PROJECT_COVERS = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
];

const validateImageFile = (file: File): boolean => {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    alert(`圖片過大 (${(file.size / 1024 / 1024).toFixed(2)}MB)。請上傳小於 2MB 的圖片。`);
    return false;
  }
  return true;
};

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
    // Default image
    imageUrl: DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)], 
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        const url = await uploadImage(file);
        setFormData(prev => ({ ...prev, imageUrl: url }));
    } catch (error: any) {
        alert(error.message || '上傳失敗');
    } finally {
        setIsUploading(false);
        e.target.value = ''; 
    }
  };

  const handleRandomImage = () => {
      const randomImg = DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)];
      setFormData(prev => ({ ...prev, imageUrl: randomImg }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.clientName) {
        alert("請填寫專案名稱與客戶姓名");
        return;
    }

    setIsSubmitting(true);
    
    // Simulate slight delay or processing
    await new Promise(resolve => setTimeout(resolve, 500));

    const newProject: DesignProject = {
        id: `P${Date.now()}`,
        projectName: formData.projectName!,
        clientName: formData.clientName!,
        assignedEmployee: formData.assignedEmployee!,
        estimatedCompletionDate: formData.estimatedCompletionDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currentStage: formData.currentStage || ProjectStage.CONTACT,
        latestProgressNotes: formData.latestProgressNotes || '',
        clientRequests: formData.clientRequests || '',
        internalNotes: formData.internalNotes || '',
        lastUpdatedTimestamp: Date.now(),
        createdAt: Date.now(),
        address: formData.address || '',
        contactPhone: formData.contactPhone || '',
        imageUrl: formData.imageUrl!,
        history: [{
            id: `h-${Date.now()}`,
            timestamp: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: '專案立案',
            details: '建立新專案資料'
        }],
        schedule: []
    };

    onSubmit(newProject);
    setIsSubmitting(false);
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#54534d]/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-accent" />
                    建立新專案
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Image Preview & Upload */}
                <div className="relative h-48 rounded-xl overflow-hidden bg-slate-100 group border border-slate-200">
                    <img src={formData.imageUrl} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                         <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm border border-white/50 transition-all">
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                            上傳照片
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                         </label>
                         <button 
                            type="button" 
                            onClick={handleRandomImage}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm border border-white/50 transition-all"
                         >
                            <RefreshCw className="w-4 h-4" /> 隨機封面
                         </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">專案名稱 <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="projectName"
                            required
                            value={formData.projectName}
                            onChange={handleInputChange}
                            placeholder="例如：信義區林公館"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">客戶姓名 <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="clientName"
                            required
                            value={formData.clientName}
                            onChange={handleInputChange}
                            placeholder="例如：林先生"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">負責設計師</label>
                        <select 
                            name="assignedEmployee"
                            value={formData.assignedEmployee}
                            onChange={handleInputChange}
                            className={inputClass}
                            disabled={currentUser.role === 'employee'} // Employees can only assign to themselves (or based on logic)
                        >
                             {employeeNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                             ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">目前階段</label>
                        <select 
                            name="currentStage"
                            value={formData.currentStage}
                            onChange={handleInputChange}
                            className={inputClass}
                        >
                            {Object.values(ProjectStage).map(stage => (
                                <option key={stage} value={stage}>{stage}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">案場地址</label>
                         <input 
                            type="text" 
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="台北市..."
                            className={inputClass}
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">聯絡電話</label>
                         <input 
                            type="text" 
                            name="contactPhone"
                            value={formData.contactPhone}
                            onChange={handleInputChange}
                            placeholder="09xx-xxx-xxx"
                            className={inputClass}
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">預計完工日</label>
                         <input 
                            type="date" 
                            name="estimatedCompletionDate"
                            value={formData.estimatedCompletionDate}
                            onChange={handleInputChange}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">客戶初步需求</label>
                    <textarea 
                        name="clientRequests"
                        rows={3}
                        value={formData.clientRequests}
                        onChange={handleInputChange}
                        placeholder="風格偏好、特殊需求..."
                        className={inputClass}
                    />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm"
                    >
                        取消
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-accent hover:bg-amber-700 text-white px-8 py-2.5 rounded-lg flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all font-bold text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                        {isSubmitting ? '建立中...' : '確認建立專案'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default NewProjectModal;
