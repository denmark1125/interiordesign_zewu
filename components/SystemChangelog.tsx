
import React, { useState, useEffect } from 'react';
import { SystemLog, User } from '../types';
import { GitBranch, Plus, Save, Trash2, Calendar, Tag, X, Shield, Activity, Clock } from 'lucide-react';
import { db, systemLogsCollection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from '../services/firebase';

interface SystemChangelogProps {
  currentUser: User;
  users: User[];
}

const SystemChangelog: React.FC<SystemChangelogProps> = ({ currentUser, users }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'access'>('logs');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const q = query(systemLogsCollection, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => doc.data() as SystemLog);
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleAddLog = async () => {
    if (!version.trim() || !title.trim()) {
      alert("請填寫版本號與標題");
      return;
    }

    const newLog: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      version: version.trim(),
      title: title.trim(),
      content: content.trim(),
      author: currentUser.name
    };

    try {
      await setDoc(doc(db, "system_logs", newLog.id), newLog);
      setIsAdding(false);
      setVersion('');
      setTitle('');
      setContent('');
    } catch (e) {
      console.error("Error adding log:", e);
      alert("新增失敗");
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("確定刪除此條紀錄？")) return;
    try {
      await deleteDoc(doc(db, "system_logs", id));
    } catch (e) {
      console.error("Error deleting log:", e);
    }
  };

  // Sort users by lastLoginAt desc
  const sortedUsers = [...users].sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-600" />
            工程師控制台
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            系統開發紀錄與成員存取監控。
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <GitBranch className="w-4 h-4" /> 開發日誌
            </button>
            <button 
                onClick={() => setActiveTab('access')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'access' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Activity className="w-4 h-4" /> 登入監控
            </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <div className="space-y-6">
           <div className="flex justify-end">
                <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-[#54534d] hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-md transition-all font-bold"
                >
                    <Plus className="w-4 h-4" />
                    新增紀錄
                </button>
           </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 animate-slide-up">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">撰寫更新日誌</h3>
                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">版本號 (Version)</label>
                        <input 
                        type="text" 
                        value={version}
                        onChange={e => setVersion(e.target.value)}
                        placeholder="v1.0.0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-mono font-bold text-slate-700 focus:ring-2 focus:ring-[#54534d] outline-none"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">更新標題</label>
                        <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="例如：修復照片上傳問題"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#54534d] outline-none"
                        />
                    </div>
                </div>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">詳細內容 (支援換行)</label>
                    <textarea 
                        rows={5}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="- 修正了 Firebase 權限設定&#10;- 優化了手機版介面&#10;- 新增數據分析儀表板"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-[#54534d] outline-none leading-relaxed"
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleAddLog}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-colors"
                    >
                        <Save className="w-4 h-4" /> 儲存紀錄
                    </button>
                </div>
                </div>
            )}

            <div className="relative border-l-2 border-slate-200 ml-3 md:ml-6 space-y-8 my-8">
                {logs.length === 0 ? (
                <div className="pl-8 text-slate-400 italic">尚無開發紀錄，點擊右上方按鈕開始撰寫...</div>
                ) : (
                logs.map((log) => (
                    <div key={log.id} className="relative pl-8 md:pl-12 group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-0 bg-white border-4 border-[#54534d] w-5 h-5 rounded-full z-10"></div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-[#54534d] text-white px-2 py-1 rounded text-xs font-mono font-bold tracking-wider">
                                {log.version}
                                </span>
                                <h3 className="text-lg font-bold text-slate-800">{log.title}</h3>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span className="flex items-center gap-1 font-medium text-slate-500">
                                <Tag className="w-3.5 h-3.5" />
                                {log.author}
                                </span>
                            </div>
                        </div>
                        
                        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap pl-1">
                            {log.content}
                        </div>

                        <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="absolute top-4 right-4 text-slate-300 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                            title="刪除紀錄"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    </div>
                ))
                )}
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slide-up">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                      <tr>
                          <th className="px-6 py-4">成員</th>
                          <th className="px-6 py-4">角色</th>
                          <th className="px-6 py-4">最後登入時間</th>
                          <th className="px-6 py-4 text-right">登入次數</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {sortedUsers.map(user => (
                          <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                          {user.avatarInitials}
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-800 text-sm">{user.name}</div>
                                          <div className="text-xs text-slate-400">@{user.username}</div>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                      user.role === 'manager' ? 'bg-slate-800 text-white' :
                                      user.role === 'engineer' ? 'bg-blue-600 text-white' :
                                      'bg-slate-100 text-slate-600'
                                  }`}>
                                      {user.role}
                                  </span>
                              </td>
                              <td className="px-6 py-4">
                                  {user.lastLoginAt ? (
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                          <Clock className="w-4 h-4 text-slate-400" />
                                          {new Date(user.lastLoginAt).toLocaleString()}
                                      </div>
                                  ) : (
                                      <span className="text-slate-400 text-xs italic">尚未登入</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">
                                  {user.loginCount || 0}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

export default SystemChangelog;
