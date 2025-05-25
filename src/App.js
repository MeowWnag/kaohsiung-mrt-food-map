// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './firebase'; // 你的 Firebase instance
import { LoadScript } from '@react-google-maps/api';

// 頁面組件
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SharePage from './pages/SharePage'; // 用於單站分享
import SharedMapViewerPage from './pages/SharedMapViewerPage'; // 用於全站地圖分享

import './App.css'; // 全局 App 樣式

// Google Maps API 設定
const libraries = ["places"]; // 需要的函式庫
const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // 從 .env 讀取

function App() {
  const [user, setUser] = useState(null); // 當前登入的使用者物件
  const [loading, setLoading] = useState(true); // 初始認證狀態載入

  useEffect(() => {
    // 監聽 Firebase Authentication 的狀態變化
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // 設定使用者物件 (可以是 null)
      setLoading(false);    // 完成初始載入
      if (currentUser) {
        console.log("App.js: User is signed in:", currentUser.uid);
      } else {
        console.log("App.js: User is signed out.");
      }
    });

    // 清理函數：當 App 元件卸載時，取消 Firebase 的監聽
    return () => unsubscribe();
  }, []); // 空依賴陣列，確保此 useEffect 只在元件掛載和卸載時執行一次

  // 如果 Google Maps API Key 未設定，顯示錯誤訊息，不繼續渲染
  if (!googleMapsApiKey) {
    return (
      <div className="app-error-container">
        <h1>應用程式錯誤</h1>
        <p>Google Maps API 金鑰未設定。請檢查您的 <code>.env</code> 檔案並重新啟動應用程式。</p>
        <p>如果您是開發者，請確保 <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> 環境變數已正確設定。</p>
      </div>
    );
  }
  
  // 在 Firebase 認證狀態確認完成之前，顯示載入中畫面
  if (loading) {
    return (
      <div className="app-loading-container">
        <p>應用程式載入中...</p>
        {/* 你可以在這裡放一個更美觀的 spinner 或動畫 */}
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={googleMapsApiKey}
      libraries={libraries}
      loadingElement={ // 當 Google Maps API 正在載入時顯示的元素
        <div className="app-loading-container">
          <p>地圖資源載入中...</p>
        </div>
      }
      onError={e => { // 處理 LoadScript 載入錯誤
        console.error("Google Maps API LoadScript Error:", e);
        // 你可以在這裡設置一個狀態來顯示一個全局的 API 載入錯誤訊息給用戶
      }}
    >
      <Router>
        <Routes>
          {/* 登入頁面路由 */}
          <Route
            path="/login"
            element={!user ? <LoginPage /> : <Navigate to="/" replace />}
          />

          {/* 主頁面路由 (HomePage) */}
          <Route
            path="/"
            element={user ? <HomePage user={user} /> : <Navigate to="/login" replace />}
          />

          {/* 單站分享頁面路由 (SharePage) */}
          <Route 
            path="/share/:shareId" 
            element={<SharePage />} 
          />

          {/* 全站地圖分享頁面路由 (SharedMapViewerPage) */}
          <Route 
            path="/sharemap/:shareId" 
            element={<SharedMapViewerPage />} 
          />
          
          {/* 萬用路由：如果路徑不匹配，根據登入狀態導向到主頁或登入頁 */}
          <Route 
            path="*" 
            element={<Navigate to={user ? "/" : "/login"} replace />} 
          />
        </Routes>
      </Router>
    </LoadScript>
  );
}

export default App;