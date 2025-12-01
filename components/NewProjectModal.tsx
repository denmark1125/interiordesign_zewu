
import React, { useState, useRef, useEffect } from 'react';
import { DesignProject, ProjectStage, User } from '../types';
import { DEFAULT_PROJECT_COVERS, validateImageFile } from '../constants';
import { X, Plus, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { storage, ref, uploadBytes, getDownloadURL } from '../services/firebase';

interface NewProjectModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (project: DesignProject) => void;
  employeeNames: string[];
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ currentUser, onClose, onSubmit, employeeNames }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Pick a random image on mount
  const [randomCover] = useState(() => 
    DEFAULT_PROJECT_COVERS[Math.floor(Math.random() * DEFAULT_PROJECT_COVERS.length)]
  );

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
    imageUrl: randomCover, // Use random cover by default
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate Image
      const isValid = await validateImageFile(file);
      if (!isValid) {
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        return;
      }

      setSelectedFile(file);
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.clientName) {
      alert('請填寫專案名稱與客戶姓名');
      return;
    }

    setIsUploading(true);

    try {
      const projectId = `P${Date.now().toString().slice(-4)}`;
      let finalImageUrl = formData.imageUrl!;

      // Upload Image if selected
      if (selectedFile) {
        const storageRef = ref(storage, `project-images/${projectId}/${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        finalImageUrl = await getDownloadURL(storageRef);
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
      alert("建立專案失敗，請檢查網路連線");
      setIsUploading(false);
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
                <label className="block text-sm font-bold text-slate-700 mb-1">專案封面/渲染圖</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-accent hover:bg-slate-50 transition-colors flex flex-col items-center justify-center overflow-hidden group"
                >
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold flex items-center gap-1">
                          <Upload className="w-4 h-4" /> 更換圖片
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <img src={formData.imageUrl} alt="Random Default" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 bg-white/60"></div>
                      <div className="relative text-center p-4 z-10">
                        <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-700 font-bold">點擊上傳自訂圖片</p>
                        <p className="text-[10px] text-slate-500 mt-1">若未上傳，將使用此隨機圖片</p>
                      </div>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden" 
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">* 建議尺寸: 1MB 以下，16:9 橫式比例</p>
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
                <label className="block text-sm font-bold text-slate-700 mb-1">預計完工日</label>
                <input
                  type="date"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                  value={formData.estimatedCompletionDate}
                  onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">地址/地點</label>
                <input
                  type="text"
                  placeholder="案場地址"
                  className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
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
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                value={formData.clientRequests}
                onChange={e => setFormData({...formData, clientRequests: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">最新進度描述 (Initial Progress)</label>
              <textarea
                rows={2}
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-accent focus:border-accent bg-slate-50 text-slate-900"
                value={formData.latestProgressNotes}
                onChange={e => setFormData({...formData, latestProgressNotes: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-amber-700 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上傳建立中...
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
