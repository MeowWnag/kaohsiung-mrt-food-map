// src/components/ShareLink.js
import React from 'react';
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
  const handleCreateSingleStationShareLink = async () => {
    if (!user || !selectedStation || myFavoriteStores.length === 0) {
      setFeedbackMessage("錯誤：需要先選擇捷運站並有收藏店家才能分享。");
      return;
    }
    if (isCreatingShareLink) return;
    setIsCreatingShareLink(true);
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

  return (
    <button
      onClick={handleCreateFullMapShareLink}
      disabled={isCreatingShareLink}
      className="share-list-button"
      title="分享我的所有捷運站收藏"
    >
      {isCreatingShareLink ? "生成中..." : "分享我的地圖"}
    </button>
  );
};

export default ShareLink;