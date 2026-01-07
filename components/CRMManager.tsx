import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, User as UserIcon, CheckCircle2, Calendar as CalendarIcon, Link2Off, Edit3, UserPlus, MessageSquare, UserCheck } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, webhookLogsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, limit } from '../services/firebase';

// Make.com Webhook URL
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  lineUserId: string;
  clientName: string;
  type: string;
  status: 'sent' | 'skipped' | 'failed';
  operator: string;
}

interface CRMManagerProps {
  currentUser: User;
  onConvertToProject?: (customer: Customer) => void;
}

const CRMManager: React.FC<CRMManagerProps> = ({ currentUser, onConvertToProject }) => {
  const [activeTab, setActiveTab] = useState<'reservations' | 'customers' | 'inbox' | 'automation'>('reservations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rawLineInbox, setRawLineInbox] = useState<LineConnection[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [isProcessing, setIsProcessing] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');
  const [customType, setCustomType] = useState(''); 

  const [showResModal, setShowResModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const customInputRef = useRef<HTMLInputElement>(null);

  const openReservationModal = () => {
    setResDate('');
    setResType('諮詢');
    setCustomType('');
    setSelectedCustomer(null);
    setShowResModal(true);
  };

  // 1. 核心數據監聽
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => {
        setCustomers(snap.docs.map(d => {
          const data = d.data();
          return { ...data, id: d.id, UserId: (data.UserId || "").toString().trim() } as Customer;
        }));
      }
    );
    
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => {
          const item = d.data();
          const db_UID = (item.UserId || "").toString().trim();
          const db_Nickname = (item.lineUserId || item.lineDisplayName || "未命名用戶").toString().trim();
          
          return { 
            id: d.id, 
            lineUserId: db_UID, // U-ID
            lineDisplayName: db_Nickname, // 暱稱
            linePictureUrl: item.linePictureUrl || '',
            isBound: item.isBound || false
          } as LineConnection;
        }).filter(i => i.lineUserId.startsWith('U')); 
        setRawLineInbox(data);
      }
    );
    
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => {
        const data = d.data();
        return { 
            ...data,
            id: d.id,
            UserId: (data.UserId || "").toString().trim()
        } as Reservation;
      }))
    );

    const unsubLogs = onSnapshot(query(webhookLogsCollection, orderBy("timestamp", "desc"), limit(50)), 
      (snap) => setWebhookLogs(snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          lineUserId: (data.lineUserId || data.UserId || "無 ID").toString().trim()
        } as WebhookLog;
      }))
    );
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); unsubLogs(); };
  }, []);

  const isLineLinked = useCallback((customer: Customer) => {
    const uid = (customer.UserId || "").toString().trim();
    return uid.startsWith('U') && uid.length > 20;
  }, []);

  const lineInbox = useMemo(() => {
    const boundIds = new Set(customers.map(c => c.UserId).filter(id => id && id.startsWith('U')));
    return rawLineInbox.filter(item => !item.isBound && !boundIds.has(item.lineUserId));
  }, [rawLineInbox, customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  const getReservationsForDay = useCallback((date: Date) => {
    return reservations.filter(res => {
      const resDate = new Date(res.dateTime);
      return resDate.getDate() === date.getDate() &&
             resDate.getMonth() === date.getMonth() &&
             resDate.getFullYear() === date.getFullYear();
    });
  }, [reservations]);

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`確定要永久刪除客戶「${name}」？`)) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      alert("已刪除");
    } catch (e) { alert("刪除失敗"); }
  };

  const handleUnlinkLine = async (customer: Customer) => {
    if (!window.confirm(`確定要解除「${customer.name}」的 LINE 連動？`)) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: "", 
        lineDisplayName: "",
        linePictureUrl: ""
      });
      alert("已成功解除連動");
    } catch (e) { alert("操作失敗"); } finally { setIsProcessing(false); }
  };

  const handleBind = async (lineUser: LineConnection, customer: Customer) => {
    setIsProcessing(true);
    const uId = lineUser.lineUserId.trim(); 
    const nickName = lineUser.lineDisplayName.trim();
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: uId, 
        lineDisplayName: nickName,
        linePictureUrl: lineUser.linePictureUrl || ''
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert(`🎉 綁定成功！\n客戶：${customer.name}\nLINE：${nickName}`);
    } catch (e) { alert("更新失敗"); } finally { setIsProcessing(false); }
  };

  const handleQuickAdd = async (lineUser: LineConnection) => {
    if (!window.confirm(`要將「${lineUser.lineDisplayName}」新增為新客戶嗎？`)) return;
    setIsProcessing(true);
    const uId = lineUser.lineUserId.trim(); 
    const nickName = lineUser.lineDisplayName.trim();
    const custId = `cust-${Date.now()}`;
    try {
      await setDoc(doc(db, "customers", custId), {
        id: custId, name: nickName, UserId: uId, lineDisplayName: nickName, linePictureUrl: lineUser.linePictureUrl || '', phone: '', tags: ['LINE自動新增'], createdAt: Date.now()
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert(`✅ 已快速建立客戶：${nickName}\n並已同步完成連動！`);
    } catch (e) { alert("快速新增失敗"); } finally { setIsProcessing(false); }
  };

  const triggerMakeWebhook = async (userId: string, clientName: string, dateTime: string, serviceName: string) => {
    const valid = userId && userId.startsWith('U');
    const logId = `log-${Date.now()}`;
    await setDoc(doc(db, "webhook_logs", logId), {
      id: logId, timestamp: Date.now(), lineUserId: userId || "無 ID", clientName, type: serviceName, status: valid ? 'sent' : 'skipped', operator: currentUser.name
    });
    if (!valid) return false;
    const params = new URLSearchParams();
    params.append('UserId', userId.trim()); 
    params.append('clientName', clientName.trim()); 
    params.append('serviceName', serviceName.trim());
    params.append('appointmentTime', dateTime.replace('T', ' ')); 
    try {
      await fetch(`${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`, { method: 'POST', mode: 'no-cors' });
      return true; 
    } catch (e) { return false; }
  };

  // 💡 確保輸入框在白色背景中有對比度 (bg-slate-50)
  const inputClass = "w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-800 transition-all text-sm font-bold shadow-sm";
  const cardClass = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:shadow-md transition-all";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & Shared Notification System</p>
        </div>
        <div className="flex gap-1 overflow-x-auto max-w-full pb-1">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '連結中心' },
            { id: 'automation', label: '發送日誌' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-xs font-black whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
              {tab.id === 'inbox' && lineInbox.length > 0 && <span className="ml-1.5 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">{lineInbox.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lineInbox.length > 0 ? lineInbox.map(item => (
            <div key={item.id} className={cardClass}>
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex-shrink-0">
                     {item.linePictureUrl ? <img src={item.linePictureUrl} className="w-full h-full object-cover"/> : <Bot className="w-full h-full p-2 text-slate-200"/>}
                  </div>
                  <div className="min-w-0">
                     <h4 className="font-bold text-sm truncate">{item.lineDisplayName}</h4>
                     <p className="text-[9px] font-mono text-emerald-500 font-black tracking-tighter uppercase">UID: {item.lineUserId.substring(0, 10)}...</p>
                  </div>
               </div>
               <div className="space-y-2 mb-4">
                  <button onClick={() => handleQuickAdd(item)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                     <UserPlus className="w-3.5 h-3.5" /> 快速建立並連動新客戶
                  </button>
               </div>
               <div className="pt-3 border-t border-slate-50">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">或是綁定至現有客戶</p>
                  <div className="max-h-40 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                     {customers.filter(c => !isLineLinked(c)).length > 0 ? customers.filter(c => !isLineLinked(c)).map(c => (
                        <button key={c.id} onClick={() => handleBind(item, c)} className="w-full p-2.5 text-left bg-slate-50 hover:bg-slate-200 rounded-xl text-[10px] font-black transition-all flex justify-between items-center group/btn border border-slate-100">
                           {c.name} <LinkIcon className="w-3 h-3 opacity-30 group-hover/btn:opacity-100"/>
                        </button>
                     )) : <p className="text-[9px] italic text-slate-300 py-2 text-center">無待連動客戶</p>}
                  </div>
               </div>
            </div>
          )) : <div className="col-span-full py-24 text-center text-slate-300 text-xs italic font-bold border-2 border-dashed border-slate-100 rounded-[32px]">目前無待連結帳號</div>}
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-slate-800 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-slate-400"/> {currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex gap-2">
                    <div className="flex bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-2.5 hover:bg-slate-200"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-2.5 hover:bg-slate-200"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={openReservationModal} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[11px] font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus className="w-4 h-4"/> 新增預約</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100 border rounded-2xl overflow-hidden shadow-inner">
                 {['日','一','二','三','四','五','六'].map(d => <div key={d} className="bg-white text-center text-[10px] font-black text-slate-300 py-3 uppercase">{d}</div>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()}).map((_, i) => <div key={`empty-${i}`} className="bg-white/40 h-16"/>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i+1);
                    const isSelected = selectedDay && day.toDateString() === selectedDay.toDateString();
                    const resCount = getReservationsForDay(day).length;
                    return (
                       <button key={`day-${i}`} onClick={() => setSelectedDay(new Date(day.getTime()))} className={`h-16 flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'bg-amber-400 scale-105 z-10 rounded-xl shadow-lg' : 'bg-white hover:bg-slate-50'}`}>
                          {/* 💡 再次修正：選中日期的文字改為黑色 */}
                          <span className={`text-[13px] font-black ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{i+1}</span>
                          {resCount > 0 && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-900 animate-pulse' : 'bg-slate-800'}`}/>}
                       </button>
                    );
                 })}
              </div>
           </div>
           <div className="bg-white rounded-3xl border border-slate-100 flex flex-col shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-50 border-b font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                 <Clock className="w-4 h-4"/> 本日行程 
                 {selectedDay && <span className="ml-auto text-slate-900">{selectedDay.getMonth()+1}/{selectedDay.getDate()}</span>}
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[9px] font-black text-slate-400 border px-2 py-0.5 rounded-full">{res.type}</span>
                         <button onClick={() => deleteDoc(doc(db,"reservations",res.id))} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-[10px] font-black text-slate-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        {(res.UserId && res.UserId.startsWith('U')) && <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current animate-bounce" />}
                      </div>
                   </div>
                 )) : <div className="text-center py-24 text-slate-200 text-[10px] italic font-black">點選日期查看預約</div>}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4">
           <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                 <input type="text" placeholder="搜尋客戶姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-12 h-14 bg-white`} />
              </div>
              <button onClick={() => setShowAddCustomerModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                 <UserPlus className="w-5 h-5"/> 新增客戶
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(c => {
                const linked = isLineLinked(c);
                return (
                  <div key={c.id} className={cardClass}>
                     <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                           <div className="relative">
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 overflow-hidden text-lg shadow-inner">
                                 {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                              </div>
                              {linked && (
                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md border border-slate-50">
                                   <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current animate-bounce" />
                                </div>
                              )}
                           </div>
                           <div className="min-w-0">
                              <h4 className="font-black text-base truncate text-slate-900">{c.name}</h4>
                              {linked && c.lineDisplayName && <p className="text-emerald-500 text-[11px] font-black truncate max-w-[120px]">@{c.lineDisplayName}</p>}
                              {!linked && <p className="text-slate-300 text-[10px] font-bold">尚未連動 LINE</p>}
                           </div>
                        </div>
                        <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="text-slate-200 hover:text-red-500 p-2 transition-colors"><Trash2 className="w-4.5 h-4.5"/></button>
                     </div>
                     <div className="space-y-2 pt-4 border-t border-slate-50">
                        <button onClick={() => onConvertToProject?.(c)} className="w-full bg-white text-slate-700 py-3 rounded-xl text-[11px] font-black border border-slate-100 hover:bg-slate-50 transition-all shadow-sm">轉正式案場</button>
                        {linked ? (
                          <div className="space-y-1">
                             <div className="w-full bg-emerald-500 text-white py-3 rounded-xl text-[11px] font-black border border-emerald-600 flex items-center justify-center gap-2 shadow-md">
                               <Zap className="w-3.5 h-3.5 fill-white" /> 已成功連動
                             </div>
                             <p className="text-[8px] font-mono text-slate-400 text-center uppercase tracking-tighter mt-1">UID: {c.UserId?.substring(0, 12)}...</p>
                             <button onClick={() => handleUnlinkLine(c)} className="w-full text-[9px] text-red-400 font-black hover:text-red-600 flex items-center justify-center gap-1 mt-1 transition-colors">
                                <Link2Off className="w-3 h-3" /> 解除連動
                             </button>
                          </div>
                        ) : (
                          <div className="w-full bg-slate-50 text-slate-300 py-3 rounded-xl text-[11px] font-black border border-slate-100 flex items-center justify-center gap-2">
                             <LinkIcon className="w-3.5 h-3.5" /> 請至連結中心連動
                          </div>
                        )}
                     </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* --- Modals --- */}
      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-800 p-1"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-800 mb-8">建立行程通知</h3>
              {!selectedCustomer ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">請先選擇客戶</p>
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                        {c.name} {isLineLinked(c) && <Zap className="w-4 h-4 text-emerald-500 fill-current"/>}
                        <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100"/>
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-6">
                   {/* 💡 這裡的背景是灰色的，下面的輸入框也要一致 */}
                   <div className="p-4 bg-slate-50 rounded-2xl text-[12px] font-black text-slate-600 flex justify-between items-center border border-slate-100 shadow-inner">
                      <span>已選：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500">更換</button>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">預約日期與時間</label>
                      {/* 💡 修正：移除 bg-white，讓它顯示為 bg-slate-50 的灰色 */}
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={`${inputClass} h-14`} />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">行程項目</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                         {['諮詢', '丈量', '看圖', '簽約'].map(type => (
                           <button key={type} onClick={() => { setResType(type); setCustomType(''); }} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${resType === type ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{type}</button>
                         ))}
                         <button onClick={() => { setResType('其他'); setTimeout(() => customInputRef.current?.focus(), 100); }} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${resType === '其他' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>+ 其他</button>
                      </div>
                   </div>
                   {resType === '其他' && <input ref={customInputRef} type="text" placeholder="輸入行程名稱..." value={customType} onChange={e => setCustomType(e.target.value)} className={inputClass} />}
                   <button onClick={async () => {
                     if(!resDate) return alert("請選擇日期時間");
                     setIsProcessing(true);
                     const actualId = customers.find(c => c.id === selectedCustomer.id)?.UserId || "";
                     const rid = `res-${Date.now()}`;
                     const finalService = resType === '其他' ? customType : resType;
                     const newRes: Reservation = {
                       id: rid, customerId: selectedCustomer.id, customerName: selectedCustomer.name, UserId: actualId, dateTime: resDate, type: finalService as any, status: 'pending', immediateNotified: false, reminded: false, createdAt: Date.now()
                     };
                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       const sent = await triggerMakeWebhook(actualId, newRes.customerName, newRes.dateTime, finalService);
                       setShowResModal(false); setSelectedCustomer(null);
                       alert(sent ? "✅ 行程已排定並發送 LINE 通知" : "✅ 行程已存檔（未連動 LINE）");
                     } catch(e) { alert("發生錯誤"); } finally { setIsProcessing(false); }
                   }} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-2xl active:scale-95 transition-all">
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : "確認並發送行程"}
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] border w-full max-w-sm p-12 shadow-2xl animate-slide-up relative">
              <button onClick={() => setShowAddCustomerModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 p-2"><X className="w-7 h-7"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-10 tracking-tight">新增客戶基本資料</h3>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
                 const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
                 if (!name) return alert("請輸入姓名");
                 setIsProcessing(true);
                 const id = `cust-${Date.now()}`;
                 try {
                   await setDoc(doc(db, "customers", id), { id, name, phone, tags: [], createdAt: Date.now(), UserId: "" });
                   setShowAddCustomerModal(false);
                   alert("客戶新增成功！");
                 } catch (err) { alert("新增失敗"); } finally { setIsProcessing(false); }
              }} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">客戶姓名 (必填)</label>
                    {/* 💡 修正：移除 bg-white */}
                    <input name="name" type="text" placeholder="例如：林大明" className={`${inputClass} h-16 rounded-2xl`} required />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">聯絡電話 (選填)</label>
                    <input name="phone" type="text" placeholder="09xx-xxx-xxx" className={`${inputClass} h-16 rounded-2xl`} />
                 </div>
                 <button type="submit" disabled={isProcessing} className="w-full h-18 bg-slate-900 text-white rounded-[24px] font-black shadow-2xl active:scale-95 transition-all py-5">
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : "儲存客戶資料"}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;