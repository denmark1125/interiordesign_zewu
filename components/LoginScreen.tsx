import React, { useState } from 'react';
import { User } from '../types';
import { PenTool, User as UserIcon, Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.username === username);
    
    if (user && user.password === password) {
      onLogin(user);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-2xl mb-4 shadow-xl">
          <PenTool className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">澤物專案管理</h1>
        <p className="text-slate-500 mt-2">Interior Design Project Management</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">員工登入</h2>
        
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">帳號 (Username)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900"
                placeholder="請輸入員工帳號"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密碼 (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-accent focus:border-accent transition-colors bg-white text-slate-900"
                placeholder="請輸入密碼"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            登入系統 <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;