// src/pages/SharePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // 你的 Firebase instance
import { stationData } from '../data/stations'; // 引入捷運站資料以獲取站名和經緯度
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'; // LoadScript 在 App.js

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};
const defaultZoom = 15;

const SharePage = () => {
  const { shareId } = useParams();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 地圖相關狀態
  const mapRef = useRef(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [clickedStoreForInfo, setClickedStoreForInfo] = useState(null);
  const [showPlaceInfo, setShowPlaceInfo] = useState(false);

  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const onLoad = useCallback(map => { mapRef.current = map; }, []);
  const onUnmount = useCallback(map => { mapRef.current = null; }, []);

  useEffect(() => {
    if (!googleMapsApiKey) {
      console.error("Google Maps API Key is missing for SharePage.");
    }
  }, [googleMapsApiKey]);

  // 根據 shareId 從 Firestore 獲取分享的數據
  useEffect(() => {
    if (shareId) {
      const fetchSharedData = async () => {
        setLoading(true);
        setError(null);
        try {
          const sharedDocRef = doc(db, 'publicSharedViews', shareId);
          const docSnap = await getDoc(sharedDocRef);

          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
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
    setActiveInfoWindow(null);
    setClickedStoreForInfo({ ...store });
    setShowPlaceInfo(true);

    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }

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
            ...store,
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
  
  const handleSidebarStoreClick = (store) => {
    handleMarkerClick(store);
  };

  const handleCloseInfoWindow = () => {
    setActiveInfoWindow(null);
  };

  const handleClosePlaceInfo = () => {
    setActiveInfoWindow(null);
    setShowPlaceInfo(false);
  };

  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current) {
      console.warn("Place ID or Map instance is not available for POI click in share page.");
      return;
    }

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
        
        if (newClickedPlace.name && newClickedPlace.lat && newClickedPlace.lng && newClickedPlace.googlePlaceId) {
          setClickedStoreForInfo(newClickedPlace);
          setShowPlaceInfo(true);
          
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

  // 載入狀態
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">讀取分享內容中...</p>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200"
          >
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  if (!sharedData || !sharedData.stationInfo) {
    const errorMessage = !sharedData ? '無法載入分享內容。' : `找不到捷運站 ${sharedData.originalStationName || sharedData.originalStationId} 的詳細地圖資訊。`;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {errorMessage}
          </div>
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200"
          >
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  const { originalUserName, originalStationName, stores, stationInfo } = sharedData;
  const mapCenter = stationInfo.realCoords || 
                    (stores && stores.length > 0 ? { lat: stores[0].lat, lng: stores[0].lng } : 
                    { lat: 22.639065, lng: 120.302104 });
  const mapOptions = { 
    clickableIcons: true,
    disableDefaultUI: false,
  };
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                <span className="text-blue-600">{originalUserName || '一位使用者'}</span> 分享的
                <span className="text-green-600">「{originalStationName || stationInfo.name}」</span>
                最愛店家
              </h1>
            </div>
            <Link 
              to="/" 
              className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium"
            >
              返回{siteName}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Store List Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              店家列表 
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {stores?.length || 0} 家
              </span>
            </h2>
          </div>

          {/* Store List */}
          <div className={`${showPlaceInfo ? 'flex-[0.6]' : 'flex-1'} overflow-y-auto`}>
            {stores && stores.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {stores.map((store, index) => (
                  <li 
                    key={store.googlePlaceId || index}
                    onClick={() => handleSidebarStoreClick(store)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition duration-150 ${
                      clickedStoreForInfo?.googlePlaceId === store.googlePlaceId 
                        ? 'bg-blue-50 border-r-4 border-blue-500' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {store.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {store.address}
                        </p>
                        {store.rating !== undefined && (
                          <div className="flex items-center mt-2">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < Math.floor(store.rating) 
                                      ? 'text-yellow-400' 
                                      : 'text-gray-300'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="ml-1 text-xs text-gray-600">{store.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">這個分享列表目前沒有店家</p>
              </div>
            )}
          </div>

          {/* Store Details Sidebar */}
          {clickedStoreForInfo && showPlaceInfo && (
            <div className="flex-[0.4] border-t border-gray-200 bg-white flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
                      {clickedStoreForInfo.name}
                    </h3>
                    <button 
                      onClick={handleClosePlaceInfo}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Photo */}
                  {clickedStoreForInfo.photos && clickedStoreForInfo.photos.length > 0 && (
                    <div className="mb-3">
                      <img 
                        src={clickedStoreForInfo.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })} 
                        alt={`${clickedStoreForInfo.name} 的照片`} 
                        className="w-full h-28 object-cover rounded-lg shadow-sm" 
                      />
                    </div>
                  )}
                  
                  {/* Address */}
                  <div className="mb-3">
                    <div className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm text-gray-600 leading-relaxed">{clickedStoreForInfo.address}</p>
                    </div>
                  </div>
                  
                  {/* Rating */}
                  {clickedStoreForInfo.rating !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.floor(clickedStoreForInfo.rating) 
                                  ? 'text-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{clickedStoreForInfo.rating}</span>
                        <span className="text-sm text-gray-500">({clickedStoreForInfo.userRatingsTotal || 0} 則評論)</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Opening Status */}
                  {clickedStoreForInfo.openingHours && typeof clickedStoreForInfo.openingHours.open_now === 'boolean' && (
                    <div className="mb-3">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        clickedStoreForInfo.openingHours.open_now 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          clickedStoreForInfo.openingHours.open_now ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        {clickedStoreForInfo.openingHours.open_now ? '營業中' : '休息中'}
                      </div>
                    </div>
                  )}
                  
                  {/* Opening Hours */}
                  {(clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        營業時間
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
                        <div className="text-xs text-gray-600 space-y-1">
                          {(() => {
                            const openingHoursSource = clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText;
                            if (openingHoursSource && Array.isArray(openingHoursSource)) {
                              return openingHoursSource.map((dailyHours, index) => (
                                <div key={index} className="py-0.5 leading-relaxed">{dailyHours}</div>
                              ));
                            }
                            return <div className="text-gray-400">營業時間資訊不完整</div>;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional Info */}
                  {(clickedStoreForInfo.website || clickedStoreForInfo.phoneNumber) && (
                    <div className="pt-3 border-t border-gray-100">
                      {clickedStoreForInfo.phoneNumber && (
                        <div className="mb-2">
                          <a 
                            href={`tel:${clickedStoreForInfo.phoneNumber}`}
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {clickedStoreForInfo.phoneNumber}
                          </a>
                        </div>
                      )}
                      {clickedStoreForInfo.website && (
                        <div className="mb-2">
                          <a 
                            href={clickedStoreForInfo.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                            </svg>
                            官方網站
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Map Area */}
        <div className="flex-1 relative">
          {googleMapsApiKey ? (
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
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    scaledSize: new window.google.maps.Size(40, 40),
                    labelOrigin: new window.google.maps.Point(20, -5)
                  }}
                  label={{
                    text: "🚇",
                    fontSize: "16px",
                    fontWeight: "bold"
                  }}
                />
              )}

              {/* 標記分享列表中的店家 */}
              {stores && stores.map((store, index) => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                    scaledSize: new window.google.maps.Size(35, 35),
                    labelOrigin: new window.google.maps.Point(17, -5)
                  }}
                  label={{
                    text: (index + 1).toString(),
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "bold"
                  }}
                  onClick={() => handleMarkerClick(store)}
                  animation={clickedStoreForInfo?.googlePlaceId === store.googlePlaceId ? 
                    window.google.maps.Animation.BOUNCE : null}
                />
              ))}

              {/* InfoWindow */}
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
                  <div className="max-w-xs">
                    <h4 className="font-semibold text-gray-900 mb-2">{clickedStoreForInfo.name}</h4>
                    
                    {clickedStoreForInfo.photos && clickedStoreForInfo.photos.length > 0 && (
                      <img 
                        src={clickedStoreForInfo.photos[0].getUrl({ maxWidth: 150, maxHeight: 100 })} 
                        alt={`${clickedStoreForInfo.name} 的照片`}
                        className="w-full h-20 object-cover rounded mb-2"
                      />
                    )}
                    
                    <p className="text-sm text-gray-600 mb-2">
                      {clickedStoreForInfo.address ? 
                        (clickedStoreForInfo.address.length > 25 ? 
                          clickedStoreForInfo.address.substring(0, 25) + '...' : 
                          clickedStoreForInfo.address
                        ) : '地址不詳'}
                    </p>
                    
                    {clickedStoreForInfo.rating !== undefined && (
                      <div className="flex items-center mb-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3 h-3 ${
                                i < Math.floor(clickedStoreForInfo.rating) 
                                  ? 'text-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="ml-1 text-sm text-gray-600">{clickedStoreForInfo.rating} / 5</span>
                      </div>
                    )}
                    
                    {/* 營業狀態 */}
                    {clickedStoreForInfo.openingHours && typeof clickedStoreForInfo.openingHours.open_now === 'boolean' && (
                      <div className="mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          clickedStoreForInfo.openingHours.open_now 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {clickedStoreForInfo.openingHours.open_now ? '目前營業中' : '目前休息中'}
                        </span>
                      </div>
                    )}
                    
                    {/* 今日營業時間 */}
                    {(clickedStoreForInfo.openingHours?.weekday_text || clickedStoreForInfo.openingHoursText) && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-600">
                          <strong>今日時段:</strong>
                          <span className="ml-1">
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
                      </div>
                    )}
                    
                    {/* Google Maps 連結 */}
                    {clickedStoreForInfo.googlePlaceId && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedStoreForInfo.name || '')}&query_place_id=${clickedStoreForInfo.googlePlaceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        在 Google 地圖上查看
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  無法載入地圖：Google Maps API 金鑰未設定
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharePage;