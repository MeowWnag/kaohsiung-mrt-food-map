// src/components/SharedFavoriteStores.js
import React from 'react';

const SharedFavoriteStores = ({ selectedStation, displayedFavoriteStores, handleSidebarFavoriteStoreClick }) => {
  return (
    <div>
      <h2>{selectedStation.name} 的分享收藏 ({displayedFavoriteStores.length})</h2>
      {displayedFavoriteStores.length > 0 ? (
        <ul className="favorite-stores-list">
          {displayedFavoriteStores.map(store => (
            <li key={store.googlePlaceId}>
              <span onClick={() => handleSidebarFavoriteStoreClick(store)} className="store-name">
                {store.name}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>此捷運站沒有分享的收藏店家。</p>
      )}
    </div>
  );
};

export default SharedFavoriteStores;