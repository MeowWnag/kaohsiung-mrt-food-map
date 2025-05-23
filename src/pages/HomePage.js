// src/pages/HomePage.js
import React, { useState } from 'react';
import { signOut } from "firebase/auth";
import { auth } from '../firebase';
import { stationData, lineColors } from '../data/stations'; // 引入站點資料
import './HomePage.css'; // 我們將在這裡添加 CSS

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("使用者已登出");
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const handleStationClick = (station) => {
    console.log("點擊了站點:", station.name);
    // TODO: 之後這裡會觸發顯示該站點的 Google 地圖與附近店家列表
  };

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
        <button onClick={handleLogout} className="logout-button">登出</button>
      </header>

      <main className="main-content">
        {/* 左側/摺疊選單 - 暫時留空或簡單佔位 */}
        <aside className="sidebar">
          <h2>捷運站點</h2>
          <ul>
            {stationData.map(station => (
              <li key={station.id} onClick={() => handleStationClick(station)}>
                {station.name} ({station.id})
              </li>
            ))}
          </ul>
          {/* 之後會加入店家列表、個人清單管理 */}
        </aside>

        {/* 右側地圖區域 */}
        <div className="map-area-container">
          <div className="krtc-map-container">
            <img
              src="img/krtc-map.png" // 確保路徑正確
              alt="高雄捷運路線圖"
              className="krtc-map-image"
            />
            {stationData.map((station) => {
                // 決定邊框顏色 (和可能的文字顏色)
                const stationLineColor = lineColors[station.lines[0]] || '#555'; // 如果找不到線路顏色，用一個預設的深灰色

                return (
                    <button
                    key={station.id}
                    className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''}`}
                    style={{
                        left: station.coords.x,
                        top: station.coords.y,
                        backgroundColor: '#FFFFFF',     // 背景色固定為白色
                        borderColor: stationLineColor, // 動態設定邊框顏色
                        // color: stationLineColor,    // 可選：如果想讓 ID 文字也是線路顏色 (但通常深色文字在白底上更好)
                                                    // 如果不設定這個，文字顏色會由 CSS 控制
                    }}
                    onClick={() => handleStationClick(station)}
                    onMouseEnter={() => setHoveredStation(station.id)}
                    onMouseLeave={() => setHoveredStation(null)}
                    title={station.name} // 滑鼠移上去時顯示站名
                    >
                    {/* 使用你原來的 class name 或者我建議的，確保 CSS 匹配 */}
                    <span className="station-id-tooltip">{station.id}</span>
                    {/* 或者用我建議的: <span className="station-marker-id">{station.id}</span> */}
                    </button>
                );
                })}
          </div>
          {/* Google Map 會顯示在這裡，但現在先放路線圖 */}
        </div>
      </main>
    </div>
  );
};

export default HomePage;