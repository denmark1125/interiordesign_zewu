
import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { updateDoc, doc, db } from '../services/firebase';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
}

// Custom Zewu Icon
const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.username === username);
    
    if (user && user.password === password) {
      const now = Date.now();
      const newCount = (user.loginCount || 0) + 1;

      // Update Firebase (Fire and forget to not block UI)
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
          lastLoginAt: now,
          loginCount: newCount
        });
      } catch (err) {
        console.error("Failed to update login logs", err);
      }

      // Update local state and proceed
      onLogin({
        ...user,
        lastLoginAt: now,
        loginCount: newCount
      });
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-6 animate-fade-in">
          <ZewuIcon className="w-24 h-24 text-[#54534d]" />
        </div>
        <h1 className="text-3xl font-bold text-[#54534d] tracking-tight">澤物設計</h1>
        <p className="text-[#54534d]/70 mt-2 font-medium tracking-widest text-sm">ZEWU INTERIOR DESIGN</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full animate-slide-up">
        <h2 className="text-xl font-bold text-[#54534d] mb-6 text-center">員工登入</h2>
        
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
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-[#54534d] focus:border-[#54534d] transition-colors bg-white text-slate-900"
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
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-[#54534d] focus:border-[#54534d] transition-colors bg-white text-slate-900"
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
            className="w-full bg-[#54534d] hover:bg-[#43423d] text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            登入系統 <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;