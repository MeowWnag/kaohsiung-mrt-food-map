// src/pages/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase'; // 引入 db
// import { collection, addDoc, serverTimestamp } from "firebase/firestore"; // 稍後加入清單時會用到
import { stationData, lineColors } from '../data/stations';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './HomePage.css';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultZoom = 16;
const libraries = ["places"]; // 關鍵：告訴 LoadScript 我們要使用 Places API

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [clickedPlace, setClickedPlace] = useState(null); // 儲存被點擊的 POI 的 Place Details
  const [showPlaceInfo, setShowPlaceInfo] = useState(false); // 控制 InfoWindow 或詳細資訊面板的顯示
  const [mapInstance, setMapInstance] = useState(null); // 儲存 map instance

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
    } else {
      console.warn(`站點 ${station.name} 缺少 realCoords (經緯度) 資料，無法顯示地圖。`);
    }
  };

  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null);
    setClickedPlace(null);
    setShowPlaceInfo(false);
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
          placeId: place.place_id,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photos: place.photos, // 是一個陣列
          openingHours: place.opening_hours,
          types: place.types,
          website: place.website,
          phoneNumber: place.formatted_phone_number
        });
        setShowPlaceInfo(true);
      } else {
        console.error("Failed to get place details:", status, place);
        setClickedPlace(null);
        setShowPlaceInfo(false);
      }
    });
  };

  const handleClosePlaceInfo = () => {
    setShowPlaceInfo(false);
    setClickedPlace(null);
  };

  // const handleAddToMyList = async () => {
  //   if (!user || !clickedPlace || !selectedStation) {
  //     console.error("無法加入清單：使用者未登入、店家資料不完整或未選擇捷運站");
  //     return;
  //   }
  //   // 這裡將是階段三 Firestore 新增邏輯
  //   console.log("準備將店家加入清單:", clickedPlace, "關聯站點:", selectedStation.id);
  //   // try {
  //   //   const userListRef = collection(db, `users/${user.uid}/myFavoriteStores`);
  //   //   await addDoc(userListRef, {
  //   //     ...clickedPlace, // 可以選擇只儲存必要的欄位
  //   //     stationId: selectedStation.id, // 標記是從哪個站點發現的
  //   //     addedAt: serverTimestamp()
  //   //   });
  //   //   console.log("店家已成功加入個人清單!");
  //   //   setShowPlaceInfo(false); // 可以選擇關閉 InfoWindow
  //   // } catch (error) {
  //   //   console.error("加入個人清單失敗:", error);
  //   // }
  // };

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
          <hr />
          {/* 之後可以考慮將點擊的店家資訊顯示在這裡，而不是 InfoWindow */}
          {mapViewActive && clickedPlace && showPlaceInfo && (
            <div className="place-details-sidebar">
              <h3>{clickedPlace.name}</h3>
              <p>地址: {clickedPlace.address}</p>
              {clickedPlace.rating && <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal} 則評論)</p>}
              {clickedPlace.openingHours && (
                <div>
                  <p>營業狀態: {clickedPlace.openingHours.isOpen() ? "營業中" : "休息中"}</p>
                  {/* 你可以進一步解析 openingHours.weekday_text 來顯示詳細營業時間 */}
                </div>
              )}
              {/* <button onClick={handleAddToMyList} style={{marginTop: '10px'}}>
                加入我的清單
              </button> */}
              <button onClick={handleClosePlaceInfo} style={{marginTop: '10px', marginLeft: '5px'}}>
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
              libraries={libraries} // 載入 Places library
              loadingElement={<div>地圖載入中...</div>}
            >
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={defaultZoom}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapPoiClick} // 關鍵：監聽地圖上的 POI 點擊
                options={mapOptions} // 應用地圖選項
              >
                {selectedStation && (
                  <Marker position={selectedStation.realCoords} title={selectedStation.name} />
                )}

                {/* InfoWindow 來顯示被點擊的 POI 資訊 */}
                {clickedPlace && showPlaceInfo && (
                  <InfoWindow
                    position={{ lat: clickedPlace.lat, lng: clickedPlace.lng }}
                    onCloseClick={handleClosePlaceInfo}
                  >
                    <div className="place-infowindow">
                      <h4>{clickedPlace.name}</h4>
                      <p>{clickedPlace.address}</p>
                      {clickedPlace.rating && <p>評分: {clickedPlace.rating} / 5</p>}
                      {/* <button onClick={handleAddToMyList}>加入我的清單</button> */}
                    </div>
                  </InfoWindow>
                )}
                {/* 未來使用者清單中的店家也可以用 Marker 標記出來 */}
              </GoogleMap>
            </LoadScript>
          ) : (
            <div>
              { !googleMapsApiKey && <p>Google Maps API 金鑰未設定或無效。</p> }
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;