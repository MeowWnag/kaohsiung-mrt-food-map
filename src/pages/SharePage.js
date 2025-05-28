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
  const [showPlaceInfo, setShowPlaceInfo] = useState(false); // 控制側邊欄詳細資訊的顯示

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
    // 先清除舊的狀態
    setActiveInfoWindow(null);

    // 立即用收藏的店家資料設置 clickedStoreForInfo
    setClickedStoreForInfo({ ...store });
    setShowPlaceInfo(true);

    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }

    // 獲取並更新即時店家資訊
    if (mapRef.current && window.google && window.google.maps && window.google.maps.places) {
      const placesService = new window.google.maps.places.PlacesService(mapRef.current);
      placesService.getDetails({
        placeId: store.googlePlaceId,
        fields: [
          'name', 'formatted_address', 'geometry.location', 'place_id',
          'rating', 'user_ratings_total', 'photos', 'opening_hours',
          'types', 'website', 'formatted_phone_number'
        ]
      }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          const updatedStoreDetails = {
            ...store, // 保留原收藏的資料
            name: place.name || store.name,
            address: place.formatted_address || store.address,
            lat: place.geometry?.location?.lat() || store.lat,
            lng: place.geometry?.location?.lng() || store.lng,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            photos: place.photos ? place.photos.map(p => ({ 
              getUrl: (options) => p.getUrl(options), 
              photo_reference: p.photo_reference 
            })) : (store.photos || []),
            openingHours: place.opening_hours,
            types: place.types,
            website: place.website,
            phoneNumber: place.formatted_phone_number,
          };
          setClickedStoreForInfo(updatedStoreDetails);
          setTimeout(() => {
            setActiveInfoWindow(store.googlePlaceId);
          }, 50);
        } else {
          console.error(`無法獲取分享店家 ${store.name} 的即時詳細資訊: ${status}`);
          setClickedStoreForInfo({ ...store });
          setTimeout(() => {
            setActiveInfoWindow(store.googlePlaceId);
          }, 50);
        }
      });
    } else {
      setTimeout(() => {
        setActiveInfoWindow(store.googlePlaceId);
      }, 100);
    }
  };
  
  const handleSidebarStoreClick = (store) => { // 當點擊側邊欄的店家
    handleMarkerClick(store); // 重用地圖標記點擊的邏輯
  };

  const handleCloseInfoWindow = () => {
    setActiveInfoWindow(null);
    // setShowPlaceInfo(false); // 根據需求決定是否同時關閉側邊
  };

  const handleClosePlaceInfo = () => {
    setActiveInfoWindow(null);
    setShowPlaceInfo(false);
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
    clickableIcons: true, // 啟用 POI 點擊功能
    disableDefaultUI: false, // 可以保留預設 UI (縮放、地圖類型等)
  };
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";

  // POI 點擊處理 - 與 HomePage 類似的邏輯
  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current) {
      console.warn("Place ID or Map instance is not available for POI click in share page.");
      return;
    }

    // 先清除舊的狀態
    setActiveInfoWindow(null);
    setClickedStoreForInfo(null);
    setShowPlaceInfo(false);

    const placesService = new window.google.maps.places.PlacesService(mapRef.current);
    placesService.getDetails({
      placeId: placeId,
      fields: [
        'name', 'formatted_address', 'geometry.location', 'place_id',
        'rating', 'user_ratings_total', 'photos', 'opening_hours',
        'types', 'website', 'formatted_phone_number'
      ]
    }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        console.log("Place details received in share page:", place);
        
        const newClickedPlace = {
          name: place.name || '未知店家',
          address: place.formatted_address || '地址不詳',
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
          googlePlaceId: place.place_id,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photos: place.photos ? place.photos.map(p => ({ 
            getUrl: (options) => p.getUrl(options), 
            photo_reference: p.photo_reference 
          })) : [],
          openingHours: place.opening_hours,
          types: place.types,
          website: place.website,
          phoneNumber: place.formatted_phone_number
        };
        
        // 確保必要數據存在才設置狀態
        if (newClickedPlace.name && newClickedPlace.lat && newClickedPlace.lng && newClickedPlace.googlePlaceId) {
          setClickedStoreForInfo(newClickedPlace);
          setShowPlaceInfo(true);
          
          // 延遲設置 InfoWindow 確保 clickedStoreForInfo 狀態已更新
          setTimeout(() => {
            setActiveInfoWindow(newClickedPlace.googlePlaceId);
          }, 50);
        } else {
          console.error("Missing required place data in share page:", newClickedPlace);
        }
      } else {
        console.error("Failed to get place details in share page:", status, place);
        setClickedStoreForInfo(null);
        setShowPlaceInfo(false);
        setActiveInfoWindow(null);
      }
    });
  };

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
          <hr />

          {/* 店家詳細資訊 (側邊欄，與 HomePage 相同) */}
          {clickedStoreForInfo && showPlaceInfo && (
            <div className="place-details-sidebar">
              <h3>{clickedStoreForInfo.name}</h3>
              {clickedStoreForInfo.photos && clickedStoreForInfo.photos.length > 0 && (
                <img 
                  src={clickedStoreForInfo.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })} 
                  alt={`${clickedStoreForInfo.name} 的照片`} 
                  style={{ width: '100%', height: 'auto', marginTop: '10px', borderRadius: '4px', marginBottom: '10px' }} 
                />
              )}
              <p>地址: {clickedStoreForInfo.address}</p>
              {clickedStoreForInfo.rating !== undefined && (
                <p>評分: {clickedStoreForInfo.rating} ({clickedStoreForInfo.userRatingsTotal || 0} 則評論)</p>
              )}
              {/* 即時營業狀態 */}
              {clickedStoreForInfo.openingHours && typeof clickedStoreForInfo.openingHours.open_now === 'boolean' && (
                <div style={{ 
                  fontSize: '0.9em', 
                  marginTop: '10px', 
                  marginBottom: (clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) ? '0px' : '5px', 
                  color: clickedStoreForInfo.openingHours.open_now ? 'green' : 'red', 
                  fontWeight: 'bold' 
                }}>
                  目前狀態: {clickedStoreForInfo.openingHours.open_now ? '營業中' : '休息中'}
                </div>
              )}
              {/* 顯示營業時間 - 支援兩種格式：已保存的和即時獲取的 */}
              {(clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) && (
                <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                  <strong>詳細營業時間:</strong>
                  <div style={{ paddingLeft: '15px', marginTop: '3px', marginBottom: '5px' }}>
                    {(() => {
                      const openingHoursSource = clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText;
                      if (openingHoursSource && Array.isArray(openingHoursSource)) {
                        return openingHoursSource.map((dailyHours, index) => (
                          <div key={index} style={{ marginBottom: '1px' }}>{dailyHours}</div>
                        ));
                      }
                      return <span style={{ marginBottom: '1px' }}>營業時間資訊不完整</span>;
                    })()}
                  </div>
                </div>
              )}
              <button onClick={handleClosePlaceInfo} style={{ marginTop: '10px', marginLeft: '5px' }}>
                關閉資訊
              </button>
            </div>
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
              onClick={handleMapPoiClick}
              options={mapOptions}
            >
              {/* 標記捷運站位置 */}
              {stationInfo && stationInfo.realCoords && (
                <Marker
                  position={stationInfo.realCoords}
                  title={stationInfo.name}
                />
              )}

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
              {clickedStoreForInfo && 
               activeInfoWindow === clickedStoreForInfo.googlePlaceId && 
               clickedStoreForInfo.name && 
               clickedStoreForInfo.lat && 
               clickedStoreForInfo.lng && 
               clickedStoreForInfo.googlePlaceId && (
                <InfoWindow
                  key={`${clickedStoreForInfo.googlePlaceId}-${activeInfoWindow}`}
                  position={{ lat: Number(clickedStoreForInfo.lat), lng: Number(clickedStoreForInfo.lng) }}
                  onCloseClick={handleCloseInfoWindow}
                >
                  <div className="place-infowindow-share">
                    <h4>{clickedStoreForInfo.name}</h4>
                    {clickedStoreForInfo.photos && clickedStoreForInfo.photos.length > 0 && (
                      <img 
                        src={clickedStoreForInfo.photos[0].getUrl({ maxWidth: 150, maxHeight: 100 })} 
                        alt={`${clickedStoreForInfo.name} 的照片`}
                        style={{ maxWidth: '100%', height: 'auto', marginTop: '5px', marginBottom: '5px', borderRadius: '3px' }}
                      />
                    )}
                    <p>{clickedStoreForInfo.address ? (clickedStoreForInfo.address.length > 25 ? clickedStoreForInfo.address.substring(0, 25) + '...' : clickedStoreForInfo.address) : '地址不詳'}</p>
                    {clickedStoreForInfo.rating !== undefined && (
                      <p>評分: {clickedStoreForInfo.rating} / 5</p>
                    )}
                    {/* 即時營業狀態 */}
                    {clickedStoreForInfo.openingHours && typeof clickedStoreForInfo.openingHours.open_now === 'boolean' && (
                      <div style={{ 
                        fontSize: '0.9em', 
                        marginTop: '5px', 
                        marginBottom: (clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) ? '2px' : '5px',
                        color: clickedStoreForInfo.openingHours.open_now ? 'green' : 'red', 
                        fontWeight: 'bold' 
                      }}>
                        {clickedStoreForInfo.openingHours.open_now ? '目前營業中' : '目前休息中'}
                      </div>
                    )}
                    {/* 顯示今日營業時間 */}
                    {(clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) && (
                      <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                        <strong>今日時段:</strong>
                        <span style={{ marginLeft: '5px' }}>
                          {(() => {
                            const openingHoursSource = clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText;
                            if (openingHoursSource && Array.isArray(openingHoursSource)) {
                              const today = new Date().getDay();
                              const todayIndex = (today === 0) ? 6 : today - 1;
                              
                              let todayText = '';
                              if (clickedStoreForInfo.openingHours && clickedStoreForInfo.openingHours.periods) {
                                const now = new Date();
                                const currentDayPeriods = clickedStoreForInfo.openingHours.periods.filter(p => p.open && p.open.day === today);
                                if (currentDayPeriods.length > 0) {
                                   todayText = currentDayPeriods.map(p => {
                                    const openTime = `${String(p.open.hours).padStart(2, '0')}:${String(p.open.minutes).padStart(2, '0')}`;
                                    if (p.close) {
                                      const closeTime = `${String(p.close.hours).padStart(2, '0')}:${String(p.close.minutes).padStart(2, '0')}`;
                                      return `${openTime} – ${closeTime}`;
                                    }
                                    return `${openTime} – (營業中)`;
                                  }).join(', ');
                                } else if (clickedStoreForInfo.openingHours.open_now === false && openingHoursSource[todayIndex] && (openingHoursSource[todayIndex].includes("休息") || openingHoursSource[todayIndex].includes("Closed"))) {
                                    todayText = "休息";
                                } else if (openingHoursSource[todayIndex]) {
                                    todayText = openingHoursSource[todayIndex].substring(openingHoursSource[todayIndex].indexOf(':') + 1).trim();
                                } else {
                                    todayText = "資訊不詳";
                                }

                              } else if (openingHoursSource[todayIndex]) {
                                todayText = openingHoursSource[todayIndex];
                                const timePart = todayText.substring(todayText.indexOf(':') + 1).trim();
                                return timePart || (todayText.includes("休息") || todayText.includes("Closed") ? "休息" : "資訊不詳");
                              } else {
                                return '資訊不完整';
                              }
                              return todayText || "資訊不詳";
                            }
                            return '資訊不完整';
                          })()}
                        </span>
                      </div>
                    )}
                    <br/>
                    {/* "在 Google 地圖上查看" 連結 */}
                    {clickedStoreForInfo.googlePlaceId && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedStoreForInfo.name || '')}&query_place_id=${clickedStoreForInfo.googlePlaceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.9em', color: '#1a73e8' }}
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