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
import './HomePage.css';

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

  const mapRef = useRef(null);
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const onLoad = useCallback(map => { mapRef.current = map; }, []);
  const onUnmount = useCallback(map => { mapRef.current = null; }, []);

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

  // 渲染路線圖上的站點標記
  const renderStationMarkers = () => {
    const { allStationsFavorites } = sharedFullMapData;
    
    return stationData.map((station) => {
      const stationLineColor = lineColors[station.lines[0]] || '#555';
      const hasFavorites = allStationsFavorites && allStationsFavorites[station.id] && allStationsFavorites[station.id].length > 0;
      
      return (
        <button
          key={station.id}
          className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''} ${hasFavorites ? 'has-favorites-shared' : ''}`}
          style={{
            left: station.coords.x,
            top: station.coords.y,
            backgroundColor: hasFavorites ? '#FFEB3B' : '#FFFFFF',
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
    });
  };

  // 渲染 InfoWindow 內容
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

    return (
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
        {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
          <div style={{ 
            fontSize: '0.9em', 
            marginTop: '5px', 
            marginBottom: '2px',
            color: clickedPlace.openingHours.open_now ? 'green' : 'red', 
            fontWeight: 'bold' 
          }}>
            {clickedPlace.openingHours.open_now ? '目前營業中' : '目前休息中'}
          </div>
        )}
        {(clickedPlace.openingHours?.weekday_text || clickedPlace.openingHoursText) && (
          <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
            <strong>今日時段:</strong>
            <span style={{ marginLeft: '5px' }}>
              {getTodayHours()}
            </span>
          </div>
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
    );
  };

  // 準備 StationList 的 props
  const getStationListData = () => {
    if (!sharedFullMapData?.allStationsFavorites) return stationData;
    
    return stationData.map(station => ({
      ...station,
      favoritesCount: sharedFullMapData.allStationsFavorites[station.id]?.length || 0
    }));
  };

  if (loading) return <div className="share-page-status">讀取分享地圖中...</div>;
  if (error) return <div className="share-page-status error">{error} <Link to="/" className="share-page-link">返回首頁</Link></div>;
  if (!sharedFullMapData) return <div className="share-page-status">無法載入分享地圖。 <Link to="/" className="share-page-link">返回首頁</Link></div>;

  const { originalUserName } = sharedFullMapData;
  const siteName = process.env.REACT_APP_SITE_NAME || "高雄捷運美食地圖";
  const mapCenter = selectedStation?.realCoords || 
                    (stationData.length > 0 && stationData[0].realCoords) || 
                    { lat: 22.639065, lng: 120.302104 };
  const mapOptions = { clickableIcons: true, disableDefaultUI: false };

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        {mapViewActive && (
          <button onClick={handleBackToRouteMap} className="back-button">
            返回分享路線圖
          </button>
        )}
        <h1>{originalUserName || '一位使用者'} 分享的高雄捷運美食地圖</h1>
        <div>
          <Link to="/" className="back-to-home-button" style={{textDecoration: 'none'}}>
            {`返回${siteName}`}
          </Link>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <StationList 
            stationData={getStationListData()}
            selectedStation={selectedStation}
            handleStationClick={handleStationClick}
            isSharedView={true}
          />
          <hr />

          {selectedStation ? (
            <SharedFavoriteStores 
              selectedStation={selectedStation}
              displayedFavoriteStores={displayedFavoriteStores}
              handleSidebarFavoriteStoreClick={handleSidebarFavoriteStoreClick}
            />
          ) : mapViewActive ? (
            <p>請從左側列表選擇一個捷運站來查看分享的收藏。</p>
          ) : (
            <p>點選捷運站以查看該站點分享的收藏店家。</p>
          )}
          <hr />
          
          {mapViewActive && clickedPlace && selectedStation && (
            <PlaceDetails 
              clickedPlace={clickedPlace}
              handleClosePlaceInfo={handleClosePlaceInfo}
            />
          )}
        </aside>

        <div className="map-area-container">
          {!mapViewActive ? (
            <div className="krtc-map-container">
              <img src="/img/krtc-map.png" alt="高雄捷運路線圖" className="krtc-map-image"/>
              {renderStationMarkers()}
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

              {displayedFavoriteStores.map(store => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                  onClick={() => handleSharedStoreMarkerClick(store)}
                />
              ))}

              {clickedPlace && activeInfoWindow === clickedPlace.googlePlaceId && selectedStation && (
                <InfoWindow 
                  key={`${clickedPlace.googlePlaceId}-${activeInfoWindow}`}
                  position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }} 
                  onCloseClick={handleClosePlaceInfo}
                >
                  {renderInfoWindowContent()}
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