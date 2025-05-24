// src/pages/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase'; // 引入 db
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore"; // 引入 Firestore 相關函式
import { stationData, lineColors } from '../data/stations';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './HomePage.css';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultZoom = 16;
const libraries = ["places"]; // 關鍵：告訴 LoadScript 我們要使用 Places API
const MAX_FAVORITE_STORES = 15; // 清單上限

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [clickedPlace, setClickedPlace] = useState(null); // 儲存被點擊的 POI 的 Place Details
  const [showPlaceInfo, setShowPlaceInfo] = useState(false); // 控制 InfoWindow 或詳細資訊面板的顯示
  const [mapInstance, setMapInstance] = useState(null); // 儲存 map instance
  const [isAddingToList, setIsAddingToList] = useState(false); // 防止重複點擊的狀態
  const [feedbackMessage, setFeedbackMessage] = useState(''); // 用於顯示操作回饋

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef(null); // 用來獲取 map instance

  const onLoad = useCallback(function callback(map) {
    setMapInstance(map); // 儲存 map instance
    mapRef.current = map; // 也存到 ref
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

  // 清除回饋訊息的 timeout
  useEffect(() => {
    let timer;
    if (feedbackMessage) {
      timer = setTimeout(() => {
        setFeedbackMessage('');
      }, 3000); // 3 秒後清除訊息
    }
    return () => clearTimeout(timer);
  }, [feedbackMessage]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      // App.js 會處理導向
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const handleStationClick = (station) => {
    if (station.realCoords) {
      setSelectedStation(station);
      setMapViewActive(true);
      setClickedPlace(null); // 切換站點時清除之前點擊的店家資訊
      setShowPlaceInfo(false);
      setFeedbackMessage(''); // 切換站點時清除舊訊息
    } else {
      console.warn(`站點 ${station.name} 缺少 realCoords (經緯度) 資料，無法顯示地圖。`);
    }
  };

  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null);
    setClickedPlace(null);
    setShowPlaceInfo(false);
    setFeedbackMessage('');
  };

  // 當 Google Map 上的 POI (Point of Interest) 被點擊時觸發
  const handleMapPoiClick = (event) => {
    // event.stop(); // 可選，如果 Google Maps 在點擊 POI 時有預設行為 (例如打開它自己的 InfoWindow)
    const placeId = event.placeId;
    console.log("POI Clicked, Place ID:", placeId);
    

    if (!placeId || !mapInstance) {
      console.warn("Place ID or Map instance is not available.");
      return;
    }

    const placesService = new window.google.maps.places.PlacesService(mapInstance);
    placesService.getDetails({
      placeId: placeId,
      // 指定你想獲取的欄位，這樣可以控制費用並只獲取需要的資料
      fields: [
        'name',
        'formatted_address',
        'geometry.location', // 包含 lat, lng
        'place_id',
        'rating',
        'user_ratings_total',
        'photos', // 獲取照片
        'opening_hours', // 營業時間
        'types', // 店家類型
        'website',
        'formatted_phone_number'
      ]
    }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        console.log("Place Details:", place);
        setClickedPlace({
          name: place.name,
          address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          googlePlaceId: place.place_id,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photos: place.photos, // 是一個陣列
          openingHours: place.opening_hours,
          types: place.types,
          website: place.website,
          phoneNumber: place.formatted_phone_number
        });
        setShowPlaceInfo(true);
        setFeedbackMessage(''); // 清除之前的訊息
      } else {
        console.error("Failed to get place details:", status, place);
        setClickedPlace(null);
        setShowPlaceInfo(false);
      }
    });
  };

  const handleClosePlaceInfo = () => {
    setShowPlaceInfo(false);
    //setClickedPlace(null);
  };

  const handleAddToMyList = async () => {
    if (!user || !clickedPlace || !selectedStation) {
      setFeedbackMessage("錯誤：無法加入清單，請確認已登入並選擇店家及捷運站。");
      return;
    }
    if (isAddingToList) return; // 防止重複提交

    setIsAddingToList(true);
    setFeedbackMessage("正在加入清單...");

    try {
      const userListRef = collection(db, `users/${user.uid}/myFavoriteStores`);

      // 1. 檢查清單是否已滿
      const currentListQuery = query(userListRef);
      const currentListSnapshot = await getDocs(currentListQuery);
      if (currentListSnapshot.docs.length >= MAX_FAVORITE_STORES) {
        setFeedbackMessage(`您的清單已滿 (最多 ${MAX_FAVORITE_STORES} 家)，無法新增。`);
        setIsAddingToList(false);
        return;
      }

      // 2. 檢查店家是否已存在於清單中 (使用 googlePlaceId)
      const q = query(userListRef, where("googlePlaceId", "==", clickedPlace.googlePlaceId), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setFeedbackMessage("此店家已在您的清單中。");
        setIsAddingToList(false);
        return;
      }

      // 3. 準備要儲存的店家資料
      const storeData = {
        name: clickedPlace.name || 'N/A',
        address: clickedPlace.address || 'N/A',
        googlePlaceId: clickedPlace.googlePlaceId,
        lat: clickedPlace.lat,
        lng: clickedPlace.lng,
        stationId: selectedStation.id, // 標記是從哪個站點發現的
        addedAt: serverTimestamp(),
        // 可選欄位，確保它們存在才加入
        ...(clickedPlace.rating && { rating: clickedPlace.rating }),
        ...(clickedPlace.userRatingsTotal && { userRatingsTotal: clickedPlace.userRatingsTotal }),
        ...(clickedPlace.types && { types: clickedPlace.types }),
        ...(clickedPlace.website && { website: clickedPlace.website }),
        ...(clickedPlace.phoneNumber && { phoneNumber: clickedPlace.phoneNumber }),
        // 處理照片：儲存第一張照片的 URL (如果存在)
        ...(clickedPlace.photos && clickedPlace.photos.length > 0 && {
          // 注意：getURL() 可能需要額外參數或處理，此處為簡化
          // 實際上，Places API photos 是一個物件，包含 getUrl 方法
          // 你可能需要呼叫 photo.getUrl({maxWidth: 400, maxHeight: 400})
          // 為了簡單起見，我們先假設 photos[0] 有一個可直接用的 URL，或者你需要進一步處理
          // photoReference: clickedPlace.photos[0].photo_reference // 儲存 reference 可能更好
          // 或直接使用 getUrl 獲取一個 URL，但這會產生一個 Google 的 URL
          mainPhotoUrl: clickedPlace.photos[0].getUrl({maxWidth: 400}) // 獲取一個中等大小的圖片 URL
        }),
      };

      await addDoc(userListRef, storeData);
      setFeedbackMessage("店家已成功加入您的最愛清單！");
      // setShowPlaceInfo(false); // 可選：加入成功後關閉資訊視窗
      // setClickedPlace(null); // 可選：清除已選店家

    } catch (error) {
      console.error("加入個人清單失敗:", error);
      setFeedbackMessage(`加入失敗: ${error.message}`);
    } finally {
      setIsAddingToList(false);
    }
  };

  const mapCenter = selectedStation?.realCoords || { lat: 22.639065, lng: 120.302104 };

  // Google Map options
  const mapOptions = {
    clickableIcons: true, // 非常重要：設置為 true 才能讓 POI 可點擊並觸發 onClick 事件
    disableDefaultUI: false, // 可以保留預設 UI，或者設為 true 再自訂
    // 你可以進一步客製化地圖樣式等
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
      {mapViewActive && clickedPlace && showPlaceInfo && (
        <div className="place-details-sidebar">
          <h3>{clickedPlace.name}</h3>
          <p>地址: {clickedPlace.address}</p>
          {clickedPlace.rating !== undefined && (
            <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 0} 則評論)</p>
          )}
          {clickedPlace.openingHours && (
            <div>
              <p>營業狀態: {clickedPlace.openingHours.isOpen && typeof clickedPlace.openingHours.isOpen === 'function'
                ? (clickedPlace.openingHours.isOpen() ? "營業中" : "休息中")
                : "未知"}</p>
            </div>
          )}
          <button
            onClick={handleAddToMyList}
            disabled={isAddingToList}
            style={{ marginTop: '10px' }}
            className="add-to-list-button"
          >
            {isAddingToList ? "加入中..." : "加入我的最愛"}
          </button>
          <button onClick={handleClosePlaceInfo} style={{ marginTop: '10px', marginLeft: '5px' }}>
            關閉資訊
          </button>
        </div>
      )}
    </aside>

    <div className="map-area-container">
      {!mapViewActive ? (
        <div className="krtc-map-container">
          <img src="img/krtc-map.png" alt="高雄捷運路線圖" className="krtc-map-image" />
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
        <LoadScript
          googleMapsApiKey={googleMapsApiKey}
          libraries={libraries}
          loadingElement={<div>地圖載入中...</div>}
        >
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

            {clickedPlace && showPlaceInfo && (
              <InfoWindow
                position={{ lat: clickedPlace.lat, lng: clickedPlace.lng }}
                onCloseClick={handleClosePlaceInfo}
              >
                <div className="place-infowindow">
                  <h4>{clickedPlace.name}</h4>
                  <p>{clickedPlace.address?.substring(0, 20)}...</p>
                  {clickedPlace.rating !== undefined && <p>評分: {clickedPlace.rating} / 5</p>}
                  <button
                    onClick={handleAddToMyList}
                    disabled={isAddingToList}
                    className="add-to-list-button"
                  >
                    {isAddingToList ? "加入中..." : "加入我的最愛"}
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
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