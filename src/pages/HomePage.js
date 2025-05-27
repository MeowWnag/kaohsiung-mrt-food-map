// src/pages/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase';
import {
  collection, addDoc, serverTimestamp, query, where, getDocs, limit,
  onSnapshot,
  doc, deleteDoc
} from "firebase/firestore";
import { stationData, lineColors } from '../data/stations'; // 確保路徑正確
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'; // LoadScript 已在 App.js
import './HomePage.css'; // 確保引入 CSS

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultZoom = 16;
// const libraries = ["places"]; // 已在 App.js LoadScript 中定義
const MAX_FAVORITE_STORES_PER_STATION = 15;

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [clickedPlace, setClickedPlace] = useState(null);
  const [showPlaceInfo, setShowPlaceInfo] = useState(false); // 控制側邊欄詳細資訊的顯示
  const [mapInstance, setMapInstance] = useState(null); // mapRef.current 即可，但保留 setMapInstance 以便 onLoad
  
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isRemovingFromList, setIsRemovingFromList] = useState(false);
  
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [myFavoriteStores, setMyFavoriteStores] = useState([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);

  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false); // 用於兩種分享按鈕
  const [generatedShareLink, setGeneratedShareLink] = useState('');

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // 雖然 LoadScript 在 App.js, 但這裡可能用於條件渲染
  const mapRef = useRef(null);

  const onLoad = useCallback(function callback(map) {
    setMapInstance(map); // 雖然主要用 mapRef, 但有些 API 如 PlacesService 可能直接用 map instance
    mapRef.current = map;
    console.log("Google Map instance loaded.");
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMapInstance(null); // 清理
  }, []);

  useEffect(() => {
    if (!googleMapsApiKey && mapViewActive) { // 只在需要地圖時檢查
      console.error("Google Maps API Key is missing. Please check your .env file.");
      // 可以考慮設定一個錯誤狀態來顯示給用戶
    }
  }, [googleMapsApiKey, mapViewActive]);

  useEffect(() => {
    let timer;
    if (feedbackMessage) {
      timer = setTimeout(() => {
        setFeedbackMessage('');
      }, 3000); // 3秒後自動清除回饋訊息
    }
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  // 讀取使用者在特定捷運站的收藏列表
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
      }, (error) => {
        console.error(`Error fetching favorite stores for station ${selectedStation.id}: `, error);
        setFeedbackMessage(`讀取 ${selectedStation.name} 最愛清單失敗`);
        setMyFavoriteStores([]);
      });
      return () => unsubscribe();
    } else {
      setMyFavoriteStores([]); // 清空列表如果沒有用戶或選中站點
    }
  }, [user, selectedStation]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // App.js 的 onAuthStateChanged 會處理跳轉
    } catch (error) {
      console.error("登出失敗:", error);
      setFeedbackMessage("登出時發生錯誤。");
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
      setGeneratedShareLink(''); // 切換站點時清除舊的分享連結
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
    setGeneratedShareLink('');
    setHoveredStation(null); // 新增這行來重置懸停狀態
  };

  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current || !selectedStation) {
      console.warn("Place ID, Map instance, or Selected Station is not available for POI click.");
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
        console.log("Place details received:", place); // 調試用
        
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
        
        console.log("New clicked place:", newClickedPlace); // 調試用
        
        // 確保必要數據存在才設置狀態
        if (newClickedPlace.name && newClickedPlace.lat && newClickedPlace.lng && newClickedPlace.googlePlaceId) {
          setClickedPlace(newClickedPlace);
          setShowPlaceInfo(true);
          
          // 延遲設置 InfoWindow 確保 clickedPlace 狀態已更新
          setTimeout(() => {
            setActiveInfoWindow(newClickedPlace.googlePlaceId);
          }, 50);
          
          setFeedbackMessage('');
        } else {
          console.error("Missing required place data:", newClickedPlace);
          setFeedbackMessage('店家資訊不完整，無法顯示詳細資訊');
        }
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
    // 先清除舊的狀態
    setActiveInfoWindow(null);
    // setClickedPlace(null); // 清除舊的，下面會立即設置

    // 立即用收藏的店家資料設置 clickedPlace，以便快速顯示基本資訊
    setClickedPlace({ ...store }); // 複製 store 物件以避免直接修改狀態中的 myFavoriteStores
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
            ...store, // 保留原收藏的 ID 和其他 Firestore 特定欄位
            name: place.name || store.name,
            address: place.formatted_address || store.address,
            lat: place.geometry?.location?.lat() || store.lat,
            lng: place.geometry?.location?.lng() || store.lng,
            rating: place.rating, // 使用 API 回傳的評分
            userRatingsTotal: place.user_ratings_total, // 使用 API 回傳的評分總數
            photos: place.photos ? place.photos.map(p => ({ 
              getUrl: (options) => p.getUrl(options), 
              photo_reference: p.photo_reference 
            })) : (store.photos || []), // 如果 API 有照片則使用，否則保留原有的 (如果有的話)
            openingHours: place.opening_hours, // !!! 這是主要的即時資訊來源
            types: place.types,
            website: place.website,
            phoneNumber: place.formatted_phone_number,
            // openingHoursText: place.opening_hours?.weekday_text || store.openingHoursText, // 優先使用 API 的 weekday_text
          };
          setClickedPlace(updatedStoreDetails);
          // 確保 InfoWindow 在 clickedPlace 更新後再顯示/刷新
          setTimeout(() => {
            setActiveInfoWindow(store.googlePlaceId);
          }, 50);
        } else {
          console.error(`無法獲取收藏店家 ${store.name} 的即時詳細資訊: ${status}`);
          setFeedbackMessage(`無法更新 ${store.name} 的即時資訊，顯示庫存資料。`);
          // 即使獲取失敗，也要確保 InfoWindow 顯示 (使用庫存資料)
          setClickedPlace({ ...store }); // 確保是庫存資料
          setTimeout(() => {
            setActiveInfoWindow(store.googlePlaceId);
          }, 50);
        }
      });
    } else {
      // 若沒有 map instance 或 Google Places API，則只顯示庫存資料
      console.warn("Map instance or Google Places API not available for fetching favorite store details.");
      // 確保 InfoWindow 顯示 (使用庫存資料)
      setTimeout(() => {
        setActiveInfoWindow(store.googlePlaceId);
      }, 100);
    }
  };
  
  const handleSidebarFavoriteStoreClick = (store) => {
    handleFavoriteStoreMarkerClick(store); // 重用邏輯
  };

  const handleClosePlaceInfo = () => {
    setActiveInfoWindow(null);
    // setShowPlaceInfo(false); // 根據需求決定是否同時關閉側邊欄
  };

  const handleAddToMyList = async () => {
    // ... (此函式邏輯如前一個版本所示，包含檢查、準備 storeData、addDoc) ...
    if (!user || !clickedPlace || !selectedStation || !selectedStation.id) {
      setFeedbackMessage("錯誤：請先選擇一個捷運站並點選店家。"); return;
    }
    if (isAddingToList) return;
    setIsAddingToList(true); setFeedbackMessage("正在加入清單...");
    try {
      const stationStoresPath = `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`;
      const stationStoresRef = collection(db, stationStoresPath);
      if (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION) {
        setFeedbackMessage(`此捷運站 (${selectedStation.name}) 的最愛清單已滿。`); setIsAddingToList(false); return;
      }
      const q = query(stationStoresRef, where("googlePlaceId", "==", clickedPlace.googlePlaceId), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setFeedbackMessage(`此店家已在 ${selectedStation.name} 的最愛清單中。`); setActiveInfoWindow(clickedPlace.googlePlaceId); setIsAddingToList(false); return;
      }
      let mainPhotoUrl = null;
      if (clickedPlace.photos && clickedPlace.photos.length > 0 && typeof clickedPlace.photos[0].getUrl === 'function') {
        mainPhotoUrl = clickedPlace.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
      }
      const storeData = {
        name: clickedPlace.name || 'N/A', address: clickedPlace.address || 'N/A',
        googlePlaceId: clickedPlace.googlePlaceId, lat: clickedPlace.lat, lng: clickedPlace.lng,
        addedAt: serverTimestamp(),
        ...(clickedPlace.rating !== undefined && { rating: clickedPlace.rating }),
        ...(clickedPlace.userRatingsTotal !== undefined && { userRatingsTotal: clickedPlace.userRatingsTotal }),
        ...(mainPhotoUrl && { mainPhotoUrl: mainPhotoUrl }),
        ...(clickedPlace.openingHours && clickedPlace.openingHours.weekday_text && { openingHoursText: clickedPlace.openingHours.weekday_text }),
      };
      await addDoc(stationStoresRef, storeData);
      setFeedbackMessage(`店家已成功加入 ${selectedStation.name} 的最愛清單！`); setActiveInfoWindow(clickedPlace.googlePlaceId);
    } catch (error) { console.error("加入個人清單失敗:", error); setFeedbackMessage(`加入失敗: ${error.message}`); }
    finally { setIsAddingToList(false); }
  };

  const handleRemoveFromMyList = async (storeToRemove) => {
    // ... (此函式邏輯如前一個版本所示，包含檢查、deleteDoc) ...
    if (!user || !storeToRemove || !storeToRemove.id || !selectedStation || !selectedStation.id) {
      setFeedbackMessage("錯誤：無法移除店家，資訊不完整。"); return;
    }
    if (isRemovingFromList) return;
    setIsRemovingFromList(true); setFeedbackMessage(`正在從 ${selectedStation.name} 最愛中移除 ${storeToRemove.name}...`);
    try {
      const storeDocRef = doc(db, `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`, storeToRemove.id);
      await deleteDoc(storeDocRef);
      setFeedbackMessage(`${storeToRemove.name} 已成功從 ${selectedStation.name} 的最愛清單中移除！`);
      if (clickedPlace && clickedPlace.id === storeToRemove.id) { /* 可選：關閉資訊 */ }
    } catch (error) { console.error("從個人清單移除失敗:", error); setFeedbackMessage(`移除失敗: ${error.message}`); }
    finally { setIsRemovingFromList(false); }
  };

  // 創建單站分享連結 (如果還需要的話)
  const handleCreateSingleStationShareLink = async () => {
    if (!user || !selectedStation || myFavoriteStores.length === 0) {
      setFeedbackMessage("錯誤：需要先選擇捷運站並有收藏店家才能分享。"); return;
    }
    if (isCreatingShareLink) return;
    setIsCreatingShareLink(true); setGeneratedShareLink(''); setFeedbackMessage("正在生成單站分享連結...");
    try {
      const storesToShare = myFavoriteStores.map(store => ({ /* ... simplified store data ... */
        name: store.name, address: store.address, googlePlaceId: store.googlePlaceId,
        lat: store.lat, lng: store.lng, rating: store.rating, mainPhotoUrl: store.mainPhotoUrl,
      }));
      const shareData = {
        originalUserId: user.uid, originalUserName: user.displayName || user.email || "一位使用者",
        originalStationId: selectedStation.id, originalStationName: selectedStation.name,
        stores: storesToShare, createdAt: serverTimestamp(),
      };
      // 注意：這裡使用的是 publicSharedViews (單站分享的集合)
      const publicSharesRef = collection(db, "publicSharedViews");
      const docRef = await addDoc(publicSharesRef, shareData);
      const shareLink = `${window.location.origin}/share/${docRef.id}`; // 使用 /share/ 路由
      setGeneratedShareLink(shareLink);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink); setFeedbackMessage("單站分享連結已生成並複製！");
      } else { setFeedbackMessage("單站分享連結已生成！"); console.log("單站分享連結:", shareLink); }
    } catch (error) { console.error("創建單站分享連結失敗:", error); setFeedbackMessage(`生成單站分享連結失敗: ${error.message}`); }
    finally { setIsCreatingShareLink(false); }
  };
  
  // 創建全站收藏分享連結
  const handleCreateFullMapShareLink = async () => {
    if (!user) {
      setFeedbackMessage("錯誤：需要登入才能分享您的所有收藏。"); return;
    }
    if (isCreatingShareLink) return;
    setIsCreatingShareLink(true); setGeneratedShareLink(''); setFeedbackMessage("正在生成全站收藏分享連結...");
    try {
      const allStationsFavoritesData = {};
      let totalStoresSharedCount = 0;
      for (const station of stationData) {
        if (!station || !station.id) continue;
        const stationFavoritesRef = collection(db, `users/${user.uid}/favoriteStoresByStation/${station.id}/stores`);
        const q = query(stationFavoritesRef, limit(MAX_FAVORITE_STORES_PER_STATION));
        const querySnapshot = await getDocs(q);
        const storesForThisStation = [];
        querySnapshot.forEach((doc) => {
          const store = doc.data();
          storesForThisStation.push({
            name: store.name, address: store.address, googlePlaceId: store.googlePlaceId,
            lat: store.lat, lng: store.lng, rating: store.rating, mainPhotoUrl: store.mainPhotoUrl,
          });
        });
        if (storesForThisStation.length > 0) {
          allStationsFavoritesData[station.id] = storesForThisStation;
          totalStoresSharedCount += storesForThisStation.length;
        }
      }
      if (totalStoresSharedCount === 0) {
        setFeedbackMessage("您目前沒有任何捷運站收藏可以分享。"); setIsCreatingShareLink(false); return;
      }
      const shareData = {
        originalUserId: user.uid, originalUserName: user.displayName || user.email || "一位熱心的分享者",
        allStationsFavorites: allStationsFavoritesData, createdAt: serverTimestamp(),
      };
      const publicFullMapsRef = collection(db, "publicSharedFullMaps");
      const docRef = await addDoc(publicFullMapsRef, shareData);
      const shareLink = `${window.location.origin}/sharemap/${docRef.id}`; // 使用 /sharemap/ 路由
      setGeneratedShareLink(shareLink);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink); setFeedbackMessage("全站收藏分享連結已生成並複製！");
      } else { setFeedbackMessage("全站收藏分享連結已生成！"); console.log("全站收藏分享連結:", shareLink); }
    } catch (error) { console.error("創建全站收藏分享連結失敗:", error); setFeedbackMessage(`生成全站收藏分享連結失敗: ${error.message}`); }
    finally { setIsCreatingShareLink(false); }
  };

  const mapCenter = selectedStation?.realCoords || (stationData.length > 0 && stationData[0].realCoords) || { lat: 22.639065, lng: 120.302104 };
  const mapOptions = { clickableIcons: true, disableDefaultUI: false };

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        {mapViewActive && (
          <button onClick={handleBackToRouteMap} className="back-button">
            返回路線圖
          </button>
        )}
        <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
        <div className="header-actions"> {/* Wrapper for actions */}
          {feedbackMessage && <span className="feedback-message">{feedbackMessage}</span>}
          {generatedShareLink && !isCreatingShareLink && (
            <div className="generated-share-link">
              <p>分享連結:</p>
              <input type="text" value={generatedShareLink} readOnly />
              <button onClick={() => navigator.clipboard?.writeText(generatedShareLink).then(() => setFeedbackMessage("連結已複製!"))}>複製</button>
            </div>
          )}
          {user && (
            <div className="user-buttons"> {/* Wrapper for user buttons */}
              <button
                onClick={handleCreateFullMapShareLink}
                disabled={isCreatingShareLink}
                className="share-list-button"
                title="分享我的所有捷運站收藏"
              >
                {isCreatingShareLink && generatedShareLink.includes('/sharemap/') ? "生成中..." : "分享我的地圖"}
              </button>
              <button onClick={handleLogout} className="logout-button">登出</button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <h2>捷運站點</h2>
          <ul>
            {stationData.map(station => (
              <li key={station.id} onClick={() => handleStationClick(station)}
                  className={selectedStation?.id === station.id ? 'active-station' : ''}
              >
                {station.name} ({station.id})
              </li>
            ))}
          </ul>
          <hr />

          {selectedStation ? (
            <>
              <div className="sidebar-section-header">
                <h2>{selectedStation.name} 的最愛 ({myFavoriteStores.length}/{MAX_FAVORITE_STORES_PER_STATION})</h2>
                {myFavoriteStores.length > 0 && user && (
                  <button
                    onClick={handleCreateSingleStationShareLink} // 單站分享
                    disabled={isCreatingShareLink}
                    className="share-list-button small-share-button"
                    title={`分享 ${selectedStation.name} 的最愛列表`}
                  >
                    {isCreatingShareLink && generatedShareLink.includes('/share/') && !generatedShareLink.includes('/sharemap/') ? "生成中..." : "分享此站"}
                  </button>
                )}
              </div>
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
              ) : ( <p>此捷運站尚無最愛店家。</p> )}
            </>
          ) : mapViewActive ? ( <p>請先從左側列表選擇一個捷運站來查看收藏。</p> )
            : ( <p>點選捷運站以查看該站點的收藏店家。</p> )}
          <hr />

          {/* 店家詳細資訊 (側邊欄，唯讀) */}
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
          {!mapViewActive ? (
            <div className="krtc-map-container">
              <img src="/img/krtc-map.png" alt="高雄捷運路線圖" className="krtc-map-image"/>
              {stationData.map((station) => { const stationLineColor = lineColors[station.lines[0]] || '#555'; return (<button key={station.id} className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''}`} style={{left: station.coords.x, top: station.coords.y, backgroundColor: '#FFFFFF', borderColor: stationLineColor}} onClick={() => handleStationClick(station)} onMouseEnter={() => setHoveredStation(station.id)} onMouseLeave={() => setHoveredStation(null)} title={station.name}><span className="station-id-tooltip">{station.id}</span></button>);})}
            </div>
          ) : googleMapsApiKey ? ( // 確保金鑰存在才渲染地圖相關
            <GoogleMap
              mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={defaultZoom}
              onLoad={onLoad} onUnmount={onUnmount} onClick={handleMapPoiClick} options={mapOptions}
            >
              {selectedStation && (<Marker position={selectedStation.realCoords} title={selectedStation.name} />)}
              {selectedStation && myFavoriteStores.map(store => (<Marker key={store.googlePlaceId} position={{ lat: store.lat, lng: store.lng }} title={store.name} icon={{url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png"}} onClick={() => handleFavoriteStoreMarkerClick(store)}/> ))}
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
                    {/* 顯示今日營業時間 (無論上面是否有即時狀態，都可作為補充) */}
                    {(clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) && (
                      <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                        <strong>今日時段:</strong>
                        <span style={{ marginLeft: '5px' }}>
                          {(() => {
                            const openingHoursSource = clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText;
                            if (openingHoursSource && Array.isArray(openingHoursSource)) {
                              const today = new Date().getDay(); // 0 = 星期日, 1 = 星期一, ...
                              const todayIndex = (today === 0) ? 6 : today - 1; // Google API weekday_text: Monday is 0, Sunday is 6
                              
                              let todayText = '';
                              if (clickedPlace.openingHours && clickedPlace.openingHours.periods) { // 優先使用 periods (更精確)
                                const now = new Date();
                                const currentDayPeriods = clickedPlace.openingHours.periods.filter(p => p.open && p.open.day === today);
                                if (currentDayPeriods.length > 0) {
                                   todayText = currentDayPeriods.map(p => {
                                    const openTime = `${String(p.open.hours).padStart(2, '0')}:${String(p.open.minutes).padStart(2, '0')}`;
                                    if (p.close) {
                                      const closeTime = `${String(p.close.hours).padStart(2, '0')}:${String(p.close.minutes).padStart(2, '0')}`;
                                      return `${openTime} – ${closeTime}`;
                                    }
                                    return `${openTime} – (營業中)`; // 24小時營業且當下是營業日
                                  }).join(', ');
                                } else if (clickedPlace.openingHours.open_now === false && openingHoursSource[todayIndex] && (openingHoursSource[todayIndex].includes("休息") || openingHoursSource[todayIndex].includes("Closed"))) {
                                    todayText = "休息";
                                } else if (openingHoursSource[todayIndex]) { // Fallback to weekday_text if periods don't cover it but weekday_text exists
                                    todayText = openingHoursSource[todayIndex].substring(openingHoursSource[todayIndex].indexOf(':') + 1).trim();
                                } else {
                                    todayText = "資訊不詳";
                                }

                              } else if (openingHoursSource[todayIndex]) { // Fallback to weekday_text if no live openingHours object
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
                    {myFavoriteStores.some(s => s.googlePlaceId === clickedPlace.googlePlaceId) ? (
                      <button 
                        onClick={() => { 
                          const storeInList = myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId); 
                          if (storeInList) handleRemoveFromMyList(storeInList);
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
          ) : ( <div>{!googleMapsApiKey && <p>Google Maps API 金鑰未設定或無效。地圖功能將不可用。</p>}</div> )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;