// src/firebase.js

// 從 Firebase SDK 匯入必要的函式
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 你的網頁應用的 Firebase 設定
// TODO: 請將以下物件替換成你從 Firebase 控制台複製的設定
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firebase Authentication 並匯出以供他處使用
export const auth = getAuth(app);

// 初始化 Cloud Firestore 並匯出以供他處使用
export const db = getFirestore(app);

// 你也可以選擇性地匯出 app 本身，如果其他地方需要
// export default app;