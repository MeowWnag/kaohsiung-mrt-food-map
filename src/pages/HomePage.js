// src/pages/HomePage.js
import React from 'react';
import { signOut } from "firebase/auth";
import { auth } from '../firebase'; // 引入 auth

const HomePage = ({ user }) => { // 假設我們會傳入 user 物件
  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("使用者已登出");
      // 登出後通常會導向回登入頁面
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  return (
    <div>
      <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
      <p>這裡是高雄捷運美食地圖主頁。</p>
      {/* 之後會在這裡放地圖和店家列表 */}
      <button onClick={handleLogout}>登出</button>
    </div>
  );
};

export default HomePage;