
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
    
    // 監聽連結池 (只要 isBound 不為 true 就顯示)
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
          lineUserId: res.lineUserId || "TEST_USER",
          clientName: res.customerName || "測試人員",
          appointmentTime: res.dateTime ? new Date(res.dateTime).toLocaleString('zh-TW') : "2024-01-01 12:00",
          serviceName: serviceName,
          status: res.status || 'pending',
          isUpdate: isUpdate,
          source: "澤物系統系統"
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
    const success = await triggerMakeWebhook({ type: '測試', customerName: currentUser.name });
    if (success) alert("測試 Webhook 已成功發送！");
    else alert("發送失敗，請檢查網路或 Webhook 設定。");
    setIsSendingTest(false);
  };

  const handleAddCustomer = async () => {
    if (!newCustName.trim()) { alert("請輸入姓名"); return; }
    const customerId = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      id: customerId,
      name: newCustName,
      phone: newCustPhone,
      address: newCustAddress,
      tags: newCustTags.split(',').map(t => t.trim()).filter(t => t),
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, "customers", customerId), newCustomer);
      setShowCustomerModal(false);
      setNewCustName(''); setNewCustPhone(''); setNewCustAddress(''); setNewCustTags('');
    } catch (e) { alert("儲存失敗"); }
  };

  const handleOpenEditReservation = (res: Reservation) => {
    setEditingReservation(res);
    setResDate(res.dateTime);
    setResType(res.type);
    setCustomResLabel(res.customTypeLabel || '');
    setShowResModal(true);
  };

  const handleCancelReservation = async (res: Reservation) => {
    if (!window.confirm("確定要取消此預約嗎？")) return;
    try {
      await updateDoc(doc(db, "reservations", res.id), { status: 'cancelled' });
      alert("預約已取消");
    } catch (e) { alert("操作失敗"); }
  };

  const handleAddReservation = async () => {
    const isUpdate = !!editingReservation;
    const targetCustomer = editingReservation 
      ? customers.find(c => c.id === editingReservation.customerId) 
      : selectedCustomer;

    if (!targetCustomer || !resDate) { alert("請完整填寫資訊"); return; }
    
    const resId = isUpdate ? editingReservation!.id : `res-${Date.now()}`;
    const newRes: Reservation = {
      id: resId,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
      lineUserId: targetCustomer.lineConnectionId || null,
      dateTime: resDate,
      type: resType,
      customTypeLabel: resType === '其他' ? customResLabel : undefined,
      status: 'pending',
      immediateNotified: false,
      reminded: false,
      createdAt: isUpdate ? editingReservation!.createdAt : Date.now()
    };

    try {
      await setDoc(doc(db, "reservations", resId), newRes);
      if (newRes.lineUserId) {
        const success = await triggerMakeWebhook(newRes, isUpdate);
        if (success) await updateDoc(doc(db, "reservations", resId), { immediateNotified: true });
      }
      alert(isUpdate ? "預約時間已更新並通知客戶！" : "預約已建立！");
      setShowResModal(false);
      setEditingReservation(null);
      setSelectedCustomer(null);
      setResDate('');
      setClientSearchTerm('');
    } catch (e) { alert("儲存失敗"); }
  };

  const handleManualNotify = async (res: Reservation) => {
    if (!res.lineUserId) return;
    setIsNotifying(res.id);
    const success = await triggerMakeWebhook(res);
    if (success) {
      await updateDoc(doc(db, "reservations", res.id), { immediateNotified: true });
      alert("通知已發送");
    } else alert("發送失敗");
    setIsNotifying(null);
  };

  const handleLinkUser = async (customer: Customer) => {
    if (!linkingItem) return;
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        lineConnectionId: linkingItem.lineUserId,
        lineDisplayName: linkingItem.lineDisplayName,
        linePictureUrl: linkingItem.linePictureUrl || ""
      });
      await updateDoc(doc(db, "line_connections", linkingItem.id), { isBound: true });
      setLinkingItem(null);
      alert("綁定成功");
    } catch (e) { alert("失敗"); }
  };

  const filteredCustomers = (customers || []).filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || "").includes(searchTerm) ||
    (c.address || "").includes(searchTerm)
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
      {/* 導航標籤 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#06C755]" />
            預約管理中心
          </h2>
          <p className="text-slate-500 text-sm mt-1">追蹤案場排程與自動化通知</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <button onClick={() => setActiveTab('reservations')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'reservations' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><CalendarIcon className="w-4 h-4" /> 預約日曆</button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'customers' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Users className="w-4 h-4" /> 客戶名單</button>
          <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            <Inbox className="w-4 h-4" /> 連結池
            {lineInbox.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{lineInbox.length}</span>}
          </button>
          <button onClick={() => setActiveTab('automation')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'automation' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Bot className="w-4 h-4" /> 自動化</button>
        </div>
      </div>

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black text-slate-800">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h3>
                  <div className="flex gap-1">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                  </div>
                </div>
                <button onClick={() => { setEditingReservation(null); setSelectedCustomer(null); setShowResModal(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-slate-700 transition-all active:scale-95"><Plus className="w-4 h-4" /> 新增預約</button>
             </div>
             <div className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="text-xs font-bold text-slate-400 uppercase">{d}</div>
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
                      <button key={i} onClick={() => setSelectedDay(day)} className={`h-16 sm:h-20 rounded-2xl border transition-all flex flex-col items-center justify-center p-2 relative group ${isSelected ? 'bg-slate-800 border-slate-800 text-white shadow-xl scale-105 z-10' : isToday ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        {/* 修正：日曆數字改為 text-slate-900 確保清晰 */}
                        <span className={`text-base font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{i + 1}</span>
                        {dayRes.length > 0 && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#06C755]'}`}></div>}
                        {isToday && !isSelected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500"></div>}
                      </button>
                    );
                  })}
                </div>
             </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-fit max-h-[600px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><LayoutList className="w-5 h-5 text-slate-400" /> 本日行程</h3>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {selectedDay ? (
                getReservationsForDay(selectedDay).length > 0 ? (
                  getReservationsForDay(selectedDay).map(res => (
                    <div key={res.id} className={`p-4 rounded-2xl border transition-all relative group ${res.status === 'cancelled' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:shadow-md'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${res.status === 'cancelled' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                          {res.status === 'cancelled' ? '已取消' : (res.type === '其他' ? res.customTypeLabel : res.type)}
                        </span>
                        {res.status !== 'cancelled' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                             <button onClick={() => handleOpenEditReservation(res)} className="p-1 text-slate-400 hover:text-slate-800"><Edit3 className="w-4 h-4"/></button>
                             <button onClick={() => handleCancelReservation(res)} className="p-1 text-slate-400 hover:text-red-500"><CalendarX className="w-4 h-4"/></button>
                          </div>
                        )}
                      </div>
                      <h4 className={`font-black ${res.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-900 text-lg'}`}>{res.customerName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <Clock className={`w-3.5 h-3.5 ${res.status === 'cancelled' ? 'text-slate-300' : 'text-slate-600'}`} />
                         {/* 修正：行程時間改為純黑確保可視 */}
                         <span className={`text-xs font-black font-mono ${res.status === 'cancelled' ? 'text-slate-300' : 'text-slate-900'}`}>
                            {new Date(res.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
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
        <div className="space-y-4 animate-slide-up">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="搜尋姓名、電話、地址..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-800/5 transition-all font-bold text-slate-900" />
            </div>
            <button onClick={() => setShowCustomerModal(true)} className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-slate-700 transition-all active:scale-95"><UserPlus className="w-5 h-5" /> 新增客戶</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white p-6 rounded-[32px] border border-slate-200 hover:shadow-xl transition-all group relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xl border border-slate-200">
                      {customer.linePictureUrl ? <img src={customer.linePictureUrl} className="w-full h-full object-cover rounded-2xl" /> : (customer.name || "?").charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">{customer.name}</h4>
                      <p className="text-sm text-slate-500 font-mono">{customer.phone || '未留電話'}</p>
                    </div>
                  </div>
                  <button onClick={async () => { if(window.confirm("刪除此客戶？")) await deleteDoc(doc(db, "customers", customer.id)); }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-5 h-5" /></button>
                </div>
                {customer.address && (
                  <div className="mb-4 flex items-start gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-700 font-bold line-clamp-2">{customer.address}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className={`flex-1 py-2.5 rounded-xl text-center text-[10px] font-black flex items-center justify-center gap-1 border ${customer.lineConnectionId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {customer.lineConnectionId ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    {customer.lineConnectionId ? 'LINE 已綁定' : '未連結 LINE'}
                  </div>
                  <button onClick={() => onConvertToProject?.(customer)} className="px-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-lg flex items-center justify-center gap-2 text-xs font-bold active:scale-95"><ExternalLink className="w-4 h-4" /> 轉換案場</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 連結池 */}
      {activeTab === 'inbox' && (
        <div className="max-w-2xl mx-auto animate-slide-up">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl">
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Inbox className="w-8 h-8 text-[#06C755]" /> LINE 連結池 (未綁定客戶)</h3>
              <div className="space-y-4">
                {lineInbox.map(item => (
                  <div key={item.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-white transition-all">
                    <div className="flex items-center gap-4">
                      {item.linePictureUrl ? (
                         <img src={item.linePictureUrl} className="w-16 h-16 rounded-2xl border bg-white shadow-sm" />
                      ) : (
                         <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center"><MessageSquare className="w-8 h-8 text-slate-400" /></div>
                      )}
                      <div>
                        <h4 className="font-black text-slate-900 text-lg">{item.lineDisplayName}</h4>
                        {item.lastMessage && <p className="text-xs text-slate-400 line-clamp-1">{item.lastMessage}</p>}
                      </div>
                    </div>
                    <button onClick={() => setLinkingItem(item)} className="bg-[#06C755] text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-green-600 transition-all active:scale-95"><LinkIcon className="w-4 h-4" /> 綁定客戶</button>
                  </div>
                ))}
                {lineInbox.length === 0 && (
                  <div className="text-center py-20">
                    <Bot className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold italic">目前無待連結的 LINE 客戶資料</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 自動化與測試按鈕 */}
      {activeTab === 'automation' && (
        <div className="max-w-3xl mx-auto animate-slide-up">
           <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl relative overflow-hidden">
              <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3"><Bot className="w-10 h-10 text-[#06C755]" /> 自動化流程測試</h3>
              <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 mb-8">
                 <div className="flex items-center gap-2 font-black text-slate-900 mb-4 text-xl"><Wifi className="w-6 h-6 text-emerald-600" /> Webhook 通訊測試</div>
                 <p className="text-base text-slate-700 mb-8 font-bold leading-relaxed">
                   點擊下方按鈕測試系統與 Make.com 的連接狀況。這將發送一筆測試資料，您可以在 LINE Notify 或 Make 管理後台確認。
                 </p>
                 <button 
                  onClick={handleTestNotification} 
                  disabled={isSendingTest}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-5 rounded-2xl font-black flex items-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                 >
                    {isSendingTest ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    發送測試資料到 Webhook
                 </button>
              </div>
              
              <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl">
                 <h4 className="font-black mb-6 flex items-center gap-2 text-[#06C755] text-lg">系統整合資訊</h4>
                 <div className="space-y-4 font-mono text-sm">
                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400">Endpoint:</span> <span className="text-emerald-400 truncate ml-4">{MAKE_IMMEDIATE_WEBHOOK_URL}</span></div>
                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400">Auth Method:</span> <span className="text-white">API Key Header (Internal)</span></div>
                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400">Last Sync:</span> <span className="text-white">{new Date().toLocaleTimeString()}</span></div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- Modals --- */}
      
      {/* 預約建立視窗 (文字對比修正) */}
      {showResModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-900">{editingReservation ? '變更預約時間' : '建立預約行程'}</h3>
                <button onClick={() => { setShowResModal(false); setEditingReservation(null); setClientSearchTerm(''); }} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"><X className="w-6 h-6"/></button>
            </div>

            {(!editingReservation && !selectedCustomer) ? (
              <div className="space-y-4">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="輸入姓名快速搜尋..." 
                      value={clientSearchTerm}
                      onChange={e => setClientSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all font-black text-slate-900"
                    />
                 </div>
                 {/* 客戶選擇格子修正為 text-slate-900 高對比 */}
                 <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {modalFilteredClients.map(c => (
                      <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-5 text-left bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 transition-all flex items-center justify-between group">
                        {c.name} 
                        <span className="text-slate-500 font-bold text-sm">{c.phone || ''}</span>
                      </button>
                    ))}
                    {modalFilteredClients.length === 0 && <p className="text-center py-10 text-slate-400 font-bold italic">找不到該客戶資料</p>}
                 </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 font-black text-emerald-900 flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-emerald-600" />
                    已選取：{editingReservation ? editingReservation.customerName : selectedCustomer?.name}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['諮詢', '丈量', '看圖', '簽約', '其他'].map(t => (
                    <button key={t} onClick={() => setResType(t as any)} className={`py-4 rounded-xl font-black border transition-all text-sm ${resType === t ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>{t}</button>
                  ))}
                </div>

                {resType === '其他' && (
                  <div className="animate-fade-in">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">自定義項目名稱</label>
                    <input type="text" value={customResLabel} onChange={e => setCustomResLabel(e.target.value)} placeholder="例如：工地驗收" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white transition-all font-black text-slate-900" />
                  </div>
                )}

                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">預約日期時間</label>
                    <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full p-5 border border-slate-200 bg-slate-50 rounded-2xl font-black text-slate-900 outline-none focus:bg-white transition-all" />
                </div>

                <button onClick={handleAddReservation} className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 text-lg">
                    {editingReservation ? '確認變更並通知' : '建立預約並發送 LINE'}
                </button>
                {!editingReservation && (
                   <button onClick={() => { setSelectedCustomer(null); setClientSearchTerm(''); }} className="w-full text-slate-400 font-bold text-sm hover:text-slate-700">重新選取客戶</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 綁定視窗 (文字修正) */}
      {linkingItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black text-slate-900">綁定 LINE 客戶</h3><button onClick={() => setLinkingItem(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></button></div>
              <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-3xl border border-emerald-100 mb-6">
                 {linkingItem.linePictureUrl ? <img src={linkingItem.linePictureUrl} className="w-16 h-16 rounded-2xl border border-white shadow-sm" /> : <div className="w-16 h-16 bg-slate-200 rounded-2xl" />}
                 <div><p className="text-[10px] font-black text-emerald-600 mb-1">正在綁定 LINE 帳號</p><h4 className="font-black text-slate-900 text-lg">{linkingItem.lineDisplayName}</h4></div>
              </div>
              <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest ml-1">選擇要與此帳號綁定的現有客戶：</p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                 {customers.filter(c => !c.lineConnectionId).map(c => (
                   <button key={c.id} onClick={() => handleLinkUser(c)} className="w-full p-5 text-left bg-slate-50 hover:bg-[#06C755] hover:text-white rounded-2xl font-black text-slate-900 transition-all border border-slate-100 flex justify-between items-center group">{c.name} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" /></button>
                 ))}
                 {customers.filter(c => !c.lineConnectionId).length === 0 && <p className="text-center py-10 text-slate-400 italic">無尚未綁定的客戶資料</p>}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default CRMManager;
