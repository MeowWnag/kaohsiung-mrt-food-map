import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { stationData, lineColors } from '../data/stations';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { ArrowLeft, MapPin, Star, Clock, Phone, Globe, Copy, Share2, LogOut, Heart, Trash2, Plus, Navigation } from 'lucide-react';
import StationList from '../components/StationList';
import FavoriteStores from '../components/FavoriteStores';
import PlaceDetails from '../components/PlaceDetails';
import ShareLink from '../components/ShareLink';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultZoom = 16;
const MAX_FAVORITE_STORES_PER_STATION = 15;

const HomePage = ({ user }) => {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [clickedPlace, setClickedPlace] = useState(null);
  const [showPlaceInfo, setShowPlaceInfo] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false); // 新增地圖載入狀態
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isRemovingFromList, setIsRemovingFromList] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [myFavoriteStores, setMyFavoriteStores] = useState([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [generatedShareLink, setGeneratedShareLink] = useState('');

  const mapRef = useRef(null);

  // 修改 onLoad 函數以確保地圖完全載入
  const onLoad = useCallback(function callback(map) {
    setMapInstance(map);
    mapRef.current = map;
    console.log("Google Map instance loaded.");
    // 等待地圖完全載入後再設置狀態
    setTimeout(() => {
      setMapLoaded(true);
    }, 500); // 給予足夠時間讓地圖和 bounds 完全載入
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMapInstance(null);
    setMapLoaded(false); // 重置載入狀態
  }, []);

  useEffect(() => {
    let timer;
    if (feedbackMessage) {
      timer = setTimeout(() => setFeedbackMessage(''), 3000);
    }
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  useEffect(() => {
    if (user && selectedStation && selectedStation.id) {
      const stationFavoritesRef = collection(db, `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`);
      const q = query(stationFavoritesRef);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const stores = [];
        querySnapshot.forEach((doc) => stores.push({ id: doc.id, ...doc.data() }));
        setMyFavoriteStores(stores);
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
      setGeneratedShareLink('');
      setMapLoaded(false); // 重置載入狀態，等待新的地圖載入
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
    setHoveredStation(null);
  };

  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current || !selectedStation) return;

    setActiveInfoWindow(null);
    setClickedPlace(null);
    setShowPlaceInfo(false);

    const placesService = new window.google.maps.places.PlacesService(mapRef.current);
    placesService.getDetails({
      placeId,
      fields: ['name', 'formatted_address', 'geometry.location', 'place_id', 'rating', 'user_ratings_total', 'photos', 'opening_hours', 'types', 'website', 'formatted_phone_number'],
    }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        const newClickedPlace = {
          name: place.name || '未知店家',
          address: place.formatted_address || '地址不詳',
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
          googlePlaceId: place.place_id,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photos: place.photos ? place.photos.map(p => ({ getUrl: (options) => p.getUrl(options), photo_reference: p.photo_reference })) : [],
          openingHours: place.opening_hours,
          types: place.types,
          website: place.website,
          phoneNumber: place.formatted_phone_number,
        };
        if (newClickedPlace.name && newClickedPlace.lat && newClickedPlace.lng && newClickedPlace.googlePlaceId) {
          setClickedPlace(newClickedPlace);
          setShowPlaceInfo(true);
          setTimeout(() => setActiveInfoWindow(newClickedPlace.googlePlaceId), 50);
          setFeedbackMessage('');
        } else {
          setFeedbackMessage('店家資訊不完整，無法顯示詳細資訊');
        }
      } else {
        setFeedbackMessage('無法獲取店家詳細資訊');
      }
    });
  };

  const handleFavoriteStoreMarkerClick = (store) => {
    setActiveInfoWindow(null);
    setClickedPlace({ ...store });
    setShowPlaceInfo(true);

    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }

    if (mapRef.current && window.google && window.google.maps && window.google.maps.places) {
      const placesService = new window.google.maps.places.PlacesService(mapRef.current);
      placesService.getDetails({
        placeId: store.googlePlaceId,
        fields: ['name', 'formatted_address', 'geometry.location', 'place_id', 'rating', 'user_ratings_total', 'photos', 'opening_hours', 'types', 'website', 'formatted_phone_number'],
      }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          const updatedStoreDetails = {
            ...store,
            name: place.name || store.name,
            address: place.formatted_address || store.address,
            lat: place.geometry?.location?.lat() || store.lat,
            lng: place.geometry?.location?.lng() || store.lng,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            photos: place.photos ? place.photos.map(p => ({ getUrl: (options) => p.getUrl(options), photo_reference: p.photo_reference })) : (store.photos || []),
            openingHours: place.opening_hours,
            types: place.types,
            website: place.website,
            phoneNumber: place.formatted_phone_number,
          };
          setClickedPlace(updatedStoreDetails);
          setTimeout(() => setActiveInfoWindow(store.googlePlaceId), 50);
        } else {
          setFeedbackMessage(`無法更新 ${store.name} 的即時資訊，顯示庫存資料。`);
          setTimeout(() => setActiveInfoWindow(store.googlePlaceId), 50);
        }
      });
    } else {
      setTimeout(() => setActiveInfoWindow(store.googlePlaceId), 100);
    }
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
      const stationStoresRef = collection(db, `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`);
      if (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION) {
        setFeedbackMessage(`此捷運站 (${selectedStation.name}) 的最愛清單已滿。`);
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
      const mainPhotoUrl = clickedPlace.photos?.length > 0 ? clickedPlace.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 }) : null;
      const storeData = {
        name: clickedPlace.name || 'N/A',
        address: clickedPlace.address || 'N/A',
        googlePlaceId: clickedPlace.googlePlaceId,
        lat: clickedPlace.lat,
        lng: clickedPlace.lng,
        addedAt: serverTimestamp(),
        ...(clickedPlace.rating !== undefined && { rating: clickedPlace.rating }),
        ...(clickedPlace.userRatingsTotal !== undefined && { userRatingsTotal: clickedPlace.userRatingsTotal }),
        ...(mainPhotoUrl && { mainPhotoUrl }),
        ...(clickedPlace.openingHours?.weekday_text && { openingHoursText: clickedPlace.openingHours.weekday_text }),
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

  const handleRemoveFromMyList = async (storeToRemove) => {
    if (!user || !storeToRemove || !storeToRemove.id || !selectedStation || !selectedStation.id) {
      setFeedbackMessage("錯誤：無法移除店家，資訊不完整。");
      return;
    }
    if (isRemovingFromList) return;
    setIsRemovingFromList(true);
    setFeedbackMessage(`正在從 ${selectedStation.name} 最愛中移除 ${storeToRemove.name}...`);
    try {
      const storeDocRef = doc(db, `users/${user.uid}/favoriteStoresByStation/${selectedStation.id}/stores`, storeToRemove.id);
      await deleteDoc(storeDocRef);
      setFeedbackMessage(`${storeToRemove.name} 已成功從 ${selectedStation.name} 的最愛清單中移除！`);
    } catch (error) {
      console.error("從個人清單移除失敗:", error);
      setFeedbackMessage(`移除失敗: ${error.message}`);
    } finally {
      setIsRemovingFromList(false);
    }
  };

  const mapCenter = selectedStation?.realCoords || { lat: 22.639065, lng: 120.302104 };
  const mapOptions = { clickableIcons: true, disableDefaultUI: false };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Section */}
            <div className="flex items-center space-x-4">
              {mapViewActive && (
                <button
                  onClick={handleBackToRouteMap}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回路線圖
                </button>
              )}
              <div className="flex items-center space-x-2">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="使用者照片"
                    className="w-8 h-8 rounded-full object-cover border-2 border-blue-500"
                    onError={(e) => {
                      // 如果照片載入失敗，回到預設圖示
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-8 h-8 bg-gradient-to-r from-blue-500 to-orange-500 rounded-full flex items-center justify-center ${user?.photoURL ? 'hidden' : ''}`}
                >
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-semibold text-gray-900">
                  歡迎, {user ? user.displayName || user.email : '使用者'}!
                </h1>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {user && (
                <div className="flex items-center space-x-2">
                  <ShareLink
                    user={user}
                    selectedStation={selectedStation}
                    myFavoriteStores={myFavoriteStores}
                    isCreatingShareLink={isCreatingShareLink}
                    setIsCreatingShareLink={setIsCreatingShareLink}
                    setGeneratedShareLink={setGeneratedShareLink}
                    setFeedbackMessage={setFeedbackMessage}
                  />
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 hover:border-red-600 transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Message */}
          {feedbackMessage && (
            <div className="py-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
                {feedbackMessage}
              </div>
            </div>
          )}

          {/* Share Link Display */}
          {generatedShareLink && !isCreatingShareLink && (
            <div className="py-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-2">分享連結:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={generatedShareLink}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => navigator.clipboard?.writeText(generatedShareLink).then(() => setFeedbackMessage("連結已複製!"))}
                    className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    複製
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="w-80 bg-white shadow-lg border-r border-gray-200 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Station List */}
            <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                捷運站點
              </h2>
              <StationList
                stationData={stationData}
                selectedStation={selectedStation}
                handleStationClick={handleStationClick}
              />
            </div>

            {/* Favorite Stores */}
            {selectedStation && (
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-pink-600" />
                  我的最愛
                </h2>
                <FavoriteStores
                  user={user}
                  selectedStation={selectedStation}
                  myFavoriteStores={myFavoriteStores}
                  setMyFavoriteStores={setMyFavoriteStores}
                  handleSidebarFavoriteStoreClick={handleFavoriteStoreMarkerClick}
                  handleRemoveFromMyList={handleRemoveFromMyList}
                  isRemovingFromList={isRemovingFromList}
                  setFeedbackMessage={setFeedbackMessage}
                />
              </div>
            )}

            {/* Place Details */}
            {mapViewActive && clickedPlace && selectedStation && (
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Star className="w-5 h-5 mr-2 text-green-600" />
                  店家詳情
                </h2>
                <PlaceDetails
                  clickedPlace={clickedPlace}
                  handleClosePlaceInfo={() => setActiveInfoWindow(null)}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <div className="flex-1 relative">
          {!mapViewActive ? (
            <div className="relative h-full bg-gray-50 flex items-center justify-center">
              <div className="relative max-w-4xl max-h-full">
                <img 
                  src="/img/krtc-map.png" 
                  alt="高雄捷運路線圖" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
                {stationData.map((station) => {
                  const stationLineColor = lineColors[station.lines[0]] || '#555';
                  return (
                    <button
                      key={station.id}
                      className={`absolute w-5 h-5 rounded-full border-2 transition-all duration-200 transform hover:scale-125 flex items-center justify-center text-xs font-bold ${
                        hoveredStation === station.id ? 'z-10 scale-125 shadow-lg' : ''
                      }`}
                      style={{ 
                        left: station.coords.x, 
                        top: station.coords.y, 
                        backgroundColor: '#FFFFFF', 
                        borderColor: stationLineColor,
                        color: stationLineColor
                      }}
                      onClick={() => handleStationClick(station)}
                      onMouseEnter={() => setHoveredStation(station.id)}
                      onMouseLeave={() => setHoveredStation(null)}
                      title={`${station.id} - ${station.name}`}
                    >
                      {station.id}
                      {hoveredStation === station.id && (
                        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-20">
                          {station.id} - {station.name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapPoiClick}
              options={mapOptions}
            >
              {/* 只在地圖完全載入後才渲染標記 */}
              {mapLoaded && (
                <>
                  {/* 捷運站標記 */}
                  {selectedStation && (
                    <Marker 
                      position={selectedStation.realCoords} 
                      title={selectedStation.name}
                      icon={{
                        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                          <svg width="48" height="60" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.25"/>
                              </filter>
                              <linearGradient id="stationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" />
                              </linearGradient>
                              <linearGradient id="innerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#F3F4F6;stop-opacity:1" />
                              </linearGradient>
                            </defs>
                            
                            <!-- 外圈陰影 -->
                            <circle cx="24" cy="24" r="20" fill="url(#stationGradient)" stroke="#FFFFFF" stroke-width="3" filter="url(#shadow)"/>
                            
                            <!-- 內圈 -->
                            <circle cx="24" cy="24" r="12" fill="url(#innerGradient)" stroke="#1E40AF" stroke-width="1"/>
                            
                            <!-- 捷運圖示 -->
                            <g transform="translate(24, 24)">
                              <!-- 車廂 -->
                              <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#1E40AF"/>
                              <!-- 車輪 -->
                              <circle cx="-5" cy="3" r="1.5" fill="#6B7280"/>
                              <circle cx="5" cy="3" r="1.5" fill="#6B7280"/>
                              <!-- 車窗 -->
                              <rect x="-6" y="-2" width="4" height="2" rx="0.5" fill="#FFFFFF"/>
                              <rect x="2" y="-2" width="4" height="2" rx="0.5" fill="#FFFFFF"/>
                            </g>
                            
                            <!-- 站名標籤 -->
                            <rect x="4" y="46" width="40" height="12" rx="6" fill="#1E40AF" filter="url(#shadow)"/>
                            <text x="24" y="54" font-family="Arial, Microsoft JhengHei, sans-serif" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
                              ${selectedStation.name.length > 6 ? selectedStation.name.substring(0, 5) + '...' : selectedStation.name}
                            </text>
                          </svg>
                        `),
                        scaledSize: new window.google.maps.Size(48, 60),
                        anchor: new window.google.maps.Point(24, 30)
                      }}
                    />
                  )}
                  
                  {/* 收藏店家標記 */}
                  {selectedStation && myFavoriteStores.map(store => (
                    <Marker
                      key={store.googlePlaceId}
                      position={{ lat: store.lat, lng: store.lng }}
                      title={store.name}
                      icon={{
                        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                          <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
                              </filter>
                            </defs>
                            <circle cx="18" cy="18" r="14" fill="#DC2626" stroke="white" stroke-width="3" filter="url(#shadow)"/>
                            <path d="M18 10l3 6h6l-5 4 2 6-6-3-6 3 2-6-5-4h6z" fill="white"/>
                          </svg>
                        `),
                        scaledSize: new window.google.maps.Size(36, 36),
                        anchor: new window.google.maps.Point(18, 18)
                      }}
                      onClick={() => handleFavoriteStoreMarkerClick(store)}
                    />
                  ))}
                </>
              )}
              
              {/* InfoWindow - 也只在地圖載入完成後顯示 */}
              {mapLoaded && 
               clickedPlace && 
               activeInfoWindow === clickedPlace.googlePlaceId && 
               selectedStation && 
               clickedPlace.name && 
               clickedPlace.lat && 
               clickedPlace.lng && 
               clickedPlace.googlePlaceId && (
                <InfoWindow
                  key={`${clickedPlace.googlePlaceId}-${activeInfoWindow}`}
                  position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }}
                  onCloseClick={() => setActiveInfoWindow(null)}
                >
                  <div className="max-w-sm p-2">
                    <h4 className="font-semibold text-gray-900 mb-2">{clickedPlace.name}</h4>
                    
                    {clickedPlace.photos?.length > 0 && (
                      <img
                        src={clickedPlace.photos[0].getUrl({ maxWidth: 400, maxHeight: 240 })}
                        alt={`${clickedPlace.name} 的照片`}
                        className="w-full h-28 object-cover rounded-lg mb-3 bg-gray-100"
                        style={{ imageRendering: 'auto' }}
                        loading="lazy"
                      />
                    )}
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400" />
                        <span>{clickedPlace.address && clickedPlace.address.length > 35 
                          ? clickedPlace.address.substring(0, 35) + '...' 
                          : clickedPlace.address || '地址不詳'}</span>
                      </div>
                      
                      {clickedPlace.rating !== undefined && (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 mr-2 text-yellow-400 fill-current" />
                          <span>{clickedPlace.rating} / 5</span>
                        </div>
                      )}
                      
                      {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-gray-400" />
                          <span className={`font-medium ${clickedPlace.openingHours.open_now ? 'text-green-600' : 'text-red-600'}`}>
                            {clickedPlace.openingHours.open_now ? '目前營業中' : '目前休息中'}
                          </span>
                        </div>
                      )}
                      
                      {clickedPlace.openingHours?.weekday_text && (
                        <div className="text-xs text-gray-500">
                          <strong>今日:</strong>
                          <span className="ml-1">
                            {(() => {
                              const today = new Date().getDay();
                              const todayIndex = today === 0 ? 6 : today - 1;
                              return clickedPlace.openingHours.weekday_text[todayIndex]
                                ?.substring(clickedPlace.openingHours.weekday_text[todayIndex].indexOf(':') + 1)
                                .trim() || '資訊不詳';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      {myFavoriteStores.some(s => s.googlePlaceId === clickedPlace.googlePlaceId) ? (
                        <button
                          onClick={() => {
                            const storeInList = myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId);
                            if (storeInList) handleRemoveFromMyList(storeInList);
                          }}
                          disabled={isRemovingFromList}
                          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {isRemovingFromList ? "移除中..." : "從最愛移除"}
                        </button>
                      ) : (
                        <button
                          onClick={handleAddToMyList}
                          disabled={isAddingToList || myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION}
                          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-400"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {isAddingToList ? "處理中..." : 
                           myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION ? "此站已滿" : 
                           `加入 ${selectedStation.name} 最愛`}
                        </button>
                      )}
                      
                      {clickedPlace.googlePlaceId && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedPlace.name || '')}&query_place_id=${clickedPlace.googlePlaceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <Globe className="w-4 h-4 mr-2" />
                          在 Google 地圖上查看
                        </a>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}

              {/* 地圖載入指示器 */}
              {!mapLoaded && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">地圖載入中...</p>
                  </div>
                </div>
              )}
            </GoogleMap>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;