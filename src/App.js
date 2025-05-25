// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './firebase'; // 引入 auth
import { LoadScript } from '@react-google-maps/api';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import './App.css'; // 你可以保留或修改預設的 App.css

const libraries = ["places"];
const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

function App() {
  const [user, setUser] = useState(null); // 用來儲存登入的使用者資訊
  const [loading, setLoading] = useState(true); // 用來處理初始載入狀態

  useEffect(() => {
    // onAuthStateChanged 是一個監聽器，當使用者登入或登出時會觸發
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // 完成載入
      if (currentUser) {
        console.log("使用者已登入:", currentUser);
        // 可以在這裡將使用者 UID 儲存到 Firestore (如果需要，階段一還不用急著做)
      } else {
        console.log("使用者未登入或已登出");
      }
    });

    // 清理函數：當元件卸載時，取消監聽
    return () => unsubscribe();
  }, []); // 空依賴陣列，確保 useEffect 只在元件掛載和卸載時執行一次

  if (loading) {
    return <div>載入中...</div>; // 或是一個更美觀的載入指示器
  }

  return (
    <LoadScript
      googleMapsApiKey={googleMapsApiKey}
      libraries={libraries}
      loadingElement={<div>地圖載入中...</div>}
    >
      <Router>
        <Routes>
          <Route
            path="/login"
            element={!user ? <LoginPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={user ? <HomePage user={user} /> : <Navigate to="/login" replace />}
          />
          {/* 可以新增一個 404 頁面或其他路由 */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </Router>
    </LoadScript>
  );
}

export default App;