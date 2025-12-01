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

export { setDoc, doc, deleteDoc, onSnapshot, query, orderBy, collection, updateDoc, ref, uploadBytes, getDownloadURL };
