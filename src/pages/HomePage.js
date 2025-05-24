// src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth } from '../firebase';
import { stationData, lineColors } from '../data/stations'; // 引入站點資料
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api'; // 引入 Google Maps 元件
import './HomePage.css';

// Google Map 容器的樣式
const mapContainerStyle = {
  width: '100%',
  height: '100%', // 讓地圖填滿其父容器 (.map-area-container)
};

// 預設地圖縮放級別
const defaultZoom = 16;

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null); // 新增：儲存被選中的站點
  const [mapViewActive, setMapViewActive] = useState(false); // 新增：控制顯示路線圖還是 Google Map

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!googleMapsApiKey) {
      console.error("Google Maps API Key is missing. Please check your .env file.");
    }
  }, [googleMapsApiKey]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("使用者已登出");
      // App.js 中的 onAuthStateChanged 會處理導向
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const handleStationClick = (station) => {
    console.log("點擊了站點:", station.name, station.realCoords);
    if (station.realCoords) {
      setSelectedStation(station);
      setMapViewActive(true); // 切換到 Google Map 視圖
    } else {
      console.warn(`站點 ${station.name} 缺少 realCoords (經緯度) 資料，無法顯示地圖。`);
      // 可以選擇是否依然切換視圖但顯示一個提示，或不切換
      // setMapViewActive(true); // 如果即使沒有經緯度也想切換到空白地圖區域
    }
  };

  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null); // 可選：清除選中的站點
  };

  // 地圖中心點，如果沒有選中站點，可以設一個預設值 (例如高雄市中心)
  // 但在這個邏輯中，我們只在 selectedStation 存在時顯示地圖
  const mapCenter = selectedStation?.realCoords || { lat: 22.639065, lng: 120.302104 }; // 高雄市中心備用

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        {mapViewActive && ( // 只有在 Google Map 視圖時才顯示返回按鈕
          <button onClick={handleBackToRouteMap} className="back-button">
            返回路線圖
          </button>
        )}
        <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
        <button onClick={handleLogout} className="logout-button">登出</button>
      </header>

      <main className="main-content">
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

        <div className="map-area-container">
          {!mapViewActive ? (
            // 顯示捷運路線圖
            <div className="krtc-map-container">
              <img
                src="img/krtc-map.png"
                alt="高雄捷運路線圖"
                className="krtc-map-image"
              />
              {stationData.map((station) => {
                const stationLineColor = lineColors[station.lines[0]] || '#555';
                return (
                  <button
                    key={station.id}
                    className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''}`}
                    style={{
                      left: station.coords.x,
                      top: station.coords.y,
                      backgroundColor: '#FFFFFF',
                      borderColor: stationLineColor,
                    }}
                    onClick={() => handleStationClick(station)}
                    onMouseEnter={() => setHoveredStation(station.id)}
                    onMouseLeave={() => setHoveredStation(null)}
                    title={station.name}
                  >
                    <span className="station-id-tooltip">{station.id}</span>
                  </button>
                );
              })}
            </div>
          ) : googleMapsApiKey && selectedStation?.realCoords ? (
            // 顯示 Google 地圖
            <LoadScript googleMapsApiKey={googleMapsApiKey} loadingElement={<div>地圖載入中...</div>}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={selectedStation.realCoords} // 使用選中站點的經緯度
                zoom={defaultZoom}
              >
                {/* 在選中的站點位置放置一個標記 */}
                <Marker position={selectedStation.realCoords} title={selectedStation.name} />
                {/* 之後可以根據店家資料在這裡添加更多 Marker */}
              </GoogleMap>
            </LoadScript>
          ) : (
            // 如果 API Key 不存在或選中站點沒有經緯度，顯示提示
            <div>
              { !googleMapsApiKey && <p>Google Maps API 金鑰未設定或無效。</p> }
              { mapViewActive && !selectedStation?.realCoords && <p>此站點缺少經緯度資訊，無法顯示地圖。</p> }
              { mapViewActive && !selectedStation && <p>請先選擇一個捷運站。</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;