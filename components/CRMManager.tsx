
import React, { useState, useEffect } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Users, Calendar as CalendarIcon, MessageSquare, Bell, UserPlus, Search, CheckCircle2, Clock, Send, Inbox, Link as LinkIcon, X, Check, Loader2, AlertCircle, Plus, ChevronRight, LayoutList, Bot, Smartphone, ExternalLink, ChevronLeft, AlertTriangle, UserCheck, Tag, Trash2, Save, Wifi, Bug, MapPin, Edit3, CalendarX, Activity, Link2Off } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, getDocs, where, collection } from '../services/firebase';

const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/dwpmwbwg6ffqrg68s0zhrjd8iv1cmdhp"; 

interface WebhookLog {
  time: string;
  status: 'success' | 'failed';
  message: string;
  client: string;
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
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [linkingItem, setLinkingItem] = useState<LineConnection | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState(''); 
  
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<Reservation['type']>('諮詢');
  const [customResLabel, setCustomResLabel] = useState('');

  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => setLineInbox(snap.docs.map(d => ({ id: d.id, ...d.data() } as LineConnection)).filter(i => !i.isBound))
    );
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)))
    );
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  const addWebhookLog = (log: WebhookLog) => {
    setWebhookLogs(prev => [log, ...prev].slice(0, 10));
  };

  const triggerMakeWebhook = async (res: any, isUpdate: boolean = false) => {
    if (!MAKE_IMMEDIATE_WEBHOOK_URL) return false;
    
    const lineId = res.lineUserId;
    if (!lineId || !lineId.startsWith('U')) {
      addWebhookLog({
        time: new Date().toLocaleTimeString(),
        status: 'failed',
        message: `ID異常: [${lineId || '空白'}]，請至客戶名單解除綁定後重連`,
        client: res.customerName
      });
      return false;
    }

    try {
      const serviceName = res.type === '其他' ? (res.customTypeLabel || '其他事項') : (res.type || '一般預約');
      const payload = {
        lineUserId: lineId,
        clientName: res.customerName,
        appointmentTime: res.dateTime ? new Date(res.dateTime).toLocaleString('zh-TW', { hour12: false }) : '未定',
        serviceName: serviceName,
        status: res.status || 'pending',
        isUpdate: isUpdate,
        source: "澤物管理系統"
      };

      const response = await fetch(MAKE_IMMEDIATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        addWebhookLog({
          time: new Date().toLocaleTimeString(),
          status: 'success',
          message: '已成功送達 Make.com',
          client: res.customerName
        });
        return true;
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (e: any) {
      addWebhookLog({
        time: new Date().toLocaleTimeString(),
        status: 'failed',
        message: e.message || '網路錯誤',
        client: res.customerName
      });
      return false;
    }
  };

  const handleOpenEditReservation = (res: Reservation) => {
    setEditingReservation(res);
    setResDate(res.dateTime);
    setResType(res.type);
    setCustomResLabel(res.customTypeLabel || '');
    setShowResModal(true);
  };

  const handleAddReservation = async () => {
    const isUpdate = !!editingReservation;
    const targetCustomerId = editingReservation ? editingReservation.customerId : selectedCustomer?.id;
    const latestCustomer = customers.find(c => c.id === targetCustomerId);

    if (!latestCustomer || !resDate) { alert("請完整填寫日期與客戶"); return; }
    
    const resId = isUpdate ? editingReservation!.id : `res-${Date.now()}`;
    const newRes: Reservation = {
      id: resId,
      customerId: latestCustomer.id,
      customerName: latestCustomer.name,
      lineUserId: latestCustomer.lineConnectionId || null, 
      dateTime: resDate,
      type: resType,
      customTypeLabel: resType === '其他' ? (customResLabel || "其他事項") : null, 
      status: isUpdate ? editingReservation!.status : 'pending',
      immediateNotified: false,
      reminded: false,
      note: isUpdate ? (editingReservation!.note || null) : null,
      createdAt: isUpdate ? editingReservation!.createdAt : Date.now()
    };

    try {
      await setDoc(doc(db, "reservations", resId), newRes);
      
      if (newRes.lineUserId) {
        const success = await triggerMakeWebhook(newRes, isUpdate);
        if (success) {
          await updateDoc(doc(db, "reservations", resId), { immediateNotified: true });
        }
      }
      
      setShowResModal(false);
      setEditingReservation(null);
      setSelectedCustomer(null);
      setResDate('');
    } catch (e: any) { 
      alert("儲存失敗：" + e.message); 
    }
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    
  const getReservationsForDay = (date: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), date));

  const handleLinkUser = async (customer: Customer) => {
    if (!linkingItem) return;
    if (!linkingItem.lineUserId || !linkingItem.lineUserId.startsWith('U')) {
      alert("抓取到的 LINE ID 異常，請重新整理頁面再試。");
      return;
    }
    try {
      const payload = {
        lineConnectionId: linkingItem.lineUserId,
        lineDisplayName: linkingItem.lineDisplayName,
        linePictureUrl: linkingItem.linePictureUrl || ""
      };
      await updateDoc(doc(db, "customers", customer.id), payload);
      await updateDoc(doc(db, "line_connections", linkingItem.id), { isBound: true });
      setLinkingItem(null);
      alert(`成功綁定客戶：${customer.name}`);
    } catch (e: any) { alert("綁定失敗"); }
  };

  // 新增：解除綁定邏輯
  const handleUnlinkUser = async (customer: Customer) => {
    const confirmUnlink = window.confirm(`確定要解除「${customer.name}」與 LINE 的連結嗎？\n解除後該好友會重新出現在「連結池」。`);
    if (!confirmUnlink) return;

    try {
      const oldLineId = customer.lineConnectionId;
      
      // 1. 更新客戶資料，清除 LINE 欄位
      await updateDoc(doc(db, "customers", customer.id), {
        lineConnectionId: null,
        lineDisplayName: null,
        linePictureUrl: null
      });

      // 2. 在連結池中尋找該 ID，將其釋放
      if (oldLineId) {
        const lineSnapshot = await getDocs(query(lineConnectionsCollection, where("lineUserId", "==", oldLineId)));
        if (!lineSnapshot.empty) {
          const lineDocId = lineSnapshot.docs[0].id;
          await updateDoc(doc(db, "line_connections", lineDocId), { isBound: false });
        }
      }
      
      alert("已解除綁定，請至「連結池」重新連動。");
    } catch (e: any) {
      alert("解除綁定失敗：" + e.message);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
      {/* 導覽列 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="px-2">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#06C755]" />
            預約管理
          </h2>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button onClick={() => setActiveTab('reservations')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'reservations' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>排程</button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>名單</button>
          <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all relative ${activeTab === 'inbox' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
            連結池 {lineInbox.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 inline-flex items-center justify-center rounded-full font-black">{lineInbox.length}</span>}
          </button>
          <button onClick={() => setActiveTab('automation')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'automation' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>日誌</button>
        </div>
      </div>

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-1 md:px-0">
          <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <h3 className="text-base md:text-xl font-black text-slate-900">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h3>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1.5 bg-white rounded-lg border border-slate-200"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1.5 bg-white rounded-lg border border-slate-200"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <button onClick={() => { setEditingReservation(null); setSelectedCustomer(null); setShowResModal(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg active:scale-95"><Plus className="w-4 h-4" /> 新增</button>
             </div>
             <div className="p-3 md:p-8">
                <div className="grid grid-cols-7 gap-1 md:gap-3 mb-2 text-center">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-3">
                  {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="h-10 md:h-20"></div>)}
                  {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                    const dayRes = getReservationsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    return (
                      <button key={i} onClick={() => setSelectedDay(day)} className={`h-11 md:h-20 rounded-xl md:rounded-3xl border transition-all flex flex-col items-center justify-center p-1 relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl z-10' : isToday ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                        <span className={`text-sm md:text-xl font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{i + 1}</span>
                        {dayRes.length > 0 && <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-[#06C755]'}`}></div>}
                      </button>
                    );
                  })}
                </div>
             </div>
          </div>
          
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[400px] md:max-h-[700px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm"><LayoutList className="w-4 h-4 text-slate-400" /> 行程詳情</h3>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar text-sm">
              {selectedDay ? (
                getReservationsForDay(selectedDay).length > 0 ? (
                  getReservationsForDay(selectedDay).map(res => (
                    <div key={res.id} className={`p-4 rounded-2xl border-2 transition-all ${res.status === 'cancelled' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${res.status === 'cancelled' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-800'}`}>
                          {res.status === 'cancelled' ? '已取消' : (res.type === '其他' ? res.customTypeLabel : res.type)}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => handleOpenEditReservation(res)} className="p-1.5 bg-slate-100 rounded-lg text-slate-600"><Edit3 className="w-3 h-3"/></button>
                        </div>
                      </div>
                      <h4 className="font-black text-base text-slate-900">{res.customerName}</h4>
                      <div className="flex items-center gap-2 mt-1 text-slate-500">
                         <Clock className="w-3.5 h-3.5" />
                         <span className="text-xs font-bold font-mono">{new Date(res.dateTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit', hour12: false})}</span>
                      </div>
                    </div>
                  ))
                ) : <p className="text-center py-10 text-slate-300 font-bold italic">今日無行程</p>
              ) : <p className="text-center py-10 text-slate-300 font-bold italic">請選日期</p>}
            </div>
          </div>
        </div>
      )}

      {/* 通知日誌 */}
      {activeTab === 'automation' && (
        <div className="max-w-2xl mx-auto px-2 animate-slide-up">
           <div className="bg-white p-6 md:p-10 rounded-[40px] border border-slate-200 shadow-xl">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 flex items-center gap-3"><Activity className="w-8 h-8 text-[#06C755]" /> 通知傳送日誌</h3>
              <div className="space-y-3">
                 {webhookLogs.map((log, idx) => (
                   <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${log.status === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100 shadow-sm'}`}>
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="text-sm font-black text-slate-900 truncate">{log.client}</span>
                        </div>
                        <p className={`text-[11px] font-bold ${log.status === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>{log.message}</p>
                      </div>
                      <span className="text-[10px] font-mono font-black text-slate-400 whitespace-nowrap">{log.time}</span>
                   </div>
                 ))}
                 {webhookLogs.length === 0 && (
                   <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                     <p className="text-slate-400 font-bold italic">目前無紀錄</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* 客戶名單 - 新增「解除綁定」按鈕 */}
      {activeTab === 'customers' && (
        <div className="px-2 space-y-4 animate-slide-up">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="搜尋客戶..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-sm shadow-sm" />
            </div>
            <button onClick={() => setShowCustomerModal(true)} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus className="w-5 h-5" /> 新增客戶</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone || "").includes(searchTerm)).map(customer => (
              <div key={customer.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm border-2 border-white shadow-sm overflow-hidden">
                      {customer.linePictureUrl ? <img src={customer.linePictureUrl} className="w-full h-full object-cover" /> : (customer.name || "?").charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{customer.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">{customer.phone || '未留電話'}</p>
                    </div>
                  </div>
                  <button onClick={() => onConvertToProject?.(customer)} className="p-2 bg-slate-900 text-white rounded-lg active:scale-90 shadow-sm"><ExternalLink className="w-3.5 h-3.5" /></button>
                </div>
                
                {/* 狀態與解除綁定列 */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                   <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-full text-[9px] font-black flex items-center gap-1 ${customer.lineConnectionId ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                         {customer.lineConnectionId ? <Wifi className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                         {customer.lineConnectionId ? 'LINE 已連動' : '未連動'}
                      </div>
                   </div>
                   {customer.lineConnectionId && (
                     <button 
                        onClick={() => handleUnlinkUser(customer)}
                        className="text-[9px] font-black text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                     >
                        <Link2Off className="w-3 h-3" /> 解除連動
                     </button>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 連結池 */}
      {activeTab === 'inbox' && (
        <div className="max-w-2xl mx-auto px-2 animate-slide-up">
           <div className="bg-white p-6 md:p-10 rounded-[40px] border border-slate-200 shadow-xl">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3"><Inbox className="w-8 h-8 text-[#06C755]" /> LINE 待連結名單</h3>
              <div className="space-y-3">
                {lineInbox.map(item => (
                  <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      {item.linePictureUrl ? <img src={item.linePictureUrl} className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" /> : <div className="w-10 h-10 bg-slate-200 rounded-xl" />}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{item.lineDisplayName || "未知好友"}</h4>
                        <p className="text-[9px] text-slate-400 font-mono">{item.lineUserId.substring(0, 15)}...</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkingItem(item)} className="bg-[#06C755] text-white px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all shadow-md">綁定客戶</button>
                  </div>
                ))}
                {lineInbox.length === 0 && <p className="text-center py-16 text-slate-400 font-bold italic">連結池目前為空</p>}
              </div>
           </div>
        </div>
      )}

      {/* 預約建立彈窗 */}
      {showResModal && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-[40px] md:rounded-[40px] w-full max-w-lg p-6 md:p-10 shadow-2xl animate-slide-up border-x border-t border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg md:text-2xl font-black text-slate-900">{editingReservation ? '變更預約' : '安排行程'}</h3>
                <button onClick={() => { setShowResModal(false); setEditingReservation(null); setClientSearchTerm(''); }} className="p-2 bg-slate-100 rounded-full text-slate-400 active:bg-slate-200"><X className="w-6 h-6"/></button>
            </div>

            {(!editingReservation && !selectedCustomer) ? (
              <div className="space-y-4">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="搜尋姓名..." value={clientSearchTerm} onChange={e => setClientSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-900 text-sm" />
                 </div>
                 <div className="space-y-2 max-h-[250px] md:max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {customers.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())).map(c => (
                      <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 text-left bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl font-bold flex justify-between items-center group active:scale-[0.98] shadow-sm">
                        <span className="text-base">{c.name}</span>
                        <div className={`px-2 py-0.5 rounded-full text-[9px] flex items-center gap-1 ${c.lineConnectionId ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           {c.lineConnectionId ? 'LINE 已連動' : '無 LINE'}
                        </div>
                      </button>
                    ))}
                 </div>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in pb-8 md:pb-0">
                <div className={`p-4 rounded-2xl border flex items-center gap-4 ${editingReservation?.lineUserId || selectedCustomer?.lineConnectionId ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                       {editingReservation?.lineUserId || selectedCustomer?.lineConnectionId ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-orange-600" />}
                    </div>
                    <div>
                      <p className="text-base font-black leading-none text-slate-900">{editingReservation ? editingReservation.customerName : selectedCustomer?.name}</p>
                      <p className={`text-[9px] mt-1 font-bold ${editingReservation?.lineUserId || selectedCustomer?.lineConnectionId ? 'text-emerald-600' : 'text-orange-600'}`}>
                         {editingReservation?.lineUserId || selectedCustomer?.lineConnectionId ? `UID: ${(editingReservation?.lineUserId || selectedCustomer?.lineConnectionId || "").substring(0, 10)}...` : '※ 尚未連動 LINE，不會發送通知'}
                      </p>
                    </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {['諮詢', '丈量', '看圖', '簽約', '其他'].map(t => (
                    <button key={t} onClick={() => setResType(t as any)} className={`py-2 rounded-xl font-bold border-2 transition-all text-[10px] md:text-xs ${resType === t ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border-slate-100'}`}>{t}</button>
                  ))}
                </div>
                {resType === '其他' && (
                  <input type="text" value={customResLabel} onChange={e => setCustomResLabel(e.target.value)} placeholder="項目名稱" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-900 text-sm" />
                )}
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">日期與時間</label>
                   <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none focus:bg-white transition-all text-sm" />
                </div>
                <button onClick={handleAddReservation} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-3">
                    <Save className="w-5 h-5" />
                    {(selectedCustomer?.lineConnectionId || editingReservation?.lineUserId) ? '確認並傳送 LINE' : '建立預約 (無通知)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 綁定彈窗 */}
      {linkingItem && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900">執行綁定</h3>
                <button onClick={() => setLinkingItem(null)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl mb-6">
                 {linkingItem.linePictureUrl ? <img src={linkingItem.linePictureUrl} className="w-12 h-12 rounded-xl border-2 border-white shadow-sm" /> : <div className="w-12 h-12 bg-slate-200 rounded-xl" />}
                 <h4 className="font-bold text-black text-base">{linkingItem.lineDisplayName}</h4>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {customers.filter(c => !c.lineConnectionId).map(c => (
                   <button key={c.id} onClick={() => handleLinkUser(c)} className="w-full p-4 text-left bg-white hover:bg-[#06C755] hover:text-white rounded-2xl font-bold border border-slate-100 flex justify-between items-center group transition-all shadow-sm">
                      <span className="text-sm">{c.name}</span>
                      <ChevronRight className="w-4 h-4" />
                   </button>
                 ))}
                 {customers.filter(c => !c.lineConnectionId).length === 0 && <p className="text-center py-8 text-xs text-slate-400">沒有可綁定的新客戶</p>}
              </div>
           </div>
        </div>
      )}

      {/* 新增客戶彈窗 */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900">手動新增客戶</h3>
                <button onClick={() => setShowCustomerModal(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                 <input type="text" placeholder="客戶姓名" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                 <input type="text" placeholder="聯絡電話" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                 <textarea placeholder="地址/備註" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" rows={2} />
                 <button onClick={handleAddCustomer} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg">存入名單</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  async function handleAddCustomer() {
    if (!newCustName.trim()) return;
    const id = `cust-${Date.now()}`;
    await setDoc(doc(db, "customers", id), {
      id, name: newCustName, phone: newCustPhone, address: newCustAddress, createdAt: Date.now(), tags: []
    });
    setNewCustName(''); setNewCustPhone(''); setNewCustAddress('');
    setShowCustomerModal(false);
  }
};

export default CRMManager;
