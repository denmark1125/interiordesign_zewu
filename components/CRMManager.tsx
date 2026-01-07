
import React, { useState, useEffect } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Users, Calendar as CalendarIcon, MessageSquare, Bell, UserPlus, Search, CheckCircle2, Clock, Send, Inbox, Link as LinkIcon, X, Check, Loader2, AlertCircle, Plus, ChevronRight, LayoutList, Bot, Smartphone, ExternalLink, ChevronLeft, AlertTriangle, UserCheck, Tag, Trash2, Save, Wifi, Bug, MapPin, Edit3, CalendarX } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from '../services/firebase';

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

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [linkingItem, setLinkingItem] = useState<LineConnection | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState(''); 
  
  // 表單狀態
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustTags, setNewCustTags] = useState('');
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<Reservation['type']>('諮詢');
  const [customResLabel, setCustomResLabel] = useState('');

  useEffect(() => {
    // 監聽客戶
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))),
      (err) => console.error("Customer snapshot error:", err)
    );
    
    // 監聽連結池
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LineConnection));
        setLineInbox(data.filter(i => i.isBound !== true));
      },
      (err) => console.error("Inbox snapshot error:", err)
    );
    
    // 監聽預約
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation))),
      (err) => console.error("Reservation snapshot error:", err)
    );
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  const triggerMakeWebhook = async (res: any, isUpdate: boolean = false) => {
    if (!MAKE_IMMEDIATE_WEBHOOK_URL) return false;
    try {
      const serviceName = res.type === '其他' ? (res.customTypeLabel || '其他事項') : (res.type || '測試通知');
      const response = await fetch(MAKE_IMMEDIATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: res.lineUserId || "SYSTEM_TEST",
          clientName: res.customerName || "未知客戶",
          appointmentTime: res.dateTime ? new Date(res.dateTime).toLocaleString('zh-TW') : new Date().toLocaleString(),
          serviceName: serviceName,
          status: res.status || 'pending',
          isUpdate: isUpdate,
          source: "澤物管理系統"
        })
      });
      return response.ok;
    } catch (e) {
      console.error("Webhook trigger failed", e);
      return false;
    }
  };

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    const success = await triggerMakeWebhook({ type: '連線測試', customerName: currentUser.name });
    if (success) alert("連線測試成功！");
    else alert("Webhook 發送失敗，請確認 Make.com 的 Hook 是否已開啟。");
    setIsSendingTest(false);
  };

  const handleAddCustomer = async () => {
    if (!newCustName.trim()) { alert("請輸入姓名"); return; }
    const customerId = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      id: customerId,
      name: newCustName,
      phone: newCustPhone || "",
      address: newCustAddress || "",
      tags: newCustTags.split(',').map(t => t.trim()).filter(t => t),
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, "customers", customerId), newCustomer);
      setShowCustomerModal(false);
      setNewCustName(''); setNewCustPhone(''); setNewCustAddress(''); setNewCustTags('');
    } catch (e) { alert("客戶資料儲存失敗"); }
  };

  const handleOpenEditReservation = (res: Reservation) => {
    setEditingReservation(res);
    setResDate(res.dateTime);
    setResType(res.type);
    setCustomResLabel(res.customTypeLabel || '');
    setShowResModal(true);
  };

  const handleCancelReservation = async (res: Reservation) => {
    if (!window.confirm("確定要取消預約嗎？")) return;
    try {
      await updateDoc(doc(db, "reservations", res.id), { status: 'cancelled' });
      alert("預約已標記為取消");
    } catch (e) { alert("操作失敗"); }
  };

  // 核心修復：解決預約寫入失敗
  const handleAddReservation = async () => {
    const isUpdate = !!editingReservation;
    const targetCustomer = editingReservation 
      ? customers.find(c => c.id === editingReservation.customerId) 
      : selectedCustomer;

    if (!targetCustomer || !resDate) { alert("請填寫日期與選擇客戶"); return; }
    
    const resId = isUpdate ? editingReservation!.id : `res-${Date.now()}`;
    
    // 預防 undefined：Firestore 不允許 undefined 值
    const newRes: Reservation = {
      id: resId,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
      lineUserId: targetCustomer.lineConnectionId || null, // 若無則設為 null
      dateTime: resDate,
      type: resType,
      customTypeLabel: resType === '其他' ? (customResLabel || "未命名項目") : null, // 關鍵：不能是 undefined
      status: 'pending',
      immediateNotified: false,
      reminded: false,
      createdAt: isUpdate ? editingReservation!.createdAt : Date.now()
    };

    try {
      await setDoc(doc(db, "reservations", resId), newRes);
      
      // 成功寫入資料庫後再嘗試發送 Webhook
      if (newRes.lineUserId) {
        const success = await triggerMakeWebhook(newRes, isUpdate);
        if (success) {
          await updateDoc(doc(db, "reservations", resId), { immediateNotified: true });
        }
      }
      
      alert(isUpdate ? "預約變更成功！" : "預約已成功建立！");
      setShowResModal(false);
      setEditingReservation(null);
      setSelectedCustomer(null);
      setResDate('');
    } catch (e: any) { 
      console.error("Reservation Error:", e);
      alert("預約寫入失敗，詳細原因：" + e.message); 
    }
  };

  const handleLinkUser = async (customer: Customer) => {
    if (!linkingItem) return;
    try {
      const payload = {
        lineConnectionId: linkingItem.lineUserId || "",
        lineDisplayName: linkingItem.lineDisplayName || "LINE 用戶",
        linePictureUrl: linkingItem.linePictureUrl || ""
      };
      await updateDoc(doc(db, "customers", customer.id), payload);
      await updateDoc(doc(db, "line_connections", linkingItem.id), { isBound: true });
      setLinkingItem(null);
      alert(`連結成功：${customer.name}`);
    } catch (e: any) { 
      alert("綁定失敗：" + e.message); 
    }
  };

  const filteredCustomers = (customers || []).filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || "").includes(searchTerm)
  );

  const modalFilteredClients = customers.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(clientSearchTerm))
  );

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    
  const getReservationsForDay = (date: Date) => 
    (reservations || []).filter(res => isSameDay(new Date(res.dateTime), date));

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#06C755]" />
            預約管理中心
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-bold">案場進度排程與 LINE 自動通知</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
          <button onClick={() => setActiveTab('reservations')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'reservations' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}`}><CalendarIcon className="w-4 h-4" /> 預約日曆</button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'customers' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}`}><Users className="w-4 h-4" /> 客戶名單</button>
          <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}`}>
            <Inbox className="w-4 h-4" /> 連結池
            {lineInbox.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse font-black">{lineInbox.length}</span>}
          </button>
          <button onClick={() => setActiveTab('automation')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'automation' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}`}><Bot className="w-4 h-4" /> 自動化</button>
        </div>
      </div>

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black text-slate-900">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h3>
                  <div className="flex gap-1">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-colors border border-slate-200 shadow-sm"><ChevronLeft className="w-5 h-5 text-black" /></button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-colors border border-slate-200 shadow-sm"><ChevronRight className="w-5 h-5 text-black" /></button>
                  </div>
                </div>
                <button onClick={() => { setEditingReservation(null); setSelectedCustomer(null); setShowResModal(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus className="w-4 h-4" /> 新增預約</button>
             </div>
             <div className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-16 sm:h-20"></div>)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                    const dayRes = getReservationsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    return (
                      <button key={i} onClick={() => setSelectedDay(day)} className={`h-16 sm:h-20 rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-2 relative group ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105 z-10' : isToday ? 'bg-orange-50 border-orange-400 text-orange-900' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}>
                        {/* 修復：日曆數字強制純黑 */}
                        <span className={`text-xl font-black ${isSelected ? 'text-white' : 'text-black'}`}>{i + 1}</span>
                        {dayRes.length > 0 && <div className={`w-2 h-2 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#06C755]'}`}></div>}
                        {isToday && !isSelected && <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white shadow-sm animate-pulse"></div>}
                      </button>
                    );
                  })}
                </div>
             </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-fit max-h-[600px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><LayoutList className="w-5 h-5 text-slate-400" /> 行程詳情</h3>
              {selectedDay && <span className="text-xs font-black text-slate-500 bg-white px-2 py-1 rounded border">{selectedDay.toLocaleDateString()}</span>}
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {selectedDay ? (
                getReservationsForDay(selectedDay).length > 0 ? (
                  getReservationsForDay(selectedDay).map(res => (
                    <div key={res.id} className={`p-5 rounded-2xl border-2 transition-all relative group ${res.status === 'cancelled' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:shadow-md'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${res.status === 'cancelled' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                          {res.status === 'cancelled' ? '已取消' : (res.type === '其他' ? res.customTypeLabel : res.type)}
                        </span>
                        {res.status !== 'cancelled' && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                             <button onClick={() => handleOpenEditReservation(res)} className="p-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-900 hover:text-white transition-all"><Edit3 className="w-4 h-4"/></button>
                             <button onClick={() => handleCancelReservation(res)} className="p-1.5 bg-red-50 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"><CalendarX className="w-4 h-4"/></button>
                          </div>
                        )}
                      </div>
                      <h4 className={`font-black text-xl ${res.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-black'}`}>{res.customerName}</h4>
                      <div className="flex items-center gap-2 mt-2">
                         <Clock className={`w-4 h-4 ${res.status === 'cancelled' ? 'text-slate-300' : 'text-black'}`} />
                         <span className={`text-sm font-black font-mono ${res.status === 'cancelled' ? 'text-slate-300' : 'text-black'}`}>
                            {new Date(res.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                    </div>
                  ))
                ) : <p className="text-center py-20 text-slate-300 font-black italic">今日無預約行程</p>
              ) : <p className="text-center py-20 text-slate-300 font-black italic">請選取日期</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="搜尋姓名、電話、地址..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-slate-100 transition-all font-black text-black" />
            </div>
            <button onClick={() => setShowCustomerModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95"><UserPlus className="w-5 h-5" /> 手動新增客戶</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-100 hover:shadow-xl transition-all group relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xl border-2 border-white shadow-inner overflow-hidden">
                      {customer.linePictureUrl ? <img src={customer.linePictureUrl} className="w-full h-full object-cover" /> : (customer.name || "?").charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-black text-xl">{customer.name}</h4>
                      <p className="text-sm text-slate-500 font-mono font-black">{customer.phone || '未留電話'}</p>
                    </div>
                  </div>
                  <button onClick={async () => { if(window.confirm("徹底刪除客戶資料？")) await deleteDoc(doc(db, "customers", customer.id)); }} className="text-slate-200 hover:text-red-500 transition-all p-2"><Trash2 className="w-5 h-5" /></button>
                </div>
                {customer.address && (
                  <div className="mb-4 flex items-start gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-800 font-black line-clamp-2 leading-relaxed">{customer.address}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className={`flex-1 py-3 rounded-xl text-center text-[10px] font-black flex items-center justify-center gap-1 border ${customer.lineConnectionId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {customer.lineConnectionId ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    {customer.lineConnectionId ? 'LINE 已連動' : '尚未連結 LINE'}
                  </div>
                  <button onClick={() => onConvertToProject?.(customer)} className="px-5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 text-xs font-black active:scale-95"><ExternalLink className="w-4 h-4" /> 轉換案場</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 連結池 */}
      {activeTab === 'inbox' && (
        <div className="max-w-2xl mx-auto animate-slide-up">
           <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl">
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Inbox className="w-10 h-10 text-[#06C755]" /> LINE 待連結客戶</h3>
              <p className="text-sm text-slate-500 mb-6 font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">這些是從 LINE 加入好友並傳送訊息的用戶，請將其綁定到現有客戶資料中。</p>
              <div className="space-y-4">
                {lineInbox.map(item => (
                  <div key={item.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-[#06C755]/30 transition-all">
                    <div className="flex items-center gap-5">
                      {item.linePictureUrl ? (
                         <img src={item.linePictureUrl} className="w-16 h-16 rounded-2xl border-4 border-white shadow-md" />
                      ) : (
                         <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center border-4 border-white shadow-md font-black text-slate-400">?</div>
                      )}
                      <div>
                        <h4 className="font-black text-black text-xl mb-1">{item.lineDisplayName || "未具名好友"}</h4>
                        <p className="text-[10px] text-slate-400 font-bold font-mono tracking-tight">{item.lineUserId.substring(0, 15)}...</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkingItem(item)} className="bg-[#06C755] text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-green-600 active:scale-95 transition-all"><LinkIcon className="w-5 h-5" /> 綁定客戶</button>
                  </div>
                ))}
                {lineInbox.length === 0 && (
                  <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Bot className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-black italic text-lg">目前沒有待連結的資料</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 自動化 */}
      {activeTab === 'automation' && (
        <div className="max-w-3xl mx-auto animate-slide-up">
           <div className="bg-white p-12 rounded-[50px] border border-slate-200 shadow-2xl relative overflow-hidden">
              <h3 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4"><Bot className="w-12 h-12 text-[#06C755]" /> 自動化通知設定</h3>
              <div className="bg-emerald-50 p-10 rounded-[40px] border border-emerald-100 mb-10 shadow-inner">
                 <div className="flex items-center gap-3 font-black text-slate-900 mb-4 text-2xl"><Wifi className="w-8 h-8 text-emerald-600" /> Webhook 通訊測試</div>
                 <p className="text-lg text-slate-700 mb-10 font-bold leading-relaxed">發送測試封包確認 Make.com 是否能接收並處理來自本系統的通知。這將發送一筆範例資料至 Hook 端。</p>
                 <button 
                  onClick={handleTestNotification} 
                  disabled={isSendingTest}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-6 rounded-3xl font-black flex items-center justify-center gap-4 shadow-xl active:scale-95 disabled:opacity-50 text-xl"
                 >
                    {isSendingTest ? <Loader2 className="w-7 h-7 animate-spin" /> : <Send className="w-7 h-7" />}
                    發送連線測試
                 </button>
              </div>
              <div className="p-6 bg-slate-900 rounded-[32px] text-white">
                 <h4 className="font-black text-[#06C755] mb-4 text-lg">整合終端點</h4>
                 <code className="text-[10px] break-all opacity-70 block bg-black/30 p-4 rounded-xl font-mono">{MAKE_IMMEDIATE_WEBHOOK_URL}</code>
              </div>
           </div>
        </div>
      )}

      {/* --- Modals --- */}
      
      {/* 預約建立彈窗 - 修正寫入失敗 */}
      {showResModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-slide-up border border-slate-200">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900">{editingReservation ? '更新預約' : '安排行程'}</h3>
                <button onClick={() => { setShowResModal(false); setEditingReservation(null); setClientSearchTerm(''); }} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X className="w-6 h-6"/></button>
            </div>

            {(!editingReservation && !selectedCustomer) ? (
              <div className="space-y-5">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="快速搜尋客戶姓名..." 
                      value={clientSearchTerm}
                      onChange={e => setClientSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:bg-white focus:border-slate-900 transition-all font-black text-black text-lg shadow-inner"
                    />
                 </div>
                 <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {modalFilteredClients.map(c => (
                      <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-6 text-left bg-white hover:bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-black transition-all flex items-center justify-between group active:scale-[0.98]">
                        <span className="text-xl">{c.name}</span>
                        <span className="text-slate-500 font-bold text-sm bg-slate-100 px-3 py-1 rounded-full group-hover:bg-white transition-all">{c.phone || '無電話'}</span>
                      </button>
                    ))}
                    {modalFilteredClients.length === 0 && <p className="text-center py-10 text-slate-400 font-black italic bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">找不到資料</p>}
                 </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                <div className="p-6 bg-orange-50 rounded-3xl border-2 border-orange-100 font-black text-orange-900 flex items-center gap-4 shadow-sm">
                    <UserCheck className="w-8 h-8 text-orange-600" />
                    <p className="text-2xl font-black">{editingReservation ? editingReservation.customerName : selectedCustomer?.name}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['諮詢', '丈量', '看圖', '簽約', '其他'].map(t => (
                    <button key={t} onClick={() => setResType(t as any)} className={`py-4 rounded-2xl font-black border-2 transition-all text-sm ${resType === t ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white text-black hover:bg-slate-50 border-slate-100'}`}>{t}</button>
                  ))}
                </div>
                {resType === '其他' && (
                  <div className="animate-slide-up">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">自定義工項名稱</label>
                    <input type="text" value={customResLabel} onChange={e => setCustomResLabel(e.target.value)} placeholder="例如：工地場勘、石材確認..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:bg-white transition-all font-black text-black" />
                  </div>
                )}
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">預約日期與時間</label>
                    <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full p-6 border-2 border-slate-100 bg-slate-50 rounded-3xl font-black text-black outline-none focus:bg-white focus:border-slate-900 transition-all text-lg shadow-inner" />
                </div>
                <button onClick={handleAddReservation} className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black shadow-2xl hover:bg-slate-800 transition-all active:scale-95 text-xl flex items-center justify-center gap-3">
                    <Save className="w-6 h-6" />
                    {editingReservation ? '更新預約並通知' : '建立預約並傳送 LINE'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 連結池綁定彈窗 */}
      {linkingItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-[50px] w-full max-w-md p-12 shadow-2xl animate-slide-up border border-slate-200">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black text-slate-900">綁定 LINE 好友</h3>
                <button onClick={() => setLinkingItem(null)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-all"><X className="w-6 h-6 text-slate-500" /></button>
              </div>
              <div className="flex items-center gap-6 p-6 bg-emerald-50 rounded-[32px] border-2 border-emerald-100 mb-10 shadow-sm">
                 {linkingItem.linePictureUrl ? <img src={linkingItem.linePictureUrl} className="w-20 h-20 rounded-2xl border-4 border-white shadow-md" /> : <div className="w-20 h-20 bg-slate-200 rounded-2xl" />}
                 <h4 className="font-black text-black text-2xl leading-none">{linkingItem.lineDisplayName || "未具名好友"}</h4>
              </div>
              <p className="text-[10px] font-black text-slate-400 mb-4 uppercase ml-2 tracking-widest">請選擇要綁定的系統客戶：</p>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                 {customers.filter(c => !c.lineConnectionId).map(c => (
                   <button key={c.id} onClick={() => handleLinkUser(c)} className="w-full p-6 text-left bg-white hover:bg-[#06C755] hover:text-white rounded-[28px] font-black text-black transition-all border-2 border-slate-100 flex justify-between items-center group shadow-sm active:scale-95">
                      <span className="text-xl">{c.name}</span>
                      <ChevronRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all" />
                   </button>
                 ))}
                 {customers.filter(c => !c.lineConnectionId).length === 0 && <p className="text-center py-10 text-slate-400 font-black italic">目前沒有可綁定的新客戶</p>}
              </div>
           </div>
        </div>
      )}

      {/* 新增客戶彈窗 */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-slide-up border border-slate-200">
              <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black text-slate-900">新增潛在客戶</h3><button onClick={() => setShowCustomerModal(false)} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X className="w-6 h-6"/></button></div>
              <div className="space-y-5">
                <input type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="客戶姓名 (必填)" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none font-black text-black focus:bg-white focus:border-slate-900 transition-all text-lg shadow-inner" />
                <input type="text" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="連絡電話" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none font-black text-black focus:bg-white focus:border-slate-900 transition-all text-lg shadow-inner" />
                <textarea value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} placeholder="案場地址或初步需求備註..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none font-black text-black focus:bg-white focus:border-slate-900 transition-all text-lg shadow-inner" rows={3} />
                <button onClick={handleAddCustomer} className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black shadow-2xl mt-4 active:scale-95 transition-all text-xl">儲存客戶資料</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default CRMManager;
