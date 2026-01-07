
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Users, Calendar as CalendarIcon, MessageSquare, Bell, UserPlus, Search, CheckCircle2, Clock, Send, Inbox, Link as LinkIcon, X, Check, Loader2, AlertCircle, Plus, ChevronRight, LayoutList, Bot, Smartphone, ExternalLink, ChevronLeft, AlertTriangle, UserCheck, Tag, Trash2, Save, Wifi, WifiOff, Zap, Bug } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, addDoc } from '../services/firebase';

// --- Make.com Webhook URL (最新) ---
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/dwpmwbwg6ffqrg68s0zhrjd8iv1cmdhp"; 

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
  
  const [isNotifying, setIsNotifying] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // 日曆狀態
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  // Modal 狀態
  const [linkingItem, setLinkingItem] = useState<LineConnection | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustTags, setNewCustTags] = useState('');

  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<Reservation['type']>('諮詢');

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), (snap) => {
      setLineInbox(snap.docs.map(d => ({ id: d.id, ...d.data(), lineUserId: d.id } as LineConnection)).filter(i => !i.isBound));
    });
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), (snap) => {
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
    });
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  const triggerMakeWebhook = async (res: Reservation) => {
    if (!MAKE_IMMEDIATE_WEBHOOK_URL || !res.lineUserId) return false;
    try {
      const response = await fetch(MAKE_IMMEDIATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: res.lineUserId,
          clientName: res.customerName,
          appointmentTime: new Date(res.dateTime).toISOString(),
          serviceName: res.type
        })
      });
      return response.ok;
    } catch (e) {
      console.error("Webhook trigger failed", e);
      return false;
    }
  };

  const handleSendTestData = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch(MAKE_IMMEDIATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: "U-TEST-USER-ID-123",
          clientName: "測試客戶 (澤物設計)",
          appointmentTime: new Date().toISOString(),
          serviceName: "現場丈量 (測試資料)"
        })
      });
      if (response.ok) alert("測試資料已成功發送！");
      else alert("發送失敗");
    } catch (e) { alert("發生錯誤"); }
    finally { setIsSendingTest(false); }
  };

  const handleAddCustomer = async () => {
    if (!newCustName.trim()) { alert("請輸入姓名"); return; }
    const customerId = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      id: customerId,
      name: newCustName,
      phone: newCustPhone,
      tags: newCustTags.split(',').map(t => t.trim()).filter(t => t),
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, "customers", customerId), newCustomer);
      setShowCustomerModal(false);
      setNewCustName(''); setNewCustPhone(''); setNewCustTags('');
    } catch (e) { alert("儲存失敗"); }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm("確定刪除此客戶及其所有資料？")) return;
    try { await deleteDoc(doc(db, "customers", id)); } catch (e) { alert("刪除失敗"); }
  };

  const handleManualNotify = async (res: Reservation) => {
    if (!res.lineUserId) { alert("此客戶未綁定 LINE"); return; }
    setIsNotifying(res.id);
    const success = await triggerMakeWebhook(res);
    if (success) {
      await updateDoc(doc(db, "reservations", res.id), { immediateNotified: true });
      alert("通知補發成功！");
    } else alert("發送失敗");
    setIsNotifying(null);
  };

  const handleDeleteReservation = async (id: string) => {
    if (!window.confirm("確定刪除此預約？")) return;
    try { await deleteDoc(doc(db, "reservations", id)); } catch (e) { alert("刪除失敗"); }
  };

  const handleLinkUser = async (customer: Customer) => {
    if (!linkingItem) return;
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        lineConnectionId: linkingItem.id,
        lineDisplayName: linkingItem.lineDisplayName,
        linePictureUrl: linkingItem.linePictureUrl
      });
      await updateDoc(doc(db, "line_connections", linkingItem.id), { isBound: true });
      setLinkingItem(null);
    } catch (e) { alert("綁定失敗"); }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const getReservationsForDay = (date: Date) => reservations.filter(res => isSameDay(new Date(res.dateTime), date));

  const handleAddReservation = async () => {
    if (!selectedCustomer || !resDate) return;
    const resId = `res-${Date.now()}`;
    const newRes: Reservation = {
      id: resId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      lineUserId: selectedCustomer.lineConnectionId || null,
      dateTime: resDate,
      type: resType,
      status: 'pending',
      immediateNotified: false,
      reminded: false,
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, "reservations", resId), newRes);
      if (newRes.lineUserId) {
        const success = await triggerMakeWebhook(newRes);
        if (success) await updateDoc(doc(db, "reservations", resId), { immediateNotified: true });
      }
      alert("預約已建立");
      setShowResModal(false);
      setSelectedCustomer(null);
    } catch (e) { alert("建立失敗"); }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#06C755]" />
            預約管理系統
          </h2>
          <p className="text-slate-500 text-sm mt-1">即時同步 LINE 自動化通知</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
          <button onClick={() => setActiveTab('reservations')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'reservations' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><CalendarIcon className="w-4 h-4" /> 預約日曆</button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'customers' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Users className="w-4 h-4" /> 客戶名單</button>
          <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            <Inbox className="w-4 h-4" /> 連結池
            {lineInbox.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{lineInbox.length}</span>}
          </button>
          <button onClick={() => setActiveTab('automation')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'automation' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Bot className="w-4 h-4"/> 自動化設定</button>
        </div>
      </div>

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-slate-800">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h3>
                <div className="flex gap-1">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
              <button onClick={() => setShowResModal(true)} className="bg-[#54534d] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4" /> 新增預約</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-20 sm:h-24"></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                  const dayRes = getReservationsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  return (
                    <button key={i} onClick={() => setSelectedDay(day)} className={`h-20 sm:h-24 rounded-2xl border transition-all flex flex-col items-center justify-start p-2 relative group ${isSelected ? 'bg-slate-800 border-slate-800 text-white shadow-xl scale-105 z-10' : isToday ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                      <span className={`text-sm font-black mb-1 ${isSelected ? 'text-white' : 'text-slate-700'}`}>{i + 1}</span>
                      {dayRes.length > 0 && <div className="w-2 h-2 rounded-full bg-[#06C755] mt-1"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><LayoutList className="w-5 h-5 text-slate-400" />本日行程</h3>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[600px]">
              {selectedDay ? (
                getReservationsForDay(selectedDay).length > 0 ? (
                  getReservationsForDay(selectedDay).map(res => (
                    <div key={res.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{res.type}</span>
                        <button onClick={() => handleDeleteReservation(res.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                      </div>
                      <h4 className="font-bold text-slate-800">{res.customerName}</h4>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{new Date(res.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      <div className="mt-3 flex gap-2">
                        <div className={`px-2 py-1 rounded text-[9px] font-black border ${res.immediateNotified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                           {res.immediateNotified ? '✓ 即時通知已發送' : '待補發'}
                           {!res.immediateNotified && res.lineUserId && (
                             <button onClick={() => handleManualNotify(res)} className="ml-2 underline" disabled={isNotifying === res.id}>
                               {isNotifying === res.id ? '發送中...' : '手動補發'}
                             </button>
                           )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : <p className="text-center py-20 text-slate-300 text-sm">今日無行程</p>
              ) : <p className="text-center py-20 text-slate-300 text-sm">請選取日期</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="搜尋客戶姓名或電話..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-800/5 transition-all font-bold" />
            </div>
            <button onClick={() => setShowCustomerModal(true)} className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><UserPlus className="w-5 h-5" /> 新增客戶</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white p-6 rounded-3xl border border-slate-200 hover:shadow-lg transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-xl overflow-hidden border">
                      {customer.linePictureUrl ? <img src={customer.linePictureUrl} className="w-full h-full object-cover" /> : customer.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{customer.name}</h4>
                      <p className="text-sm text-slate-400 font-mono">{customer.phone || '未留電話'}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteCustomer(customer.id)} className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {customer.tags.map(t => <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">#{t}</span>)}
                </div>
                <div className="flex gap-2">
                  {customer.lineConnectionId ? (
                    <div className="flex-1 bg-emerald-50 text-emerald-600 py-3 rounded-xl text-center text-xs font-black flex items-center justify-center gap-2 border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4" /> LINE 已綁定
                    </div>
                  ) : (
                    <div className="flex-1 bg-amber-50 text-amber-600 py-3 rounded-xl text-center text-xs font-black flex items-center justify-center gap-2 border border-amber-100">
                      <AlertTriangle className="w-4 h-4" /> 未連結 LINE
                    </div>
                  )}
                  <button onClick={() => onConvertToProject?.(customer)} className="px-4 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"><ExternalLink className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'inbox' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Inbox className="w-8 h-8 text-[#06C755]" /> LINE 待連結池</h3>
                 <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">{lineInbox.length} 筆待連結</span>
              </div>
              <div className="space-y-4">
                {lineInbox.map(item => (
                  <div key={item.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-[#06C755]/20 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                        <img src={item.linePictureUrl} className="w-full h-full object-cover" />
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-lg">{item.lineDisplayName}</h4>
                         <p className="text-sm text-[#06C755] font-bold">最後訊息：{item.lastMessage || '無'}</p>
                         <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-widest">{new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkingItem(item)} className="bg-[#06C755] text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-green-500/10 active:scale-95 transition-all"><LinkIcon className="w-4 h-4" /> 綁定客戶</button>
                  </div>
                ))}
                {lineInbox.length === 0 && <div className="text-center py-20 text-slate-300 font-bold">目前無待連結的 LINE 客戶</div>}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
           <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10"><Bot className="w-40 h-40 text-[#06C755]" /></div>
              <h3 className="text-3xl font-black text-slate-800 mb-6 flex items-center gap-3"><Bot className="w-10 h-10 text-[#06C755]" /> Make.com 設定助手</h3>
              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 mb-8">
                 <div className="flex items-center gap-2 font-black text-slate-800 mb-4"><Bug className="w-5 h-5 text-emerald-600" /> 第一步：抓取資料結構</div>
                 <p className="text-sm text-slate-600 mb-6 font-bold">請在 Make.com Webhook 點擊「Redetermine Data Structure」，接著點擊下方按鈕發送測試 JSON。</p>
                 <button onClick={handleSendTestData} disabled={isSendingTest} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-lg transition-all disabled:opacity-50">{isSendingTest ? <Loader2 className="animate-spin" /> : <Send />} 發送測試資料</button>
              </div>
              <div className="bg-slate-800 p-8 rounded-[32px] text-white">
                 <h4 className="font-black mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> 設定指南</h4>
                 <ul className="text-sm text-slate-300 space-y-3 font-bold font-mono">
                   <li>1. Firestore Collection: <span className="text-emerald-400 underline">reservations</span></li>
                   <li>2. Webhook URL: <span className="text-blue-400 break-all">{MAKE_IMMEDIATE_WEBHOOK_URL}</span></li>
                   <li>3. Fields: lineUserId, clientName, appointmentTime, serviceName</li>
                 </ul>
              </div>
           </div>
        </div>
      )}

      {/* Modals */}
      {linkingItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black">綁定現有客戶</h3>
                 <button onClick={() => setLinkingItem(null)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-3xl border border-emerald-100 mb-6">
                 <img src={linkingItem.linePictureUrl} className="w-16 h-16 rounded-2xl shadow-sm" />
                 <div><p className="text-xs font-black text-emerald-600 mb-1">正在綁定 LINE 帳號</p><h4 className="font-black text-slate-800 text-lg">{linkingItem.lineDisplayName}</h4></div>
              </div>
              <p className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">請從名單選取一位客戶連結：</p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                 {customers.filter(c => !c.lineConnectionId).map(c => (
                   <button key={c.id} onClick={() => handleLinkUser(c)} className="w-full p-4 text-left bg-slate-50 hover:bg-[#06C755] hover:text-white rounded-2xl font-black transition-all border border-slate-100 flex justify-between items-center group">
                     {c.name} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
                   </button>
                 ))}
                 {customers.filter(c => !c.lineConnectionId).length === 0 && <p className="text-center py-10 text-slate-300 text-sm font-bold">無未綁定的客戶</p>}
              </div>
           </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 animate-slide-up shadow-2xl">
              <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black">新增客戶資料</h3><button onClick={() => setShowCustomerModal(false)}><X className="w-6 h-6 text-slate-300"/></button></div>
              <div className="space-y-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">客戶姓名</label><input type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="姓名" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white transition-all font-black text-slate-800" /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">聯絡電話</label><input type="text" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="電話" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white transition-all font-black text-slate-800" /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">標籤 (以逗號隔開)</label><input type="text" value={newCustTags} onChange={e => setNewCustTags(e.target.value)} placeholder="信義區, 舊屋翻新" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white transition-all font-black text-slate-800" /></div>
                <button onClick={handleAddCustomer} className="w-full bg-slate-800 text-white py-5 rounded-[20px] font-black shadow-xl active:scale-95 transition-all mt-4">儲存客戶</button>
              </div>
           </div>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 animate-slide-up shadow-2xl">
            <h3 className="text-2xl font-black mb-8">預約排程</h3>
            {!selectedCustomer ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-3">請先選取客戶：</p>
                 {customers.map(c => <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 text-left border rounded-2xl hover:bg-slate-50 font-black transition-all flex items-center justify-between group">{c.name} <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-800" /></button>)}
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 font-black text-emerald-800 flex items-center gap-2">已選取：{selectedCustomer.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  {['諮詢', '丈量', '看圖', '簽約'].map(t => <button key={t} onClick={() => setResType(t as any)} className={`py-4 rounded-2xl font-black border transition-all ${resType === t ? 'bg-[#54534d] text-white shadow-lg' : 'bg-white text-slate-400'}`}>{t}</button>)}
                </div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">預約時間</label><input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full p-5 border border-slate-100 bg-slate-50 rounded-2xl font-black text-slate-800 outline-none" /></div>
                <button onClick={handleAddReservation} className="w-full bg-[#54534d] text-white py-5 rounded-[20px] font-black shadow-xl active:scale-95 transition-all mt-4">確認並通知 LINE</button>
                <button onClick={() => setSelectedCustomer(null)} className="w-full text-slate-400 font-bold text-sm">重新選取客戶</button>
              </div>
            )}
            {!selectedCustomer && <button onClick={() => setShowResModal(false)} className="w-full mt-4 text-slate-400 font-bold">關閉</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;
