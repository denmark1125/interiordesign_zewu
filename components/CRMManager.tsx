
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, CheckCircle2, ShieldCheck, ExternalLink, Info, Database, UserPlus, UserCircle } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from '../services/firebase';

// Make.com Webhook URL
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  UserId: string;
  clientName: string;
  type: string;
  status: 'sent' | 'skipped' | 'error';
  url: string;
}

interface CRMManagerProps {
  currentUser: User;
  onConvertToProject?: (customer: Customer) => void;
}

const CRMManager: React.FC<CRMManagerProps> = ({ currentUser, onConvertToProject }) => {
  const [activeTab, setActiveTab] = useState<'reservations' | 'customers' | 'inbox' | 'automation'>('reservations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineInbox, setLineInbox] = useState<LineConnection[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [isProcessing, setIsProcessing] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');

  const [showResModal, setShowResModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // 新增客戶用狀態
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // 綁定用的狀態
  const [bindingLineUser, setBindingLineUser] = useState<LineConnection | null>(null);

  // 監聽資料庫
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LineConnection))
          .filter(i => !i.isBound && i.UserId); 
        setLineInbox(data);
      }
    );
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)))
    );
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return alert("請輸入客戶姓名");
    setIsProcessing(true);
    const id = `cust-${Date.now()}`;
    const newCust: Customer = {
      id,
      name: newCustomerName,
      phone: newCustomerPhone,
      tags: [],
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, "customers", id), newCust);
      setShowAddCustomerModal(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      alert("客戶已成功新增");
    } catch (e) {
      alert("新增失敗");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBind = async (lineUser: LineConnection, customer: Customer) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: lineUser.UserId, 
        lineDisplayName: lineUser.lineDisplayName,
        linePictureUrl: lineUser.linePictureUrl || ''
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      setBindingLineUser(null);
      alert(`已成功將 LINE 好友「${lineUser.lineDisplayName}」連結至客戶「${customer.name}」`);
    } catch (e) { 
      alert("連結失敗，請檢查網路連線"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!window.confirm("確定要將此人員從連結池中刪除嗎？（此動作不可復原）")) return;
    try {
      await deleteDoc(doc(db, "line_connections", id));
    } catch (e) {
      alert("刪除失敗");
    }
  };

  const formatForWebhook = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const triggerMakeWebhook = async (userId: string, clientName: string, dateTime: string, serviceName: string) => {
    const params = new URLSearchParams();
    params.append('UserId', userId);
    params.append('clientName', clientName);
    params.append('serviceName', serviceName);
    params.append('appointmentTime', formatForWebhook(dateTime));

    const finalUrl = `${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`;
    const isValid = userId && userId.startsWith('U');

    const newLog: WebhookLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      UserId: userId || "未綁定",
      clientName: clientName,
      type: serviceName,
      status: isValid ? 'sent' : 'skipped',
      url: finalUrl
    };

    setWebhookLogs(prev => [newLog, ...prev].slice(0, 50));
    if (!isValid) return false;

    try {
      await fetch(finalUrl, { method: 'GET', mode: 'no-cors' });
      return true; 
    } catch (e) { 
      return false; 
    }
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-400 transition-all text-sm font-bold";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800 font-sans">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & LINE Connection Pool</p>
        </div>
        <div className="flex gap-1 overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '連結中心' },
            { id: 'automation', label: '發送日誌' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-xs font-black transition-all whitespace-nowrap relative ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
              {tab.id === 'inbox' && lineInbox.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[8px] items-center justify-center font-black">{lineInbox.length}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Inbox: 連結中心 */}
      {activeTab === 'inbox' && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-blue-600 rounded-xl"><LinkIcon className="w-5 h-5 text-white" /></div>
                 <div>
                    <h3 className="font-black text-slate-900">待處理連結池</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">這些是剛加入 LINE 但尚未與系統客戶關聯的人員</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {lineInbox.map(user => (
                   <div key={user.id} className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-200 overflow-hidden border border-white shadow-sm">
                            {user.linePictureUrl ? <img src={user.linePictureUrl} className="w-full h-full object-cover" /> : <Bot className="w-full h-full p-2 text-slate-400" />}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-sm text-slate-800 truncate">{user.lineDisplayName}</h4>
                            <p className="text-[10px] font-mono text-slate-400 truncate w-32">{user.UserId}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setBindingLineUser(user)}
                          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95"
                        >
                          <UserPlus className="w-3.5 h-3.5"/> 連結客戶
                        </button>
                        <button 
                          onClick={() => handleDeleteConnection(user.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                 ))}
                 {lineInbox.length === 0 && (
                   <div className="col-span-full py-20 text-center">
                      <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                         <CheckCircle2 className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-slate-300 text-sm font-black">目前沒有等待連結的人員</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Binding Modal: 選擇要綁定的客戶 */}
      {bindingLineUser && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-md p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => setBindingLineUser(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
                 <img src={bindingLineUser.linePictureUrl} className="w-14 h-14 rounded-2xl border border-slate-100 shadow-sm" />
                 <div>
                    <h3 className="text-lg font-black text-slate-900">將好友連結至客戶</h3>
                    <p className="text-xs font-bold text-slate-400">目前選擇：{bindingLineUser.lineDisplayName}</p>
                 </div>
              </div>

              <div className="relative mb-6">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                 <input 
                    type="text" 
                    placeholder="搜尋客戶姓名或電話..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`${inputClass} pl-12 h-12 rounded-2xl`} 
                 />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {filteredCustomers.map(c => (
                   <button 
                      key={c.id} 
                      onClick={() => handleBind(bindingLineUser, c)}
                      disabled={isProcessing}
                      className="w-full p-4 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group disabled:opacity-50"
                   >
                      <div>
                         <p>{c.name}</p>
                         <p className="text-[10px] opacity-50 font-mono">{c.phone}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100"/>
                   </button>
                 ))}
                 {filteredCustomers.length === 0 && <p className="text-center py-10 text-slate-300 text-xs italic">找不到符合條件的客戶</p>}
              </div>
           </div>
        </div>
      )}

      {/* 預約日曆介面 */}
      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-sm text-slate-800">{currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex items-center gap-4">
                    <div className="flex border border-slate-100 rounded-xl overflow-hidden">
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-2 hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={() => setShowResModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all"><Plus className="w-4 h-4"/> 新增行程</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[24px] overflow-hidden">
                 {['日','一','二','三','四','五','六'].map(d => <div key={d} className="bg-slate-50/50 text-center text-[10px] font-black text-slate-300 py-3 uppercase tracking-widest">{d}</div>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()}).map((_, i) => <div key={i} className="bg-white"/>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i+1);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const resCount = getReservationsForDay(day).length;
                    return (
                       <button key={i} onClick={() => setSelectedDay(day)} className={`h-20 bg-white transition-all flex flex-col items-center justify-center gap-2 relative border-2 ${isSelected ? 'border-slate-900 z-10' : 'border-transparent hover:bg-slate-50/50'}`}>
                          <span className={`text-xs font-black ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>{i+1}</span>
                          {resCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 shadow-lg shadow-slate-300"/>}
                       </button>
                    );
                 })}
              </div>
           </div>
           
           <div className="bg-white rounded-3xl border border-slate-100 h-fit shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-slate-400 text-[10px] uppercase tracking-widest">本日預約行程</div>
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-5 border border-slate-50 rounded-[24px] bg-white shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-3">
                         <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{res.type}</span>
                         <button onClick={() => { if(confirm("確定刪除此預約？")) deleteDoc(doc(db,"reservations",res.id))}} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 mt-2"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                 )) : <div className="py-20 text-center text-slate-200 text-[10px] italic font-black">目前無任何行程</div>}
              </div>
           </div>
        </div>
      )}

      {/* 客戶列表 */}
      {activeTab === 'customers' && (
        <div className="space-y-4 animate-fade-in">
           <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                 <input type="text" placeholder="輸入客戶姓名搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-12 h-14 rounded-2xl shadow-sm`} />
              </div>
              <button onClick={() => setShowAddCustomerModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap">
                 <UserCircle className="w-5 h-5"/> 新增客戶
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
                   <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 text-lg overflow-hidden flex-shrink-0">
                            {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-slate-900 truncate">{c.name}</h4>
                            <p className="text-[11px] text-slate-400 font-bold">{c.phone || '未留電話'}</p>
                         </div>
                      </div>
                      <button onClick={() => { if(confirm(`確定刪除客戶「${c.name}」？`)) deleteDoc(doc(db,"customers",c.id))}} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                   </div>
                   <div className="flex gap-2 pt-5 border-t border-slate-50">
                      <button onClick={() => onConvertToProject?.(c)} className="flex-1 bg-white text-slate-600 h-11 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">轉案場</button>
                      <div className={`px-4 h-11 rounded-xl text-[10px] font-black border flex items-center gap-2 shadow-sm ${c.UserId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                         {c.UserId && <Zap className="w-4 h-4 fill-current animate-pulse"/>}
                         {c.UserId ? '已連線' : '未連線'}
                      </div>
                   </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-300 italic font-black">
                   找不到符合條件的客戶，您可以點擊右上方「新增客戶」
                </div>
              )}
           </div>
        </div>
      )}

      {/* 手動新增客戶 Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => setShowAddCustomerModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">新增系統客戶</h3>
              <form onSubmit={handleAddCustomer} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">客戶姓名</label>
                    <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="必填" className={`${inputClass} h-14 rounded-2xl`} required />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">聯絡電話</label>
                    <input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="選填" className={`${inputClass} h-14 rounded-2xl`} />
                 </div>
                 <button type="submit" disabled={isProcessing} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black text-sm hover:bg-slate-800 flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50">
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin"/> : <Save className="w-6 h-6" />}
                    確認儲存客戶資料
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* 自動化發送日誌 (診斷用) */}
      {activeTab === 'automation' && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-slate-900 rounded-xl"><Zap className="w-5 h-5 text-white" /></div>
                 <div>
                    <h3 className="font-black text-slate-900">發送紀錄 (Webhook Logs)</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">用於診斷 Make.com 即時接收狀況</p>
                 </div>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {webhookLogs.map(log => (
                    <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>{log.status === 'sent' ? '已送出' : '跳過'}</span>
                       </div>
                       <p className="text-xs font-black text-slate-700">{log.clientName} - {log.type}</p>
                       <p className="text-[10px] font-mono text-blue-500 mt-1 truncate">ID: {log.UserId}</p>
                    </div>
                 ))}
                 {webhookLogs.length === 0 && <div className="py-10 text-center text-slate-300 text-xs italic">尚無即時發送紀錄</div>}
              </div>
           </div>

           <div className="bg-slate-900 rounded-[32px] p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                 <Database className="w-6 h-6 text-blue-400" />
                 <h3 className="font-black">Make.com 變數引導</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                    <h4 className="text-sm font-black text-blue-400 mb-4">為什麼 Run Once 才有用？</h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-bold">
                       這代表 Webhook **並未開啟排程 (Scheduling)**。<br/><br/>
                       請在 Make 編輯器左下角找到 <span className="text-emerald-400">Scheduling OFF/ON</span> 開關，將其切換為 <span className="text-emerald-400 font-black underline">ON</span>。
                    </p>
                 </div>
                 <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                    <h4 className="text-sm font-black text-emerald-400 mb-4">綁定小撇步</h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-bold">
                       當客戶加入 LINE 後，會在「連結中心」出現。<br/><br/>
                       綁定後，系統會自動在 Firestore 更新該客戶的 `UserId`。Make 的自動化腳本就會開始工作。
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 新增預約 Modal */}
      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">建立預約行程</h3>
              
              {!selectedCustomer ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest text-center">請點選一位客戶</p>
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-5 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-800 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                        {c.name} <ChevronRight className="w-5 h-5 opacity-20 group-hover:opacity-100"/>
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="p-5 bg-slate-50 rounded-[24px] text-xs font-black text-slate-700 flex justify-between items-center border border-slate-100">
                      <span>已選客戶：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500 font-black underline">重選</button>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">預約時間</label>
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={`${inputClass} h-14 rounded-2xl`} />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">行程項目</label>
                      <select value={resType} onChange={e => setResType(e.target.value)} className={`${inputClass} h-14 rounded-2xl`}>
                         <option value="諮詢">諮詢</option>
                         <option value="丈量">丈量</option>
                         <option value="看圖">看圖</option>
                         <option value="簽約">簽約</option>
                      </select>
                   </div>
                   <button onClick={async () => {
                     if(!resDate) return alert("請輸入預約日期與時間");
                     setIsProcessing(true);
                     const latest = customers.find(c => c.id === selectedCustomer.id);
                     const currentUserId = latest?.UserId || '';
                     const rid = `res-${Date.now()}`;
                     const newRes: Reservation = {
                       id: rid, customerId: selectedCustomer.id, customerName: selectedCustomer.name,
                       UserId: currentUserId, dateTime: resDate, type: resType as any, status: 'pending', 
                       createdAt: Date.now(), immediateNotified: false, reminded: false
                     };
                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       await triggerMakeWebhook(currentUserId, newRes.customerName, newRes.dateTime, newRes.type);
                       alert("預約成功建立！");
                       setShowResModal(false); setSelectedCustomer(null); setResDate('');
                     } catch(e) { alert("儲存失敗"); } finally { setIsProcessing(false); }
                   }} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black text-sm hover:bg-slate-800 flex items-center justify-center gap-3 shadow-xl transition-all">
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin"/> : <ClipboardCheck className="w-6 h-6" />}
                      確認並送出通知
                   </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;
