// src/pages/SharedMapViewerPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { stationData, lineColors } from '../data/stations'; // 確保路徑正確
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'; // LoadScript 已在 App.js
import './HomePage.css'; // << 我們可以重用 HomePage.css 的大部分樣式

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultZoom = 16; // 或者可以根據情況調整
// const libraries = ["places"]; // 已在 App.js

const SharedMapViewerPage = () => {
  const { shareId } = useParams();
  const [sharedFullMapData, setSharedFullMapData] = useState(null); // 儲存全站分享數據
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI 狀態，與 HomePage 類似
  const [hoveredStation, setHoveredStation] = useState(null); // 用於路線圖
  const [selectedStation, setSelectedStation] = useState(null); // 查看者選擇的捷運站
  const [mapViewActive, setMapViewActive] = useState(false);    // 初始可以為 false (顯示路線圖)
  const [displayedFavoriteStores, setDisplayedFavoriteStores] = useState([]); // 當前選中站點的收藏 (從分享數據中來)
  const [clickedPlace, setClickedPlace] = useState(null);         // InfoWindow 的店家資訊
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);   // 控制 InfoWindow

  const mapRef = useRef(null);
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const onLoad = useCallback(map => { mapRef.current = map; }, []);
  const onUnmount = useCallback(map => { mapRef.current = null; }, []);

  useEffect(() => {
    if (!googleMapsApiKey && mapViewActive) {
      console.error("Google Maps API Key is missing for SharedMapViewerPage.");
    }
  }, [googleMapsApiKey, mapViewActive]);

  // 根據 shareId 獲取全站分享數據
  useEffect(() => {
    if (shareId) {
      const fetchSharedFullMapData = async () => {
        setLoading(true);
        setError(null);
        try {
          const sharedDocRef = doc(db, 'publicSharedFullMaps', shareId);
          const docSnap = await getDoc(sharedDocRef);

          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setSharedFullMapData(data);
            // 初始可以不選中任何站點，讓用戶從路線圖開始，或預選第一個有收藏的站
            const allFavs = data.allStationsFavorites || {};
            const firstStationIdWithData = Object.keys(allFavs).find(stationId => allFavs[stationId] && allFavs[stationId].length > 0);
            
            if (firstStationIdWithData) {
                const initialStation = stationData.find(s => s.id === firstStationIdWithData);
                if (initialStation) {
                    // 可以在這裡延遲一點再自動選中，或者讓使用者自己點
                    // handleStationClick(initialStation); // 可選：自動跳轉到第一個有數據的站
                }
            }
            setMapViewActive(false); // 初始顯示路線圖

          } else {
            setError('找不到這個分享的地圖，可能連結已失效或錯誤。');
          }
        } catch (err) {
          console.error("Error fetching shared full map data:", err);
          setError('讀取分享的地圖時發生錯誤。');
        } finally {
          setLoading(false);
        }
      };
      fetchSharedFullMapData();
    } else {
      setError('無效的分享連結參數。');
      setLoading(false);
    }
  }, [shareId]);

  // 當 selectedStation 改變時，從 sharedFullMapData 更新 displayedFavoriteStores
  useEffect(() => {
    if (selectedStation && sharedFullMapData && sharedFullMapData.allStationsFavorites) {
      setDisplayedFavoriteStores(sharedFullMapData.allStationsFavorites[selectedStation.id] || []);
    } else {
      setDisplayedFavoriteStores([]);
    }
  }, [selectedStation, sharedFullMapData]);

  // 處理捷運站點擊 (與 HomePage 邏輯相同，但數據源不同)
  const handleStationClick = (station) => {
    if (station.realCoords) {
      setSelectedStation(station);
      setMapViewActive(true); // 切換到地圖視圖
      setClickedPlace(null);
      setActiveInfoWindow(null);
    } else {
      console.warn(`(Shared View) 站點 ${station.name} 缺少 realCoords 資料。`);
    }
  };

  // 返回路線圖總覽 (在分享頁面內)
  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null);
    setClickedPlace(null);
    setActiveInfoWindow(null);
  };

  // POI 點擊 (在分享頁面，主要用於關閉 InfoWindow)
  const handleMapPoiClick = (event) => {
    console.log("Map clicked in shared view.", event.latLng?.toJSON());
    setActiveInfoWindow(null); // 點擊地圖其他地方關閉 InfoWindow
  };

  // 點擊已收藏的店家 Marker 或側邊欄列表項
  const handleSharedStoreClick = (store) => {
    setClickedPlace(store);
    setActiveInfoWindow(store.googlePlaceId);
    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }
  };

  const handleClosePlaceInfo = () => {
    setActiveInfoWindow(null);
  };

  if (loading) return <div className="share-page-status">讀取分享地圖中...</div>;
  if (error) return <div className="share-page-status error">{error} <Link to="/" className="share-page-link">返回首頁</Link></div>;
  if (!sharedFullMapData) return <div className="share-page-status">無法載入分享地圖。 <Link to="/" className="share-page-link">返回首頁</Link></div>;

  const { originalUserName, allStationsFavorites } = sharedFullMapData;
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";
  
  // 地圖中心點邏輯：如果選中了站點，用該站點；否則用第一個捷運站或預設
  const mapCenter = selectedStation?.realCoords || 
                    (stationData.length > 0 && stationData[0].realCoords) || 
                    { lat: 22.639065, lng: 120.302104 };
  const mapOptions = { clickableIcons: false, disableDefaultUI: false };


  return (
    <div className="homepage-container"> {/* 重用 HomePage 的 class */}
      <header className="homepage-header">
        {mapViewActive && ( // 如果在地圖視圖，顯示返回路線圖按鈕
          <button onClick={handleBackToRouteMap} className="back-button">
            返回分享路線圖
          </button>
        )}
        <h1>{originalUserName || '一位使用者'} 分享的高雄捷運美食地圖</h1>
        <div>
          <Link to="/" className="back-to-home-button" style={{textDecoration: 'none'}}>{`返回${siteName}`}</Link>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <h2>捷運站點</h2>
          <ul>
            {stationData.map(station => {
              const favoritesCount = (allStationsFavorites && allStationsFavorites[station.id]?.length) || 0;
              return (
                <li 
                  key={station.id} 
                  onClick={() => handleStationClick(station)}
                  className={`${selectedStation?.id === station.id ? 'active-station' : ''} ${favoritesCount > 0 ? 'has-shared-favorites-indicator' : ''}`}
                  title={favoritesCount > 0 ? `有 ${favoritesCount} 個分享收藏` : ''}
                >
                  {station.name} ({station.id})
                  {favoritesCount > 0 && <span className="favorites-count-badge">{favoritesCount}</span>}
                </li>
              );
            })}
          </ul>
          <hr />

          {selectedStation && allStationsFavorites ? (
            <>
              <h2>{selectedStation.name} 的分享收藏 ({displayedFavoriteStores.length})</h2>
              {displayedFavoriteStores.length > 0 ? (
                <ul className="favorite-stores-list">
                  {displayedFavoriteStores.map(store => (
                    <li key={store.googlePlaceId} onClick={() => handleSharedStoreClick(store)}>
                      <span className="store-name">{store.name}</span>
                      {/* 不顯示移除按鈕 */}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>此捷運站沒有分享的收藏店家。</p>
              )}
            </>
          ) : mapViewActive ? ( // 如果在地圖模式但未選中站（例如直接通過URL進來但初始站無數據）
             <p>請從左側列表選擇一個捷運站來查看分享的收藏。</p>
          ) : ( // 路線圖模式
            <p>點選捷運站以查看該站點分享的收藏店家。</p>
          )}
          <hr />
          
          {/* 店家詳細資訊 (側邊欄，唯讀) */}
          {mapViewActive && clickedPlace && selectedStation && (
            <div className="place-details-sidebar">
              <h3>{clickedPlace.name}</h3>
              <p>地址: {clickedPlace.address}</p>
              {clickedPlace.rating !== undefined && (
                <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 0} 則評論)</p>
              )}
              {/* 可以從 clickedPlace (來自 allStationsFavorites) 中獲取已儲存的 openingHoursText */}
              {clickedPlace.openingHoursText && Array.isArray(clickedPlace.openingHoursText) && (
                <div>
                  <p>營業時間:</p>
                  <ul style={{fontSize: '0.8em', paddingLeft: '15px', marginTop: '5px'}}>
                    {clickedPlace.openingHoursText.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={handleClosePlaceInfo} style={{ marginTop: '10px', marginLeft: '5px' }}>
                關閉資訊
              </button>
            </div>
          )}
        </aside>

        <div className="map-area-container">
          {!mapViewActive ? ( // 顯示路線圖
            <div className="krtc-map-container">
              <img src="/img/krtc-map.png" alt="高雄捷運路線圖" className="krtc-map-image"/>
              {stationData.map((station) => {
                const stationLineColor = lineColors[station.lines[0]] || '#555';
                const hasFavorites = allStationsFavorites && allStationsFavorites[station.id] && allStationsFavorites[station.id].length > 0;
                return (
                  <button
                    key={station.id}
                    className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''} ${hasFavorites ? 'has-favorites-shared' : ''}`}
                    style={{
                      left: station.coords.x,
                      top: station.coords.y,
                      backgroundColor: hasFavorites ? '#FFEB3B' : '#FFFFFF', // 有分享收藏的站點標記為黃色
                      borderColor: stationLineColor,
                    }}
                    onClick={() => handleStationClick(station)}
                    onMouseEnter={() => setHoveredStation(station.id)}
                    onMouseLeave={() => setHoveredStation(null)}
                    title={`${station.name}${hasFavorites ? ` (有${allStationsFavorites[station.id].length}筆分享收藏)` : ''}`}
                  >
                    <span className="station-id-tooltip">{station.id}</span>
                  </button>
                );
              })}
            </div>
          ) : googleMapsApiKey ? ( // 顯示 Google 地圖
            // LoadScript 已在 App.js
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapPoiClick} // 主要用於關閉 InfoWindow
              options={mapOptions}
            >
              {selectedStation && ( // 標記當前選中的捷運站
                <Marker position={selectedStation.realCoords} title={selectedStation.name} />
              )}

              {/* 標記當前選中捷運站的分享收藏店家 */}
              {displayedFavoriteStores.map(store => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                  onClick={() => handleSharedStoreClick(store)}
                />
              ))}

              {/* InfoWindow */}
              {clickedPlace && activeInfoWindow === clickedPlace.googlePlaceId && selectedStation && (
                <InfoWindow
                  key={clickedPlace.googlePlaceId}
                  position={{ lat: clickedPlace.lat, lng: clickedPlace.lng }}
                  onCloseClick={handleClosePlaceInfo}
                >
                  <div className="place-infowindow"> {/* 可以重用 HomePage 的 InfoWindow class */}
                    <h4>{clickedPlace.name}</h4>
                    <p>{clickedPlace.address?.substring(0, 25)}...</p>
                    {clickedPlace.rating !== undefined && <p>評分: {clickedPlace.rating} / 5</p>}
                    {/* 不顯示加入/移除按鈕 */}
                    <br/>
                    {clickedPlace.googlePlaceId && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedPlace.name || '')}&query_place_id=${clickedPlace.googlePlaceId}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.9em', color: '#1a73e8' }}
                      >
                        在 Google 地圖上查看
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="share-page-status error">無法載入地圖：Google Maps API 金鑰未設定。</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedMapViewerPage;