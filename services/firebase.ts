
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot, query, orderBy, updateDoc, addDoc, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD9PObC6An5d6Zl41Y3bBRgXh0KyFUdx2I",
  authDomain: "zewu-a6e5d.firebaseapp.com",
  projectId: "zewu-a6e5d",
  storageBucket: "zewu-a6e5d.firebasestorage.app",
  messagingSenderId: "832889344248",
  appId: "1:832889344248:web:a8652243e91fc085112b0d",
  measurementId: "G-36LJQSCXCW"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// 定義集合路徑
export const usersCollection = collection(db, "users");
export const projectsCollection = collection(db, "projects");
export const lineConnectionsCollection = collection(db, "line_connections");
export const customersCollection = collection(db, "customers");
export const reservationsCollection = collection(db, "reservations");
export const lineMetricsCollection = collection(db, "line_metrics");
export const systemLogsCollection = collection(db, "system_logs");

// 通用圖片上傳函式
export const uploadImage = async (file: File, pathPrefix: string = 'project-covers'): Promise<string> => {
  try {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fullPath = `${pathPrefix}/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, fullPath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Image upload failed:", error);
    throw new Error("圖片上傳失敗");
  }
};

// 重新導出常用的 Firestore 函式
// Fix: Added getDocs and where to exports to resolve import errors in components/CRMManager.tsx
export { setDoc, doc, deleteDoc, onSnapshot, query, orderBy, collection, updateDoc, addDoc, getDocs, where };
