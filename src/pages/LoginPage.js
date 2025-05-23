// src/pages/LoginPage.js
import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from '../firebase'; // 引入我們設定好的 auth 實例

const LoginPage = () => {
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // 登入成功，result.user 包含了使用者資訊
      console.log("Google 登入成功:", result.user);
      // 這裡可以做一些後續處理，例如導向到主頁面
    } catch (error) {
      // 處理錯誤
      console.error("Google 登入失敗:", error);
      // 可以顯示錯誤訊息給使用者
    }
  };

  return (
    <div>
      <h1>高雄捷運美食地圖</h1>
      <p>請使用 Google 帳號登入</p>
      <button onClick={handleGoogleLogin}>
        使用 Google 登入
      </button>
    </div>
  );
};

export default LoginPage;