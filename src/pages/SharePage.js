// src/pages/SharePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // 你的 Firebase instance
import { stationData } from '../data/stations'; // 引入捷運站資料以獲取站名和經緯度
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'; // LoadScript 在 App.js
import './SharePage.css'; // 引入樣式 (你可以創建這個檔案，或重用部分 HomePage.css)

const mapContainerStyle = {
  width: '100%',
  // 減去 header 的高度，你可以根據你的 header 實際高度調整
  height: 'calc(100vh - 70px)', // 假設 header 約 70px 高
};
const defaultZoom = 15; // 分享頁面可以稍微廣一點的視野
// const libraries = ["places"]; // 已在 App.js LoadScript 中定義

const SharePage = () => {
  const { shareId } = useParams(); // 從 URL 獲取 shareId
  const [sharedData, setSharedData] = useState(null); // 儲存從 Firestore 讀取的分享數據
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 地圖相關狀態
  const mapRef = useRef(null);
  // const [mapInstance, setMapInstance] = useState(null); // mapRef.current 即可
  const [activeInfoWindow, setActiveInfoWindow] = useState(null); // googlePlaceId of active InfoWindow
  const [clickedStoreForInfo, setClickedStoreForInfo] = useState(null); // Store object for InfoWindow

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // 雖然 LoadScript 在 App.js, 但檢查還是好的

  const onLoad = useCallback(map => { mapRef.current = map; /* setMapInstance(map); */ }, []);
  const onUnmount = useCallback(map => { mapRef.current = null; /* setMapInstance(null); */ }, []);

  useEffect(() => {
    if (!googleMapsApiKey) {
      console.error("Google Maps API Key is missing for SharePage.");
      // 可以考慮設定一個 error 狀態來提示用戶
    }
  }, [googleMapsApiKey]);

  // 根據 shareId 從 Firestore 獲取分享的數據
  useEffect(() => {
    if (shareId) {
      const fetchSharedData = async () => {
        setLoading(true);
        setError(null);
        try {
          const sharedDocRef = doc(db, 'publicSharedViews', shareId); // 從 publicSharedViews 集合讀取
          const docSnap = await getDoc(sharedDocRef);

          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            // 嘗試從 stationData (你的本地捷運站資料) 中找到對應的捷運站完整資訊 (包含 realCoords)
            const stationInfoFromLocal = stationData.find(s => s.id === data.originalStationId);
            setSharedData({ ...data, stationInfo: stationInfoFromLocal });
          } else {
            setError('找不到這個分享連結的內容，可能已被刪除或連結錯誤。');
          }
        } catch (err) {
          console.error("Error fetching shared data (single station):", err);
          setError('讀取分享內容時發生錯誤。');
        } finally {
          setLoading(false);
        }
      };
      fetchSharedData();
    } else {
      setError('無效的分享連結參數。');
      setLoading(false);
    }
  }, [shareId]);

  const handleMarkerClick = (store) => {
    setClickedStoreForInfo(store);
    setActiveInfoWindow(store.googlePlaceId);
    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }
  };
  
  const handleSidebarStoreClick = (store) => { // 當點擊側邊欄的店家
    handleMarkerClick(store); // 重用地圖標記點擊的邏輯
  };

  const handleCloseInfoWindow = () => {
    setActiveInfoWindow(null);
    setClickedStoreForInfo(null);
  };

  // 頁面渲染邏輯
  if (loading) {
    return <div className="share-page-status">讀取分享內容中...</div>;
  }
  if (error) {
    return <div className="share-page-status error">{error} <Link to="/" className="share-page-link">返回首頁</Link></div>;
  }
  if (!sharedData || !sharedData.stationInfo) { // 確保 sharedData 和 stationInfo 都存在
    const errorMessage = !sharedData ? '無法載入分享內容。' : `找不到捷運站 ${sharedData.originalStationName || sharedData.originalStationId} 的詳細地圖資訊。`;
    return <div className="share-page-status error">{errorMessage} <Link to="/" className="share-page-link">返回首頁</Link></div>;
  }

  const { originalUserName, originalStationName, stores, stationInfo } = sharedData;
  // 地圖中心點：優先使用分享數據中捷運站的 realCoords，如果沒有，則用列表第一個店家，再沒有則用預設
  const mapCenter = stationInfo.realCoords || 
                    (stores && stores.length > 0 ? { lat: stores[0].lat, lng: stores[0].lng } : 
                    { lat: 22.639065, lng: 120.302104 }); // 高雄市中心備用
  const mapOptions = { 
    clickableIcons: false, // 在分享頁面，不允許點擊地圖上的原生 POI
    disableDefaultUI: false, // 可以保留預設 UI (縮放、地圖類型等)
  };
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";


  return (
    <div className="share-page-container">
      <header className="share-page-header">
        <h1>{originalUserName || '一位使用者'} 分享的「{originalStationName || stationInfo.name}」最愛店家</h1>
        <Link to="/" className="back-to-home-button">{`返回${siteName}`}</Link>
      </header>

      <main className="share-page-content">
        {/* 左側邊欄顯示店家列表 */}
        <aside className="share-sidebar">
          <h2>店家列表 ({stores?.length || 0} 家)</h2>
          {stores && stores.length > 0 ? (
            <ul className="shared-stores-list">
              {stores.map((store, index) => (
                <li 
                  key={store.googlePlaceId || index} // 優先使用 googlePlaceId 作為 key
                  onClick={() => handleSidebarStoreClick(store)}
                  className={clickedStoreForInfo?.googlePlaceId === store.googlePlaceId ? 'active-shared-store' : ''}
                >
                  <strong>{store.name}</strong>
                  <p className="store-address-share">{store.address}</p>
                  {store.rating !== undefined && <p className="store-rating-share">評分: {store.rating}</p>}
                  {/* 可以顯示更多唯讀資訊，例如 mainPhotoUrl (如果有的話) */}
                  {/* {store.mainPhotoUrl && <img src={store.mainPhotoUrl} alt={store.name} style={{maxWidth: '100px', marginTop: '5px'}} />} */}
                </li>
              ))}
            </ul>
          ) : (
            <p>這個分享列表目前沒有店家。</p>
          )}
        </aside>

        {/* 右側顯示 Google 地圖 */}
        <div className="share-map-area-container">
          {googleMapsApiKey ? ( // 確保 API Key 存在才渲染地圖
            // LoadScript 已在 App.js，這裡直接用 GoogleMap
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
              // onClick={() => setActiveInfoWindow(null)} // 點擊地圖空白處關閉 InfoWindow
            >
              {/* 標記分享列表中的店家 */}
              {stores && stores.map(store => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }} // 使用黃色標記
                  onClick={() => handleMarkerClick(store)}
                />
              ))}

              {/* InfoWindow 顯示店家資訊 */}
              {clickedStoreForInfo && activeInfoWindow === clickedStoreForInfo.googlePlaceId && (
                <InfoWindow
                  key={clickedStoreForInfo.googlePlaceId} // 確保 InfoWindow 在切換店家時刷新
                  position={{ lat: clickedStoreForInfo.lat, lng: clickedStoreForInfo.lng }}
                  onCloseClick={handleCloseInfoWindow}
                >
                  <div className="place-infowindow-share">
                    <h4>{clickedStoreForInfo.name}</h4>
                    <p>{clickedStoreForInfo.address}</p>
                    {clickedStoreForInfo.rating !== undefined && <p>評分: {clickedStoreForInfo.rating} / 5</p>}
                    {/* "在 Google 地圖上查看" 連結 */}
                    {clickedStoreForInfo.googlePlaceId && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedStoreForInfo.name || '')}&query_place_id=${clickedStoreForInfo.googlePlaceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="google-maps-link-share"
                      >
                        在 Google 地圖上查看
                      </a>
                    )}
                    {/* 分享頁面不應有 "加入/移除最愛" 按鈕 */}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <p className="share-page-status error">無法載入地圖：Google Maps API 金鑰未設定。</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharePage;