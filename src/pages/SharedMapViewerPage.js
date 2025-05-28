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
  const [showPlaceInfo, setShowPlaceInfo] = useState(false); // 控制側邊欄詳細資訊的顯示
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
      setShowPlaceInfo(false);
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
    setShowPlaceInfo(false);
    setActiveInfoWindow(null);
    setHoveredStation(null);
  };

  // POI 點擊處理 - 與 HomePage 類似的邏輯
  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current || !selectedStation) {
      console.warn("Place ID, Map instance, or Selected Station is not available for POI click in shared view.");
      return;
    }

    // 先清除舊的狀態
    setActiveInfoWindow(null);
    setClickedPlace(null);
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
        console.log("Place details received in shared view:", place);
        
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
          setClickedPlace(newClickedPlace);
          setShowPlaceInfo(true);
          
          // 延遲設置 InfoWindow 確保 clickedPlace 狀態已更新
          setTimeout(() => {
            setActiveInfoWindow(newClickedPlace.googlePlaceId);
          }, 50);
        } else {
          console.error("Missing required place data in shared view:", newClickedPlace);
        }
      } else {
        console.error("Failed to get place details in shared view:", status, place);
        setClickedPlace(null);
        setShowPlaceInfo(false);
        setActiveInfoWindow(null);
      }
    });
  };

  // 點擊已收藏的店家 Marker - 更新為與 HomePage 相似的邏輯
  const handleSharedStoreMarkerClick = (store) => {
    // 先清除舊的狀態
    setActiveInfoWindow(null);

    // 立即用收藏的店家資料設置 clickedPlace
    setClickedPlace({ ...store });
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
          setClickedPlace(updatedStoreDetails);
          setTimeout(() => {
            setActiveInfoWindow(store.googlePlaceId);
          }, 50);
        } else {
          console.error(`無法獲取分享店家 ${store.name} 的即時詳細資訊: ${status}`);
          setClickedPlace({ ...store });
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

  // 側邊欄店家點擊
  const handleSidebarFavoriteStoreClick = (store) => {
    handleSharedStoreMarkerClick(store);
  };

  const handleClosePlaceInfo = () => {
    setActiveInfoWindow(null);
    // setShowPlaceInfo(false); // 根據需求決定是否同時關閉側邊欄
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
  const mapOptions = { clickableIcons: true, disableDefaultUI: false };

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
                    <li key={store.googlePlaceId}>
                      <span onClick={() => handleSidebarFavoriteStoreClick(store)} className="store-name">
                        {store.name}
                      </span>
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
          
          {/* 店家詳細資訊 (側邊欄，與 HomePage 相同) */}
          {mapViewActive && clickedPlace && selectedStation && (
            <div className="place-details-sidebar">
              <h3>{clickedPlace.name}</h3>
              {clickedPlace.photos && clickedPlace.photos.length > 0 && (
                <img 
                  src={clickedPlace.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })} 
                  alt={`${clickedPlace.name} 的照片`} 
                  style={{ width: '100%', height: 'auto', marginTop: '10px', borderRadius: '4px', marginBottom: '10px' }} 
                />
              )}
              <p>地址: {clickedPlace.address}</p>
              {clickedPlace.rating !== undefined && (
                <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 0} 則評論)</p>
              )}
              {/* 即時營業狀態 */}
              {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
                <div style={{ 
                  fontSize: '0.9em', 
                  marginTop: '10px', 
                  marginBottom: (clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) ? '0px' : '5px', 
                  color: clickedPlace.openingHours.open_now ? 'green' : 'red', 
                  fontWeight: 'bold' 
                }}>
                  目前狀態: {clickedPlace.openingHours.open_now ? '營業中' : '休息中'}
                </div>
              )}
              {/* 顯示營業時間 - 支援兩種格式：已保存的和即時獲取的 */}
              {(clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) && (
                <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                  <strong>詳細營業時間:</strong>
                  <div style={{ paddingLeft: '15px', marginTop: '3px', marginBottom: '5px' }}>
                    {(() => {
                      const openingHoursSource = clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText;
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
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapPoiClick}
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
                  onClick={() => handleSharedStoreMarkerClick(store)}
                />
              ))}

              {/* InfoWindow - 與 HomePage 相同的邏輯 */}
              {clickedPlace && 
               activeInfoWindow === clickedPlace.googlePlaceId && 
               selectedStation && 
               clickedPlace.name && 
               clickedPlace.lat && 
               clickedPlace.lng && 
               clickedPlace.googlePlaceId && (
                <InfoWindow 
                  key={`${clickedPlace.googlePlaceId}-${activeInfoWindow}`}
                  position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }} 
                  onCloseClick={handleClosePlaceInfo}
                >
                  <div className="place-infowindow">
                    <h4>{clickedPlace.name}</h4>
                    {clickedPlace.photos && clickedPlace.photos.length > 0 && (
                      <img 
                        src={clickedPlace.photos[0].getUrl({ maxWidth: 150, maxHeight: 100 })} 
                        alt={`${clickedPlace.name} 的照片`}
                        style={{ maxWidth: '100%', height: 'auto', marginTop: '5px', marginBottom: '5px', borderRadius: '3px' }}
                      />
                    )}
                    <p>{clickedPlace.address ? (clickedPlace.address.length > 25 ? clickedPlace.address.substring(0, 25) + '...' : clickedPlace.address) : '地址不詳'}</p>
                    {clickedPlace.rating !== undefined && (
                      <p>評分: {clickedPlace.rating} / 5</p>
                    )}
                    {/* 即時營業狀態 */}
                    {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
                      <div style={{ 
                        fontSize: '0.9em', 
                        marginTop: '5px', 
                        marginBottom: (clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) ? '2px' : '5px',
                        color: clickedPlace.openingHours.open_now ? 'green' : 'red', 
                        fontWeight: 'bold' 
                      }}>
                        {clickedPlace.openingHours.open_now ? '目前營業中' : '目前休息中'}
                      </div>
                    )}
                    {/* 顯示今日營業時間 */}
                    {(clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) && (
                      <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                        <strong>今日時段:</strong>
                        <span style={{ marginLeft: '5px' }}>
                          {(() => {
                            const openingHoursSource = clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText;
                            if (openingHoursSource && Array.isArray(openingHoursSource)) {
                              const today = new Date().getDay();
                              const todayIndex = (today === 0) ? 6 : today - 1;
                              
                              let todayText = '';
                              if (clickedPlace.openingHours && clickedPlace.openingHours.periods) {
                                const now = new Date();
                                const currentDayPeriods = clickedPlace.openingHours.periods.filter(p => p.open && p.open.day === today);
                                if (currentDayPeriods.length > 0) {
                                   todayText = currentDayPeriods.map(p => {
                                    const openTime = `${String(p.open.hours).padStart(2, '0')}:${String(p.open.minutes).padStart(2, '0')}`;
                                    if (p.close) {
                                      const closeTime = `${String(p.close.hours).padStart(2, '0')}:${String(p.close.minutes).padStart(2, '0')}`;
                                      return `${openTime} – ${closeTime}`;
                                    }
                                    return `${openTime} – (營業中)`;
                                  }).join(', ');
                                } else if (clickedPlace.openingHours.open_now === false && openingHoursSource[todayIndex] && (openingHoursSource[todayIndex].includes("休息") || openingHoursSource[todayIndex].includes("Closed"))) {
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
                    {/* 不顯示加入/移除按鈕，但保留 Google 地圖連結 */}
                    <br/>
                    {clickedPlace.googlePlaceId && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedPlace.name || '')}&query_place_id=${clickedPlace.googlePlaceId}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
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