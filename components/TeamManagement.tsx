
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Plus, Trash2, Edit2, Save, X, UserCog, ShieldCheck, User as UserIcon, HardHat, Eye, Key } from 'lucide-react';

interface TeamManagementProps {
  users: User[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ users, currentUser, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states - Add
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newCanViewDashboard, setNewCanViewDashboard] = useState(false);

  // Form states - Edit
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editCanViewDashboard, setEditCanViewDashboard] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) {
      alert("請填寫完整資訊 (姓名、帳號、密碼)");
      return;
    }

    if (users.some(u => u.username === newUsername)) {
      alert("此帳號已存在，請使用其他帳號");
      return;
    }

    const newUser: User = {
      id: `u-${Date.now()}`,
      name: newName,
      username: newUsername,
      password: newPassword,
      role: newRole,
      avatarInitials: newName.charAt(0),
      canViewDashboard: newRole !== 'employee' ? true : newCanViewDashboard
    };
    
    onAddUser(newUser);
    // Reset
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setNewRole('employee');
    setNewCanViewDashboard(false);
    setIsAdding(false);
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setEditCanViewDashboard(user.canViewDashboard || false);
    setEditPassword(''); 
  };

  const saveEdit = () => {
    if (!editName.trim() || !editingId) return;
    const user = users.find(u => u.id === editingId);
    if (user) {
      const updatedUser: User = {
        ...user,
        name: editName,
        role: editRole,
        avatarInitials: editName.charAt(0),
        canViewDashboard: editRole !== 'employee' ? true : editCanViewDashboard
      };

      if (editPassword.trim()) {
        updatedUser.password = editPassword.trim();
      }

      onUpdateUser(updatedUser);
    }
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUser.id) {
      alert("您無法刪除自己的帳號。");
      return;
    }
    
    const confirmDelete = window.confirm(`【危險動作】\n\n您確定要永久刪除成員「${name}」嗎？\n\n1. 該成員將立即無法登入。\n2. 此操作無法復原。`);
    if (confirmDelete) {
      onDeleteUser(id);
    }
  };

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'manager':
        return <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><ShieldCheck className="w-3 h-3" /> Admin</span>;
      case 'engineer':
        return <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><HardHat className="w-3 h-3" /> Engineer</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit uppercase tracking-wider"><UserIcon className="w-3 h-3" /> Designer</span>;
    }
  };

  const inputClass = "w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none";

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-slate-600" />
            團隊成員管理
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            設定員工角色、登入帳號與權限。
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto bg-accent hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all font-bold"
        >
          <Plus className="w-4 h-4" />
          新增員工
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-slide-up">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5 text-accent" /> 新增成員帳號
            </h3>
            <button onClick={() => setIsAdding(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
          </div>
          
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">姓名</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="例如：張小美"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">登入帳號</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="例如：chang.may"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">登入密碼</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="設定初始密碼"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-end">
              <div className="w-full md:w-64">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色權限</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className={inputClass}
                >
                  <option value="employee">設計師 (Employee)</option>
                  <option value="manager">管理員 (Manager)</option>
                  <option value="engineer">工程師 (Engineer)</option>
                </select>
              </div>
              
              {newRole === 'employee' && (
                <div className="flex items-center gap-3 pb-3">
                  <input 
                    type="checkbox" 
                    id="newCanView"
                    checked={newCanViewDashboard}
                    onChange={e => setNewCanViewDashboard(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-accent focus:ring-accent"
                  />
                  <label htmlFor="newCanView" className="text-sm font-bold text-slate-700 cursor-pointer select-none">允許查看儀表板</label>
                </div>
              )}

              <div className="w-full md:w-auto md:ml-auto">
                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Save className="w-4 h-4" /> 建立帳號
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Layout: Cards */}
      <div className="md:hidden space-y-4">
        {users.map(user => (
          <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {editingId === user.id ? (
              // Mobile Edit Mode
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-bold text-slate-800">編輯成員資料</h4>
                  <button onClick={() => setEditingId(null)} className="p-1"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase mb-1">姓名</label>
                   <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className={inputClass}
                    />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase mb-1">角色</label>
                   <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as UserRole)}
                      className={inputClass}
                    >
                      <option value="employee">設計師</option>
                      <option value="manager">管理員</option>
                      <option value="engineer">工程師</option>
                    </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase mb-1">重設密碼 (選填)</label>
                   <input 
                      type="text"
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="若不修改請留空"
                      className={inputClass}
                    />
                </div>
                <div className="flex items-center gap-3 py-2 bg-slate-50 rounded-lg px-3 border border-slate-100">
                    <input 
                      type="checkbox" 
                      disabled={editRole !== 'employee'}
                      checked={editRole !== 'employee' ? true : editCanViewDashboard}
                      onChange={e => setEditCanViewDashboard(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-accent focus:ring-accent"
                    />
                    <span className={`text-sm font-bold ${editRole !== 'employee' ? 'text-slate-400' : 'text-slate-700'}`}>允許查看儀表板</span>
                </div>
                <button onClick={saveEdit} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 mt-2">
                  <Save className="w-4 h-4" /> 儲存變更
                </button>
              </div>
            ) : (
              // Mobile View Mode
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-base font-bold border border-slate-200 shadow-sm">
                      {user.avatarInitials}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {user.name}
                        {user.id === currentUser.id && <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">ME</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded w-fit mt-1">@{user.username}</div>
                    </div>
                  </div>
                  {renderRoleBadge(user.role)}
                </div>
                
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                   <div className="text-xs font-medium">
                      {user.role === 'manager' || user.role === 'engineer' ? (
                        <span className="text-slate-400 italic">擁有完整管理權限</span>
                      ) : user.canViewDashboard ? (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1"><Eye className="w-3 h-3"/> 可看儀表板</span>
                      ) : (
                        <span className="text-slate-400 bg-slate-50 px-2 py-1 rounded-full">限制存取</span>
                      )}
                   </div>
                   
                   <div className="flex gap-3">
                      <button onClick={() => startEdit(user)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.id !== currentUser.id && (
                        <button onClick={() => handleDelete(user.id, user.name)} className="p-2 bg-red-50 border border-red-100 rounded-lg text-red-500 hover:bg-red-100 transition-all shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Layout: Table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">姓名 / 帳號</th>
              <th className="px-6 py-4">角色</th>
              <th className="px-6 py-4">權限設定</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4">
                  {editingId === user.id ? (
                    <div className="space-y-2 max-w-[200px]">
                       <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className={`${inputClass} py-1.5`}
                        placeholder="姓名"
                      />
                      <div className="text-xs text-slate-400 font-mono px-1">@{user.username}</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold border border-slate-200">
                        {user.avatarInitials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{user.name}</div>
                        <div className="text-xs text-slate-400 font-mono">@{user.username}</div>
                        {user.id === currentUser.id && (
                          <span className="text-[10px] bg-accent/10 text-accent px-1.5 rounded ml-1 font-bold">YOU</span>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4">
                  {editingId === user.id ? (
                     <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as UserRole)}
                      className={`${inputClass} py-1.5`}
                    >
                      <option value="employee">設計師</option>
                      <option value="manager">管理員</option>
                      <option value="engineer">工程師</option>
                    </select>
                  ) : (
                    renderRoleBadge(user.role)
                  )}
                </td>

                <td className="px-6 py-4">
                   {editingId === user.id ? (
                      <div className="space-y-3">
                         <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              disabled={editRole !== 'employee'}
                              checked={editRole !== 'employee' ? true : editCanViewDashboard}
                              onChange={e => setEditCanViewDashboard(e.target.checked)}
                              className="rounded border-slate-300 text-accent focus:ring-accent"
                            />
                            <span className={`text-xs font-bold ${editRole !== 'employee' ? 'text-slate-300' : 'text-slate-600'}`}>允許查看儀表板</span>
                         </div>
                         <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                            <Key className="w-3 h-3 text-slate-400" />
                            <input 
                              type="text"
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="輸入新密碼以重設"
                              className={`${inputClass} py-1 text-xs`}
                            />
                         </div>
                      </div>
                   ) : (
                      (user.role === 'manager' || user.role === 'engineer') ? (
                        <span className="text-xs text-slate-300 italic font-medium">全域管理權限</span>
                      ) : user.canViewDashboard ? (
                        <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                          <Eye className="w-3 h-3" /> 可查看儀表板
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">限制存取</span>
                      )
                   )}
                </td>

                <td className="px-6 py-4 text-right">
                  {editingId === user.id ? (
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={saveEdit} className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 shadow-sm" title="儲存">
                          <Save className="w-4 h-4" />
                       </button>
                       <button onClick={() => setEditingId(null)} className="bg-white border border-slate-200 text-slate-500 p-1.5 rounded-lg hover:bg-slate-50" title="取消">
                          <X className="w-4 h-4" />
                       </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(user)} className="text-slate-400 hover:text-accent p-2 hover:bg-slate-50 rounded-lg transition-colors" title="編輯/重設密碼">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      {user.id !== currentUser.id && (
                        <button 
                          onClick={() => handleDelete(user.id, user.name)} 
                          className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold" 
                          title="刪除帳號"
                        >
                          <Trash2 className="w-4 h-4" /> 刪除
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamManagement;