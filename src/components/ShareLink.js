// src/components/ShareLink.js
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, limit, getDocs } from "firebase/firestore";
import { db } from '../firebase';
import { stationData } from '../data/stations';

const ShareLink = ({
  user,
  selectedStation,
  myFavoriteStores,
  isCreatingShareLink,
  setIsCreatingShareLink,
  setGeneratedShareLink,
  setFeedbackMessage,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleCreateSingleStationShareLink = async () => {
    if (!user || !selectedStation || myFavoriteStores.length === 0) {
      setFeedbackMessage("錯誤：需要先選擇捷運站並有收藏店家才能分享。");
      return;
    }
    if (isCreatingShareLink) return;
    setIsCreatingShareLink(true);
    setIsDropdownOpen(false);
    setGeneratedShareLink('');
    setFeedbackMessage("正在生成單站分享連結...");
    try {
      const storesToShare = myFavoriteStores.map(store => ({
        name: store.name,
        address: store.address,
        googlePlaceId: store.googlePlaceId,
        lat: store.lat,
        lng: store.lng,
        rating: store.rating,
        mainPhotoUrl: store.mainPhotoUrl,
      }));
      const shareData = {
        originalUserId: user.uid,
        originalUserName: user.displayName || user.email || "一位使用者",
        originalStationId: selectedStation.id,
        originalStationName: selectedStation.name,
        stores: storesToShare,
        createdAt: serverTimestamp(),
      };
      const publicSharesRef = collection(db, "publicSharedViews");
      const docRef = await addDoc(publicSharesRef, shareData);
      const shareLink = `${window.location.origin}/share/${docRef.id}`;
      setGeneratedShareLink(shareLink);
      await navigator.clipboard?.writeText(shareLink);
      setFeedbackMessage("單站分享連結已生成並複製！");
    } catch (error) {
      console.error("創建單站分享連結失敗:", error);
      setFeedbackMessage(`生成單站分享連結失敗: ${error.message}`);
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  const handleCreateFullMapShareLink = async () => {
    if (!user) {
      setFeedbackMessage("錯誤：需要登入才能分享您的所有收藏。");
      return;
    }
    if (isCreatingShareLink) return;
    setIsCreatingShareLink(true);
    setIsDropdownOpen(false);
    setGeneratedShareLink('');
    setFeedbackMessage("正在生成全站收藏分享連結...");
    try {
      const allStationsFavoritesData = {};
      let totalStoresSharedCount = 0;
      for (const station of stationData) {
        if (!station || !station.id) continue;
        const stationFavoritesRef = collection(db, `users/${user.uid}/favoriteStoresByStation/${station.id}/stores`);
        const q = query(stationFavoritesRef, limit(15));
        const querySnapshot = await getDocs(q);
        const storesForThisStation = [];
        querySnapshot.forEach((doc) => {
          const store = doc.data();
          storesForThisStation.push({
            name: store.name,
            address: store.address,
            googlePlaceId: store.googlePlaceId,
            lat: store.lat,
            lng: store.lng,
            rating: store.rating,
            mainPhotoUrl: store.mainPhotoUrl,
          });
        });
        if (storesForThisStation.length > 0) {
          allStationsFavoritesData[station.id] = storesForThisStation;
          totalStoresSharedCount += storesForThisStation.length;
        }
      }
      if (totalStoresSharedCount === 0) {
        setFeedbackMessage("您目前沒有任何捷運站收藏可以分享。");
        setIsCreatingShareLink(false);
        return;
      }
      const shareData = {
        originalUserId: user.uid,
        originalUserName: user.displayName || user.email || "一位熱心的分享者",
        allStationsFavorites: allStationsFavoritesData,
        createdAt: serverTimestamp(),
      };
      const publicFullMapsRef = collection(db, "publicSharedFullMaps");
      const docRef = await addDoc(publicFullMapsRef, shareData);
      const shareLink = `${window.location.origin}/sharemap/${docRef.id}`;
      setGeneratedShareLink(shareLink);
      await navigator.clipboard?.writeText(shareLink);
      setFeedbackMessage("全站收藏分享連結已生成並複製！");
    } catch (error) {
      console.error("創建全站收藏分享連結失敗:", error);
      setFeedbackMessage(`生成全站收藏分享連結失敗: ${error.message}`);
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  // 點擊外部關閉下拉選單
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.share-dropdown')) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="relative share-dropdown">
      {/* 分享按鈕 - 適合放在 header */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isCreatingShareLink}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:transform-none group text-sm"
        title="分享我的收藏"
      >
        {isCreatingShareLink ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="hidden sm:inline">生成中...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span className="hidden sm:inline">分享</span>
            <svg 
              className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* 下拉選單 */}
      {isDropdownOpen && !isCreatingShareLink && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 shadow-lg z-50 overflow-hidden">
          {/* 標題 */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <h3 className="font-semibold text-gray-800">分享收藏</h3>
            </div>
          </div>

          {/* 選項列表 */}
          <div className="py-1">
            {/* 單站分享選項 */}
            {selectedStation && myFavoriteStores.length > 0 && (
              <button
                onClick={handleCreateSingleStationShareLink}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-800">分享 {selectedStation.name}</div>
                  <div className="text-sm text-gray-500">分享此站的收藏店家 ({myFavoriteStores.length} 家)</div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                    {myFavoriteStores.length}
                  </span>
                </div>
              </button>
            )}

            {/* 全站收藏分享選項 */}
            <button
              onClick={handleCreateFullMapShareLink}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors duration-150"
            >
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-800">分享我的地圖</div>
                <div className="text-sm text-gray-500">分享所有捷運站的收藏店家</div>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                  全站
                </span>
              </div>
            </button>

            {/* 如果沒有選站或沒有收藏的提示 */}
            {(!selectedStation || myFavoriteStores.length === 0) && (
              <div className="px-4 py-3 text-sm text-gray-500 bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>請先選擇捷運站並收藏店家才能分享單站收藏</span>
                </div>
              </div>
            )}
          </div>

          {/* 底部提示 */}
          <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
            <p className="text-xs text-blue-700 flex items-start gap-2">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>分享連結會自動複製到剪貼簿</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareLink;