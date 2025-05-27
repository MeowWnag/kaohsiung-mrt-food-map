// src/pages/LoginPage.js
import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from '../firebase'; // 引入我們設定好的 auth 實例
import './LoginPage.css'; // 引入 LoginPage 的專屬 CSS

// Google Icon SVG 可以作為一個小組件或直接嵌入
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Google 登入成功:", result.user);
      // 登入成功後的導向由 App.js 中的 onAuthStateChanged 處理
    } catch (error) {
      console.error("Google 登入失敗:", error);
      setError(`登入失敗: ${error.message}`); // 顯示錯誤給使用者
      setIsLoading(false);
    }
    // 不需要手動 setIsLoading(false) 如果成功，因為頁面會跳轉
    // 但如果希望停在登入頁顯示成功訊息（不推薦），則需要
  };

  return (
    // body 的樣式需要在全域 CSS (如 index.css 或 App.css) 中設定
    // <body class="min-h-screen flex items-center justify-center p-4">
    // 通常 React App 的根 div (#root) 會是 body 的直接子元素，可以把這些 class 加到 #root 或一個 wrapper div
    <div className="min-h-screen flex items-center justify-center p-4 bg-page-background"> {/* bg-page-background 來自 LoginPage.css */}
      <div className="login-container w-full max-w-md rounded-2xl overflow-hidden">
        <div className="p-6 text-white text-center login-header-gradient"> {/* login-header-gradient 來自 LoginPage.css */}
          <div className="flex justify-center mb-3">
            <div className="food-icon text-5xl">🍜</div>
            <div className="food-icon text-5xl ml-4" style={{ animationDelay: '0.5s' }}>🍣</div>
            <div className="food-icon text-5xl ml-4" style={{ animationDelay: '1s' }}>☕</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">高雄捷運美食地圖</h1>
          <p className="text-lg opacity-90">探索捷運沿線的美食寶藏</p>
          <div className="mrt-line mt-4 mx-auto w-3/4"></div>
        </div>

        <div className="login-form p-8 rounded-t-3xl bg-white"> {/* 移除了 Tailwind 的 shadow，用 CSS class 控制 */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-medium text-gray-800">歡迎使用美食地圖</h2>
            <p className="text-gray-600 mt-2">請登入以獲得完整體驗</p>
          </div>

          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

          <button
            id="googleLoginBtn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="google-btn flex items-center justify-center w-full bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <GoogleIcon />
            )}
            {isLoading ? '登入中...' : '使用 Google 帳號登入'}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              登入即表示您同意我們的
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">服務條款</a>與
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">隱私政策</a>
            </p>
            {/* 你需要實際創建 /terms 和 /privacy 頁面或連結 */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;