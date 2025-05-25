// src/pages/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase';
import {
  collection, addDoc, serverTimestamp, query, where, getDocs, limit,
  onSnapshot,
  doc, deleteDoc // 稍後刪除功能會用到
} from "firebase/firestore";
import { stationData, lineColors } from '../data/stations'; // 確保路徑正確
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import './HomePage.css'; // 確保引入 CSS

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultZoom = 16;
const libraries = ["places"];
const MAX_FAVORITE_STORES_PER_STATION = 15;

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [clickedPlace, setClickedPlace] = useState(null);
  const [showPlaceInfo, setShowPlaceInfo] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [myFavoriteStores, setMyFavoriteStores] = useState([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [isRemovingFromList, setIsRemovingFromList] = useState(false); // << 新增：處理移除時的狀態

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef(null);

  const onLoad = useCallback(function callback(map) {
    setMapInstance(map);
    mapRef.current = map;
    console.log("Google Map instance loaded.");
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMapInstance(null);
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!googleMapsApiKey) {
      console.error("Google Maps API Key is missing. Please check your .env file.");
    }
  }, [googleMapsApiKey]);

  useEffect(() => {
    let timer;
    if (feedbackMessage) {
      timer = setTimeout(() => {
        setFeedbackMessage('');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  useEffect(() => {
    if (user && selectedStation && selectedStation.id) {
      const stationFavoritesPath = `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`;
      const stationFavoritesRef = collection(db, stationFavoritesPath);
      const q = query(stationFavoritesRef); // orderBy("addedAt", "desc")

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const stores = [];
        querySnapshot.forEach((doc) => {
          stores.push({ id: doc.id, ...doc.data() });
        });
        setMyFavoriteStores(stores);
        console.log(`Fetched ${stores.length} favorite stores for station ${selectedStation.name}.`);
      }, (error) => {
        console.error(`Error fetching favorite stores for station ${selectedStation.id}: `, error);
        setFeedbackMessage(`讀取 ${selectedStation.name} 最愛清單失敗`);
        setMyFavoriteStores([]);
      });

      return () => unsubscribe();
    } else {
      setMyFavoriteStores([]);
    }
  }, [user, selectedStation]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const handleStationClick = (station) => {
    if (station.realCoords) {
      setSelectedStation(station);
      setMapViewActive(true);
      setClickedPlace(null);
      setShowPlaceInfo(false);
      setActiveInfoWindow(null);
      setFeedbackMessage('');
    } else {
      console.warn(`站點 ${station.name} 缺少 realCoords 資料。`);
    }
  };

  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null);
    setClickedPlace(null);
    setShowPlaceInfo(false);
    setActiveInfoWindow(null);
    setFeedbackMessage('');
  };

  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapInstance || !selectedStation) {
      console.warn("Place ID, Map instance, or Selected Station is not available for POI click.");
      return;
    }

    const placesService = new window.google.maps.places.PlacesService(mapInstance);
    placesService.getDetails({
      placeId: placeId,
      fields: [
        'name', 'formatted_address', 'geometry.location', 'place_id',
        'rating', 'user_ratings_total', 'photos', 'opening_hours',
        'types', 'website', 'formatted_phone_number'
      ]
    }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        const newClickedPlace = {
          name: place.name,
          address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          googlePlaceId: place.place_id,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photos: place.photos ? place.photos.map(p => ({ // Store getUrl and other relevant photo info
            getUrl: (options) => p.getUrl(options), // Keep getUrl as a function
            height: p.height,
            width: p.width,
            html_attributions: p.html_attributions,
            photo_reference: p.photo_reference
          })) : [],
          openingHours: place.opening_hours, // This object itself has methods like isOpen()
          types: place.types,
          website: place.website,
          phoneNumber: place.formatted_phone_number
        };
        setClickedPlace(newClickedPlace);
        setShowPlaceInfo(true);
        setActiveInfoWindow(newClickedPlace.googlePlaceId);
        setFeedbackMessage('');
      } else {
        console.error("Failed to get place details:", status, place);
        setClickedPlace(null);
        setShowPlaceInfo(false);
        setActiveInfoWindow(null);
        setFeedbackMessage('無法獲取店家詳細資訊');
      }
    });
  };

  const handleFavoriteStoreMarkerClick = (store) => {
    setClickedPlace(store);
    setShowPlaceInfo(true);
    setActiveInfoWindow(store.googlePlaceId);
    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }
  };

  const handleSidebarFavoriteStoreClick = (store) => {
    setClickedPlace(store);
    setShowPlaceInfo(true);
    if (mapViewActive) {
      setActiveInfoWindow(store.googlePlaceId);
      if (mapRef.current && store.lat && store.lng) {
        mapRef.current.panTo({ lat: store.lat, lng: store.lng });
      }
    }
  };

  const handleClosePlaceInfo = () => {
    // setShowPlaceInfo(false); // 可選：是否同時關閉側邊欄資訊
    setActiveInfoWindow(null); // 主要關閉 InfoWindow
  };

  const handleAddToMyList = async () => {
    if (!user || !clickedPlace || !selectedStation || !selectedStation.id) {
      setFeedbackMessage("錯誤：請先選擇一個捷運站並點選店家。");
      return;
    }
    if (isAddingToList) return;

    setIsAddingToList(true);
    setFeedbackMessage("正在加入清單...");

    try {
      const stationStoresPath = `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`;
      const stationStoresRef = collection(db, stationStoresPath);

      if (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION) {
        setFeedbackMessage(`此捷運站 (${selectedStation.name}) 的最愛清單已滿 (最多 ${MAX_FAVORITE_STORES_PER_STATION} 家)。`);
        setIsAddingToList(false);
        return;
      }

      const q = query(stationStoresRef, where("googlePlaceId", "==", clickedPlace.googlePlaceId), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setFeedbackMessage(`此店家已在 ${selectedStation.name} 的最愛清單中。`);
        setActiveInfoWindow(clickedPlace.googlePlaceId);
        setIsAddingToList(false);
        return;
      }
      
      let mainPhotoUrl = null;
      if (clickedPlace.photos && clickedPlace.photos.length > 0 && typeof clickedPlace.photos[0].getUrl === 'function') {
          mainPhotoUrl = clickedPlace.photos[0].getUrl({ maxWidth: 400, maxHeight:300 }); //指定大小
      }

      const storeData = {
        name: clickedPlace.name || 'N/A',
        address: clickedPlace.address || 'N/A',
        googlePlaceId: clickedPlace.googlePlaceId,
        lat: clickedPlace.lat,
        lng: clickedPlace.lng,
        // stationId: selectedStation.id, // 路徑中已有，可省略
        addedAt: serverTimestamp(),
        ...(clickedPlace.rating !== undefined && { rating: clickedPlace.rating }),
        ...(clickedPlace.userRatingsTotal !== undefined && { userRatingsTotal: clickedPlace.userRatingsTotal }),
        ...(clickedPlace.types && { types: clickedPlace.types }),
        ...(clickedPlace.website && { website: clickedPlace.website }),
        ...(clickedPlace.phoneNumber && { phoneNumber: clickedPlace.phoneNumber }),
        ...(mainPhotoUrl && { mainPhotoUrl: mainPhotoUrl }),
        // 如果需要儲存營業時間的文字描述 (openingHours.weekday_text)
        ...(clickedPlace.openingHours && clickedPlace.openingHours.weekday_text && { openingHoursText: clickedPlace.openingHours.weekday_text }),
      };

      await addDoc(stationStoresRef, storeData);
      setFeedbackMessage(`店家已成功加入 ${selectedStation.name} 的最愛清單！`);
      setActiveInfoWindow(clickedPlace.googlePlaceId);
    } catch (error) {
      console.error("加入個人清單失敗:", error);
      setFeedbackMessage(`加入失敗: ${error.message}`);
    } finally {
      setIsAddingToList(false);
    }
  };
    // << 新增：從最愛清單中移除店家的函式 >>
  const handleRemoveFromMyList = async (storeToRemove) => {
    if (!user || !storeToRemove || !storeToRemove.id || !selectedStation || !selectedStation.id) {
      setFeedbackMessage("錯誤：無法移除店家，資訊不完整。");
      return;
    }
    if (isRemovingFromList) return; // 防止重複點擊

    // 確認 storeToRemove.id 是 Firestore 文件 ID
    // storeToRemove.googlePlaceId 是店家的 Google Place ID
    // selectedStation.id 是當前捷運站的 ID

    setIsRemovingFromList(true);
    setFeedbackMessage(`正在從 ${selectedStation.name} 最愛中移除 ${storeToRemove.name}...`);

    try {
      const storeDocRef = doc(db, `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`, storeToRemove.id);
      await deleteDoc(storeDocRef);

      setFeedbackMessage(`${storeToRemove.name} 已成功從 ${selectedStation.name} 的最愛清單中移除！`);
      // 清單會通過 onSnapshot 自動更新
      // 如果 InfoWindow 或側邊欄顯示的是這個剛被移除的店家，可以考慮關閉它們或清除 clickedPlace
      if (clickedPlace && clickedPlace.id === storeToRemove.id) {
        // setShowPlaceInfo(false); // 可選：關閉側邊欄詳細資訊
        // setActiveInfoWindow(null); // 可選：關閉 InfoWindow
        // setClickedPlace(null); // 可選：清除選中的店家
        // 這裡的行為取決於你希望的使用者體驗
      }

    } catch (error) {
      console.error("從個人清單移除失敗:", error);
      setFeedbackMessage(`移除失敗: ${error.message}`);
    } finally {
      setIsRemovingFromList(false);
    }
  };
  const mapCenter = selectedStation?.realCoords || { lat: 22.639065, lng: 120.302104 };
  const mapOptions = {
    clickableIcons: true,
    disableDefaultUI: false,
    // zoomControl: true, // 確保縮放控制項是啟用的
    // streetViewControl: false, // 如果不需要街景小人
  };

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        {mapViewActive && (
          <button onClick={handleBackToRouteMap} className="back-button">
            返回路線圖
          </button>
        )}
        <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
        <div>
          {feedbackMessage && <span className="feedback-message">{feedbackMessage}</span>}
          <button onClick={handleLogout} className="logout-button">登出</button>
        </div>
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
          <hr />

          {selectedStation ? (
            <>
              <h2>{selectedStation.name} 的最愛 ({myFavoriteStores.length}/{MAX_FAVORITE_STORES_PER_STATION})</h2>
              {myFavoriteStores.length > 0 ? (
                <ul className="favorite-stores-list">
                  {myFavoriteStores.map(store => (
                    <li key={store.id}>
                      <span onClick={() => handleSidebarFavoriteStoreClick(store)} className="store-name">
                        {store.name}
                      </span>
                      <button
                        onClick={() => handleRemoveFromMyList(store)}
                        disabled={isRemovingFromList}
                        className="remove-button-small"
                        title={`從 ${selectedStation.name} 移除 ${store.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>此捷運站尚無最愛店家。</p>
              )}
            </>
          ) : mapViewActive ? (
            <p>請先從左側列表選擇一個捷運站來查看收藏。</p>
          ) : (
            <p>點選捷運站以查看該站點的收藏店家。</p>
          )}
          <hr />

          {mapViewActive && clickedPlace && showPlaceInfo && selectedStation && (
            <div className="place-details-sidebar">
              <h3>{clickedPlace.name}</h3>
              <p>地址: {clickedPlace.address}</p>
              {clickedPlace.rating !== undefined && (
                <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 0} 則評論)</p>
              )}
              {clickedPlace.openingHours && (
                <div>
                  <p>營業狀態: {
                    typeof clickedPlace.openingHours.isOpen === 'function'
                      ? (clickedPlace.openingHours.isOpen() ? "營業中" : "休息中")
                      : (clickedPlace.openingHours.open_now !== undefined ? (clickedPlace.openingHours.open_now ? "營業中" : "休息中") : "未知")
                  }</p>
                  {clickedPlace.openingHours.weekday_text && (
                    <ul style={{fontSize: '0.8em', paddingLeft: '15px', marginTop: '5px'}}>
                      {clickedPlace.openingHours.weekday_text.map((text, index) => (
                        <li key={index}>{text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {myFavoriteStores.some(s => s.googlePlaceId === clickedPlace.googlePlaceId) ? (
                 <button
                   onClick={() => {
                     const storeInList = myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId);
                     if (storeInList) {
                       handleRemoveFromMyList(storeInList);
                     } else {
                       // setFeedbackMessage("錯誤：在清單中找不到此店家以進行移除。"); // 確保 setFeedbackMessage 已定義
                       console.error("錯誤：在清單中找不到此店家以進行移除。 ClickedPlace:", clickedPlace, "MyFavoriteStores:", myFavoriteStores);
                     }
                   }}
                   disabled={isRemovingFromList && clickedPlace.id === (myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId)?.id)}
                   style={{ marginTop: '10px' }}
                   className="remove-from-list-button"
                 >
                   {isRemovingFromList && clickedPlace.id === (myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId)?.id) ? "移除中..." : `從 ${selectedStation.name} 最愛移除`}
                 </button>
              ) : (
                <button
                  onClick={handleAddToMyList}
                  disabled={isAddingToList || myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION}
                  style={{ marginTop: '10px' }}
                  className="add-to-list-button"
                >
                  {isAddingToList ? "加入中..." : (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION ? `${selectedStation.name}清單已滿` : `加入 ${selectedStation.name} 最愛`)}
                </button>
              )}
              <button onClick={() => { setShowPlaceInfo(false); setActiveInfoWindow(null); }} style={{ marginTop: '10px', marginLeft: '5px' }}>
                關閉資訊
              </button>
            </div>
          )}
        </aside>

        <div className="map-area-container">
          {!mapViewActive ? (
            <div className="krtc-map-container">
              <img
                src="img/krtc-map.png" // 確保這個路徑是正確的，通常在 public 資料夾下
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
          ) : googleMapsApiKey ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapPoiClick}
              options={mapOptions}
            >
              {selectedStation && (
                <Marker position={selectedStation.realCoords} title={selectedStation.name} />
              )}

              {selectedStation && myFavoriteStores.map(store => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                  }}
                  onClick={() => handleFavoriteStoreMarkerClick(store)}
                />
              ))}

              {clickedPlace && activeInfoWindow === clickedPlace.googlePlaceId && selectedStation && (
                <InfoWindow
                  key={clickedPlace.googlePlaceId}
                  position={{ lat: clickedPlace.lat, lng: clickedPlace.lng }}
                  onCloseClick={handleClosePlaceInfo}
                >
                  <div className="place-infowindow">
                    <h4>{clickedPlace.name}</h4>
                    <p>{clickedPlace.address?.substring(0, 25)}...</p>
                    {clickedPlace.rating !== undefined && <p>評分: {clickedPlace.rating} / 5</p>}

                    {myFavoriteStores.some(s => s.googlePlaceId === clickedPlace.googlePlaceId) ? (
                      <button
                        onClick={() => {
                          const storeInList = myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId);
                          if (storeInList) {
                            handleRemoveFromMyList(storeInList);
                          }
                        }}
                        disabled={isRemovingFromList && clickedPlace.id === (myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId)?.id)}
                        className="remove-button-small infowindow-button"
                        style={{marginTop: '5px'}}
                      >
                        {isRemovingFromList && clickedPlace.id === (myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId)?.id) ? "移除中..." : "從最愛移除"}
                      </button>
                    ) : (
                      <button
                        onClick={handleAddToMyList}
                        disabled={isAddingToList || myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION}
                        className="add-to-list-button"
                        style={{fontSize: '0.9em', padding: '3px 6px', marginTop: '5px'}}
                      >
                        {isAddingToList ? "處理中..." : (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION ? "此站已滿" : `加入 ${selectedStation.name} 最愛`)}
                      </button>
                    )}
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
            <div>
              {!googleMapsApiKey && <p>Google Maps API 金鑰未設定或無效。</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;