// src/pages/SharedMapViewerPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { stationData, lineColors } from '../data/stations';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import StationList from '../components/StationList';
import SharedFavoriteStores from '../components/SharedFavoriteStores';
import PlaceDetails from '../components/PlaceDetails';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultZoom = 16;

const SharedMapViewerPage = () => {
  const { shareId } = useParams();
  const [sharedFullMapData, setSharedFullMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI 狀態
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [mapViewActive, setMapViewActive] = useState(false);
  const [displayedFavoriteStores, setDisplayedFavoriteStores] = useState([]);
  const [clickedPlace, setClickedPlace] = useState(null);
  const [showPlaceInfo, setShowPlaceInfo] = useState(false);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // 新增地圖載入狀態
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  const mapRef = useRef(null);
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  // 修改 onLoad 回調函數
  const onLoad = useCallback(map => { 
    mapRef.current = map;
    setMapLoaded(true);
    
    // 等待一個短暫的延遲確保地圖完全載入
    setTimeout(() => {
      setGoogleMapsReady(true);
    }, 100);
  }, []);

  const onUnmount = useCallback(map => { 
    mapRef.current = null;
    setMapLoaded(false);
    setGoogleMapsReady(false);
  }, []);

  // 監聽 Google Maps API 載入狀態
  useEffect(() => {
    const checkGoogleMapsAPI = () => {
      if (window.google && window.google.maps && window.google.maps.Marker) {
        setGoogleMapsReady(true);
      } else {
        setTimeout(checkGoogleMapsAPI, 100);
      }
    };

    if (mapViewActive) {
      checkGoogleMapsAPI();
    }
  }, [mapViewActive]);

  useEffect(() => {
    if (!googleMapsApiKey && mapViewActive) {
      console.error("Google Maps API Key is missing for SharedMapViewerPage.");
    }
  }, [googleMapsApiKey, mapViewActive]);

  // 獲取分享數據
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
            setMapViewActive(false);
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

  // 更新顯示的收藏店家
  useEffect(() => {
    if (selectedStation && sharedFullMapData && sharedFullMapData.allStationsFavorites) {
      setDisplayedFavoriteStores(sharedFullMapData.allStationsFavorites[selectedStation.id] || []);
    } else {
      setDisplayedFavoriteStores([]);
    }
  }, [selectedStation, sharedFullMapData]);

  // 處理捷運站點擊
  const handleStationClick = (station) => {
    if (station.realCoords) {
      setSelectedStation(station);
      setMapViewActive(true);
      handleClosePlaceInfo();
      setSidebarOpen(false); // 關閉手機版側邊欄
    } else {
      console.warn(`(Shared View) 站點 ${station.name} 缺少 realCoords 資料。`);
    }
  };

  // 返回路線圖
  const handleBackToRouteMap = () => {
    setMapViewActive(false);
    setSelectedStation(null);
    handleClosePlaceInfo();
    setHoveredStation(null);
  };

  // 關閉店家資訊
  const handleClosePlaceInfo = () => {
    setClickedPlace(null);
    setShowPlaceInfo(false);
    setActiveInfoWindow(null);
  };

  // 更新店家詳細資訊
  const updateClickedPlace = (place) => {
    setClickedPlace(place);
    setShowPlaceInfo(true);
    setTimeout(() => {
      setActiveInfoWindow(place.googlePlaceId);
    }, 50);
  };

  // 獲取店家詳細資訊的通用函數
  const fetchPlaceDetails = (store, onSuccess) => {
    if (!mapRef.current || !window.google?.maps?.places) {
      onSuccess(store);
      return;
    }

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
        const updatedStore = {
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
        onSuccess(updatedStore);
      } else {
        console.error(`無法獲取分享店家 ${store.name} 的即時詳細資訊: ${status}`);
        onSuccess(store);
      }
    });
  };

  // POI 點擊處理
  const handleMapPoiClick = (event) => {
    const placeId = event.placeId;
    if (!placeId || !mapRef.current || !selectedStation) {
      console.warn("Place ID, Map instance, or Selected Station is not available for POI click in shared view.");
      return;
    }

    handleClosePlaceInfo();

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
          updateClickedPlace(newClickedPlace);
        }
      }
    });
  };

  // 點擊收藏店家 Marker
  const handleSharedStoreMarkerClick = (store) => {
    setActiveInfoWindow(null);
    setClickedPlace({ ...store });
    setShowPlaceInfo(true);

    if (mapRef.current && store.lat && store.lng) {
      mapRef.current.panTo({ lat: store.lat, lng: store.lng });
    }

    fetchPlaceDetails(store, updateClickedPlace);
  };

  // 側邊欄店家點擊
  const handleSidebarFavoriteStoreClick = (store) => {
    handleSharedStoreMarkerClick(store);
  };

  // 準備 StationList 的 props
  const getStationListData = () => {
    if (!sharedFullMapData?.allStationsFavorites) return stationData;
    
    return stationData.map(station => ({
      ...station,
      favoritesCount: sharedFullMapData.allStationsFavorites[station.id]?.length || 0
    }));
  };

  // 創建自定義站點標記圖標
  const createStationIcon = (station, isSelected = false) => {
    if (!window.google?.maps?.Size) {
      console.warn('Google Maps API not ready for createStationIcon');
      return null;
    }

    const lineColor = lineColors[station.lines[0]] || '#6B7280';
    const size = isSelected ? 60 : 48;
    const stationName = station.name.length > 6 ? station.name.substring(0, 5) + '...' : station.name;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size + 12}" viewBox="0 0 ${size} ${size + 12}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.25"/>
            </filter>
            <linearGradient id="stationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${lineColor};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${lineColor}DD;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="innerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F9FAFB;stop-opacity:1" />
            </linearGradient>
            ${isSelected ? `
            <filter id="pulse">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            ` : ''}
          </defs>
          
          <!-- 脈動效果（僅選中時） -->
          ${isSelected ? `
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" 
                  fill="${lineColor}" 
                  opacity="0.3" 
                  filter="url(#pulse)">
            <animate attributeName="r" values="${size/2 - 8};${size/2 - 4};${size/2 - 8}" 
                     dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0.1;0.5" 
                     dur="2s" repeatCount="indefinite"/>
          </circle>
          ` : ''}
          
          <!-- 外圈 -->
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 6}" 
                  fill="url(#stationGradient)" 
                  stroke="#FFFFFF" 
                  stroke-width="3" 
                  filter="url(#shadow)"/>
          
          <!-- 內圈 -->
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 12}" 
                  fill="url(#innerGradient)" 
                  stroke="${lineColor}" 
                  stroke-width="1"/>
          
          <!-- 捷運圖示 -->
          <g transform="translate(${size/2}, ${size/2})">
            <!-- 車廂主體 -->
            <rect x="-10" y="-5" width="20" height="10" rx="2" fill="${lineColor}"/>
            <!-- 車輪 -->
            <circle cx="-6" cy="4" r="2" fill="#6B7280"/>
            <circle cx="6" cy="4" r="2" fill="#6B7280"/>
            <!-- 車窗 -->
            <rect x="-7" y="-3" width="5" height="3" rx="1" fill="#FFFFFF"/>
            <rect x="2" y="-3" width="5" height="3" rx="1" fill="#FFFFFF"/>
            <!-- 車門 -->
            <line x1="0" y1="-5" x2="0" y2="5" stroke="#FFFFFF" stroke-width="1"/>
            <!-- 站號 -->
            <text x="0" y="2" font-family="Arial, Microsoft JhengHei, sans-serif" 
                  font-size="6" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
              ${station.id}
            </text>
          </g>
          
          <!-- 站名標籤 -->
          <rect x="${size/2 - 20}" y="${size - 2}" width="40" height="12" rx="6" 
                fill="${lineColor}" 
                stroke="#FFFFFF" 
                stroke-width="1"
                filter="url(#shadow)"/>
          <text x="${size/2}" y="${size + 4}" 
                font-family="Arial, Microsoft JhengHei, sans-serif" 
                font-size="8" 
                font-weight="bold" 
                fill="#FFFFFF" 
                text-anchor="middle">
            ${stationName}
          </text>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size + 12),
      anchor: new window.google.maps.Point(size/2, size/2)
    };
  };

  // 創建收藏店家標記圖標
  const createFavoriteStoreIcon = (isHovered = false) => {
    if (!window.google?.maps?.Size) {
      console.warn('Google Maps API not ready for createFavoriteStoreIcon');
      return null;
    }

    const size = isHovered ? 36 : 30;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
            </filter>
            <linearGradient id="favoriteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
                  fill="url(#favoriteGradient)" 
                  stroke="white" 
                  stroke-width="2" 
                  filter="url(#shadow)"/>
          <path d="M${size/2} ${size/4 + 2} 
                   L${size/2 + 3} ${size/2 - 1} 
                   L${size/2 + 6} ${size/2 - 1} 
                   L${size/2 + 2} ${size/2 + 2} 
                   L${size/2 + 4} ${size*3/4 - 2} 
                   L${size/2} ${size/2 + 4} 
                   L${size/2 - 4} ${size*3/4 - 2} 
                   L${size/2 - 2} ${size/2 + 2} 
                   L${size/2 - 6} ${size/2 - 1} 
                   L${size/2 - 3} ${size/2 - 1} Z" 
                fill="white" 
                stroke="none"/>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size/2, size/2)
    };
  };

  // 創建新發現地點標記圖標
  const createNewPlaceIcon = () => {
    if (!window.google?.maps?.Size) {
      console.warn('Google Maps API not ready for createNewPlaceIcon');
      return null;
    }

    const size = 32;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
            </filter>
            <linearGradient id="newPlaceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
                  fill="url(#newPlaceGradient)" 
                  stroke="white" 
                  stroke-width="2" 
                  filter="url(#shadow)"/>
          <circle cx="${size/2}" cy="${size/2}" r="4" 
                  fill="white"/>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size/2, size/2)
    };
  };

  // 創建脈動動畫標記
  const createPulsingIcon = (color = '#3B82F6') => {
    if (!window.google?.maps?.Size) {
      console.warn('Google Maps API not ready for createPulsingIcon');
      return null;
    }

    const size = 40;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
            </filter>
          </defs>
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" 
                  fill="${color}" 
                  opacity="0.3" 
                  filter="url(#shadow)">
            <animate attributeName="r" values="${size/2 - 8};${size/2 - 4};${size/2 - 8}" 
                     dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.7;0.2;0.7" 
                     dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${size/2}" cy="${size/2}" r="${size/4}" 
                  fill="${color}" 
                  stroke="white" 
                  stroke-width="2"/>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size/2, size/2)
    };
  };

  // 優化的 InfoWindow 內容
  const renderInfoWindowContent = () => {
    if (!clickedPlace || activeInfoWindow !== clickedPlace.googlePlaceId || !selectedStation) {
      return null;
    }

    const getTodayHours = () => {
      const openingHoursSource = clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText;
      if (!openingHoursSource || !Array.isArray(openingHoursSource)) return '資訊不完整';
      
      const today = new Date().getDay();
      const todayIndex = (today === 0) ? 6 : today - 1;
      
      if (clickedPlace.openingHours && clickedPlace.openingHours.periods) {
        const currentDayPeriods = clickedPlace.openingHours.periods.filter(p => p.open && p.open.day === today);
        if (currentDayPeriods.length > 0) {
          return currentDayPeriods.map(p => {
            const openTime = `${String(p.open.hours).padStart(2, '0')}:${String(p.open.minutes).padStart(2, '0')}`;
            if (p.close) {
              const closeTime = `${String(p.close.hours).padStart(2, '0')}:${String(p.close.minutes).padStart(2, '0')}`;
              return `${openTime} – ${closeTime}`;
            }
            return `${openTime} – (營業中)`;
          }).join(', ');
        }
      }
      
      if (openingHoursSource[todayIndex]) {
        const todayText = openingHoursSource[todayIndex];
        if (todayText.includes("休息") || todayText.includes("Closed")) return "休息";
        const timePart = todayText.substring(todayText.indexOf(':') + 1).trim();
        return timePart || "資訊不詳";
      }
      
      return '資訊不詳';
    };

    const isOpen = clickedPlace.openingHours?.open_now;
    
    return (
      <div className="p-4 max-w-sm min-w-[280px]">
        {/* 標題與照片 */}
        <div className="mb-3">
          <h4 className="font-bold text-lg text-gray-800 mb-2 flex items-center">
            {clickedPlace.name}
            <span className="ml-2 text-yellow-500">⭐</span>
          </h4>
          {clickedPlace.photos && clickedPlace.photos.length > 0 && (
            <div className="relative overflow-hidden rounded-lg shadow-md mb-3">
              <img 
                src={clickedPlace.photos[0].getUrl({ maxWidth: 280, maxHeight: 160 })} 
                alt={`${clickedPlace.name} 的照片`}
                className="w-full h-32 object-cover transition-transform duration-300 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
          )}
        </div>

        {/* 評分與地址 */}
        <div className="space-y-2 mb-3">
          {clickedPlace.rating !== undefined && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-lg">
                <span className="text-yellow-500 text-sm">★</span>
                <span className="text-sm font-semibold text-gray-700 ml-1">
                  {clickedPlace.rating}
                </span>
                {clickedPlace.userRatingsTotal && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({clickedPlace.userRatingsTotal})
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-600 flex-1">
              {clickedPlace.address || '地址不詳'}
            </p>
          </div>
        </div>

        {/* 營業狀態 */}
        {typeof isOpen === 'boolean' && (
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${
            isOpen 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isOpen ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            {isOpen ? '目前營業中' : '目前休息中'}
          </div>
        )}

        {/* 營業時間 */}
        {(clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center space-x-2 text-sm">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-gray-700">今日營業時間:</span>
            </div>
            <p className="text-sm text-gray-600 mt-1 ml-6">{getTodayHours()}</p>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex space-x-2">
          {clickedPlace.googlePlaceId && (
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clickedPlace.name || '')}&query_place_id=${clickedPlace.googlePlaceId}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200 text-center inline-flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Google 地圖
            </a>
          )}
          
          {clickedPlace.website && (
            <a 
              href={clickedPlace.website} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200 inline-flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
              </svg>
            </a>
          )}
        </div>
      </div>
    );
  };

  // 渲染路線圖上的站點標記
  const renderStationMarkers = () => {
    const { allStationsFavorites } = sharedFullMapData;
    
    return stationData.map((station) => {
      const stationLineColor = lineColors[station.lines[0]] || '#555';
      const hasFavorites = allStationsFavorites && allStationsFavorites[station.id] && allStationsFavorites[station.id].length > 0;
      
      return (
        <button
          key={station.id}
          className={`
            absolute w-6 h-6 rounded-full border-2 bg-white 
            flex items-center justify-center text-xs font-semibold
            transition-all duration-200 ease-in-out
            hover:scale-110 hover:shadow-lg hover:z-10
            focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50
            ${hoveredStation === station.id ? 'scale-110 shadow-lg z-10' : ''}
            ${hasFavorites ? 'bg-yellow-300 border-yellow-500 shadow-md' : 'bg-white'}
          `}
          style={{
            left: station.coords.x,
            top: station.coords.y,
            borderColor: stationLineColor,
            borderWidth: '2px'
          }}
          onClick={() => handleStationClick(station)}
          onMouseEnter={() => setHoveredStation(station.id)}
          onMouseLeave={() => setHoveredStation(null)}
          title={`${station.name}${hasFavorites ? ` (有${allStationsFavorites[station.id].length}筆分享收藏)` : ''}`}
        >
          <span className="text-xs font-bold text-gray-700">{station.id}</span>
        </button>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-center text-gray-700 text-lg">讀取分享地圖中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-700 text-lg mb-4">{error}</p>
          <Link 
            to="/" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  if (!sharedFullMapData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4 text-center">
          <div className="text-gray-400 text-6xl mb-4">📍</div>
          <p className="text-gray-700 text-lg mb-4">無法載入分享地圖。</p>
          <Link 
            to="/" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  const { originalUserName } = sharedFullMapData;
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";
  const mapCenter = selectedStation?.realCoords || 
                    (stationData.length > 0 && stationData[0].realCoords) || 
                    { lat: 22.639065, lng: 120.302104 };
  const mapOptions = { clickableIcons: true, disableDefaultUI: false };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {mapViewActive && (
                <button 
                  onClick={handleBackToRouteMap} 
                  className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20"
                >
                  ← 返回路線圖
                </button>
              )}
              <h1 className="text-xl md:text-2xl font-bold">
                <span className="text-yellow-300">{originalUserName || '一位使用者'}</span> 分享的高雄捷運美食地圖
              </h1>
            </div>
            <Link 
              to="/" 
              className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20"
            >
              返回{siteName}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-20 left-4 z-30 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Sidebar */}
        <aside className={`
          bg-white border-r border-gray-200 shadow-lg
          w-80 flex flex-col transition-transform duration-300 ease-in-out z-20
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed md:static h-full
        `}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">捷運站列表</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Station List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <StationList 
                stationData={getStationListData()}
                selectedStation={selectedStation}
                handleStationClick={handleStationClick}
                isSharedView={true}
              />
            </div>

            <hr className="border-gray-200 mx-4" />

            {/* Favorite Stores Section */}
            <div className="p-4">
              {selectedStation ? (
                <SharedFavoriteStores 
                  selectedStation={selectedStation}
                  displayedFavoriteStores={displayedFavoriteStores}
                  handleSidebarFavoriteStoreClick={handleSidebarFavoriteStoreClick}
                />
              ) : mapViewActive ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">🚇</div>
                  <p className="text-gray-600">請從左側列表選擇一個捷運站來查看分享的收藏。</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-blue-500 text-4xl mb-2">📍</div>
                  <p className="text-gray-600">點選捷運站以查看該站點分享的收藏店家。</p>
                </div>
              )}
            </div>

            <hr className="border-gray-200 mx-4" />
            
            {/* Place Details */}
            {mapViewActive && clickedPlace && selectedStation && (
              <div className="p-4">
                <PlaceDetails 
                  clickedPlace={clickedPlace}
                  handleClosePlaceInfo={handleClosePlaceInfo}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Map Area */}
        <div className="flex-1 relative bg-gray-100">
          {!mapViewActive ? (
            <div className="relative w-full h-full overflow-auto bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              <div className="relative bg-white rounded-xl shadow-2xl p-4 m-4">
                {/* 固定容器尺寸 */}
                <div className="relative" style={{ width: '1100px', height: '1516px', maxWidth: '100%', maxHeight: '100%' }}>
                  <img 
                    src="/img/krtc-map.png" 
                    alt="高雄捷運路線圖" 
                    className="w-full h-full object-contain rounded-lg shadow-lg"
                    style={{ width: '1100px', height: '1516px' }}
                  />
                  {renderStationMarkers()}
                </div>
              </div>
            </div>
          ) : googleMapsApiKey ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapPoiClick}
              options={{
                ...mapOptions,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                  },
                  {
                    featureType: "transit",
                    elementType: "labels",
                    stylers: [{ visibility: "simplified" }]
                  }
                ]
              }}
            >
              {/* 只在地圖和 Google Maps API 完全載入後才渲染標記 */}
              {mapLoaded && googleMapsReady && (
                <>
                  {/* 選中的捷運站標記 */}
                  {selectedStation && (
                    <Marker 
                      position={selectedStation.realCoords} 
                      title={selectedStation.name}
                      icon={createStationIcon(selectedStation, true)}
                      zIndex={1000}
                    />
                  )}

                  {/* 其他捷運站標記（可選，如果您想顯示附近的其他站點） */}
                  {stationData
                    .filter(station => 
                      station.realCoords && 
                      station.id !== selectedStation?.id &&
                      // 只顯示距離選中站點一定範圍內的其他站點（可選）
                      selectedStation && 
                      Math.abs(station.realCoords.lat - selectedStation.realCoords.lat) < 0.02 &&
                      Math.abs(station.realCoords.lng - selectedStation.realCoords.lng) < 0.02
                    )
                    .map(station => (
                      <Marker
                        key={`nearby-${station.id}`}
                        position={station.realCoords}
                        title={station.name}
                        icon={createStationIcon(station, false)}
                        onClick={() => handleStationClick(station)}
                        zIndex={500}
                      />
                    ))}

                  {/* 收藏店家標記 */}
                  {displayedFavoriteStores.map((store, index) => (
                    <Marker
                      key={store.googlePlaceId}
                      position={{ lat: store.lat, lng: store.lng }}
                      title={store.name}
                      icon={createFavoriteStoreIcon(clickedPlace?.googlePlaceId === store.googlePlaceId)}
                      onClick={() => handleSharedStoreMarkerClick(store)}
                      zIndex={clickedPlace?.googlePlaceId === store.googlePlaceId ? 999 : 100 + index}
                      animation={clickedPlace?.googlePlaceId === store.googlePlaceId ? window.google.maps.Animation.BOUNCE : null}
                    />
                  ))}

                  {/* 新發現地點的標記 */}
                  {clickedPlace && 
                   !displayedFavoriteStores.some(store => store.googlePlaceId === clickedPlace.googlePlaceId) && 
                   selectedStation && (
                    <Marker
                      position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }}
                      title={clickedPlace.name}
                      icon={createNewPlaceIcon()}
                      zIndex={998}
                    />
                  )}

                  {/* InfoWindow */}
                  {clickedPlace && activeInfoWindow === clickedPlace.googlePlaceId && selectedStation && (
                    <InfoWindow 
                      key={`${clickedPlace.googlePlaceId}-${activeInfoWindow}`}
                      position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }} 
                      onCloseClick={handleClosePlaceInfo}
                      options={{
                        pixelOffset: new window.google.maps.Size(0, -10),
                        maxWidth: 320,
                        disableAutoPan: false
                      }}
                    >
                      {renderInfoWindowContent()}
                    </InfoWindow>
                  )}
                </>
              )}

              {/* 載入指示器 */}
              {(!mapLoaded || !googleMapsReady) && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">載入地圖標記中...</p>
                  </div>
                </div>
              )}
            </GoogleMap>
          ) : (
            <div className="h-full flex items-center justify-center bg-red-50">
              <div className="text-center p-8">
                <div className="text-red-500 text-6xl mb-4">🗺️</div>
                <p className="text-red-700 text-lg">無法載入地圖：Google Maps API 金鑰未設定。</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedMapViewerPage;