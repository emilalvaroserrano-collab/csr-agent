import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyAXEAwg0nLMl5cTD0td7t15HaCJ1nL0eH4",
  authDomain: "orbit-1cf1c.firebaseapp.com",
  databaseURL: "https://orbit-1cf1c-default-rtdb.firebaseio.com",
  projectId: "orbit-1cf1c",
  storageBucket: "orbit-1cf1c.firebasestorage.app",
  messagingSenderId: "737913630817",
  appId: "1:737913630817:web:5ee2c05e94b5b079f67a20",
  measurementId: "G-Q9KP8DLN00",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  ref,
  get,
  set,
  update,
  push,
  remove,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
};
