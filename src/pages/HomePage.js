// src/pages/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { stationData, lineColors } from '../data/stations';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import StationList from '../components/StationList';
import FavoriteStores from '../components/FavoriteStores';
import PlaceDetails from '../components/PlaceDetails';
import ShareLink from '../components/ShareLink';
import './HomePage.css';

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
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isRemovingFromList, setIsRemovingFromList] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [myFavoriteStores, setMyFavoriteStores] = useState([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [generatedShareLink, setGeneratedShareLink] = useState('');

  const mapRef = useRef(null);

  const onLoad = useCallback(function callback(map) {
    setMapInstance(map);
    mapRef.current = map;
    console.log("Google Map instance loaded.");
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMapInstance(null);
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
    <div className="homepage-container">
      <header className="homepage-header">
        {mapViewActive && (
          <button onClick={handleBackToRouteMap} className="back-button">返回路線圖</button>
        )}
        <h1>歡迎, {user ? user.displayName || user.email : '使用者'}!</h1>
        <div className="header-actions">
          {feedbackMessage && <span className="feedback-message">{feedbackMessage}</span>}
          {generatedShareLink && !isCreatingShareLink && (
            <div className="generated-share-link">
              <p>分享連結:</p>
              <input type="text" value={generatedShareLink} readOnly />
              <button onClick={() => navigator.clipboard?.writeText(generatedShareLink).then(() => setFeedbackMessage("連結已複製!"))}>複製</button>
            </div>
          )}
          {user && (
            <div className="user-buttons">
              <ShareLink
                user={user}
                selectedStation={selectedStation}
                myFavoriteStores={myFavoriteStores}
                isCreatingShareLink={isCreatingShareLink}
                setIsCreatingShareLink={setIsCreatingShareLink}
                setGeneratedShareLink={setGeneratedShareLink}
                setFeedbackMessage={setFeedbackMessage}
              />
              <button onClick={handleLogout} className="logout-button">登出</button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <StationList
            stationData={stationData}
            selectedStation={selectedStation}
            handleStationClick={handleStationClick}
          />
          <hr />
          {selectedStation && (
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
          )}
          <hr />
          {mapViewActive && clickedPlace && selectedStation && (
            <PlaceDetails clickedPlace={clickedPlace} handleClosePlaceInfo={() => setActiveInfoWindow(null)} />
          )}
        </aside>

        <div className="map-area-container">
          {!mapViewActive ? (
            <div className="krtc-map-container">
              <img src="/img/krtc-map.png" alt="高雄捷運路線圖" className="krtc-map-image" />
              {stationData.map((station) => {
                const stationLineColor = lineColors[station.lines[0]] || '#555';
                return (
                  <button
                    key={station.id}
                    className={`station-marker ${hoveredStation === station.id ? 'hovered' : ''}`}
                    style={{ left: station.coords.x, top: station.coords.y, backgroundColor: '#FFFFFF', borderColor: stationLineColor }}
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
              {selectedStation && <Marker position={selectedStation.realCoords} title={selectedStation.name} />}
              {selectedStation && myFavoriteStores.map(store => (
                <Marker
                  key={store.googlePlaceId}
                  position={{ lat: store.lat, lng: store.lng }}
                  title={store.name}
                  icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                  onClick={() => handleFavoriteStoreMarkerClick(store)}
                />
              ))}
              {clickedPlace && activeInfoWindow === clickedPlace.googlePlaceId && selectedStation && clickedPlace.name && clickedPlace.lat && clickedPlace.lng && clickedPlace.googlePlaceId && (
                <InfoWindow
                  key={`${clickedPlace.googlePlaceId}-${activeInfoWindow}`}
                  position={{ lat: Number(clickedPlace.lat), lng: Number(clickedPlace.lng) }}
                  onCloseClick={() => setActiveInfoWindow(null)}
                >
                  <div className="place-infowindow">
                    <h4>{clickedPlace.name}</h4>
                    {clickedPlace.photos?.length > 0 && (
                      <img
                        src={clickedPlace.photos[0].getUrl({ maxWidth: 150, maxHeight: 100 })}
                        alt={`${clickedPlace.name} 的照片`}
                        style={{ maxWidth: '100%', height: 'auto', marginTop: '5px', marginBottom: '5px', borderRadius: '3px' }}
                      />
                    )}
                    <p>{clickedPlace.address ? (clickedPlace.address.length > 25 ? clickedPlace.address.substring(0, 25) + '...' : clickedPlace.address) : '地址不詳'}</p>
                    {clickedPlace.rating !== undefined && <p>評分: {clickedPlace.rating} / 5</p>}
                    {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
                      <div style={{ fontSize: '0.9em', marginTop: '5px', marginBottom: clickedPlace.openingHours?.weekday_text ? '2px' : '5px', color: clickedPlace.openingHours.open_now ? 'green' : 'red', fontWeight: 'bold' }}>
                        {clickedPlace.openingHours.open_now ? '目前營業中' : '目前休息中'}
                      </div>
                    )}
                    {clickedPlace.openingHours?.weekday_text && (
                      <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                        <strong>今日時段:</strong>
                        <span style={{ marginLeft: '5px' }}>
                          {(() => {
                            const today = new Date().getDay();
                            const todayIndex = today === 0 ? 6 : today - 1;
                            return clickedPlace.openingHours.weekday_text[todayIndex]?.substring(clickedPlace.openingHours.weekday_text[todayIndex].indexOf(':') + 1).trim() || '資訊不詳';
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
                        style={{ marginTop: '5px' }}
                      >
                        {isRemovingFromList && clickedPlace.id === (myFavoriteStores.find(s => s.googlePlaceId === clickedPlace.googlePlaceId)?.id) ? "移除中..." : "從最愛移除"}
                      </button>
                    ) : (
                      <button
                        onClick={handleAddToMyList}
                        disabled={isAddingToList || myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION}
                        className="add-to-list-button"
                        style={{ fontSize: '0.9em', padding: '3px 6px', marginTop: '5px' }}
                      >
                        {isAddingToList ? "處理中..." : (myFavoriteStores.length >= MAX_FAVORITE_STORES_PER_STATION ? "此站已滿" : `加入 ${selectedStation.name} 最愛`)}
                      </button>
                    )}
                    <br />
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
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;