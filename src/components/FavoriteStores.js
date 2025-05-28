// src/components/FavoriteStores.js
import React from 'react';

const FavoriteStores = ({
  user,
  selectedStation,
  myFavoriteStores,
  setMyFavoriteStores,
  handleSidebarFavoriteStoreClick,
  handleRemoveFromMyList,
  isRemovingFromList,
  setFeedbackMessage,
}) => {
  return (
    <div>
      <div className="sidebar-section-header">
        <h2>{selectedStation.name} 的最愛 ({myFavoriteStores.length}/15)</h2>
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
      ) : (
        <p>此捷運站尚無最愛店家。</p>
      )}
    </div>
  );
};

export default FavoriteStores;