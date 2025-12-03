
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD9PObC6An5d6Zl41Y3bBRgXh0KyFUdx2I",
  authDomain: "zewu-a6e5d.firebaseapp.com",
  projectId: "zewu-a6e5d",
  storageBucket: "zewu-a6e5d.firebasestorage.app",
  messagingSenderId: "832889344248",
  appId: "1:832889344248:web:a8652243e91fc085112b0d",
  measurementId: "G-36LJQSCXCW"
};

// Initialize Firebase
// Check if firebase app is already initialized to avoid errors in development environments
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// Firestore Collection References
export const usersCollection = collection(db, "users");
export const projectsCollection = collection(db, "projects");
export const systemLogsCollection = collection(db, "system_logs");

/**
 * 通用圖片上傳函式
 * 包含錯誤處理與 Metadata 設定，解決手機瀏覽器相容性問題
 */
export const uploadImage = async (file: File, pathPrefix: string = 'project-covers'): Promise<string> => {
  try {
    // 1. 檔名消毒 (Sanitize)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fullPath = `${pathPrefix}/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, fullPath);

    // 2. 設定 Metadata (重要：解決部分手機瀏覽器缺少 content-type 的問題)
    const metadata = {
      contentType: file.type,
      customMetadata: {
        'uploadedBy': 'ZewuSystem'
      }
    };

    // 3. 上傳
    console.log(`Starting upload to ${fullPath}...`);
    const snapshot = await uploadBytes(storageRef, file, metadata);
    console.log('Upload successful, getting URL...');

    // 4. 取得網址
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (error: any) {
    console.error("Firebase Storage Upload Error:", error);
    
    // 分析錯誤代碼
    if (error.code === 'storage/unauthorized') {
      throw new Error("權限不足：請檢查 Firebase Storage Rules 是否已開啟 'allow read, write: if true;'");
    } else if (error.code === 'storage/canceled') {
      throw new Error("上傳遭取消");
    } else if (error.code === 'storage/unknown') {
      throw new Error("發生未知錯誤，請檢查網路連線");
    }
    
    throw new Error("圖片上傳失敗，請稍後再試");
  }
};

export { setDoc, doc, deleteDoc, onSnapshot, query, orderBy, collection, updateDoc, ref, uploadBytes, getDownloadURL };
