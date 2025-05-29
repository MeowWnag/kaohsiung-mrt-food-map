// src/components/StationList.js
import React from 'react';

const StationList = ({ 
  stationData, 
  selectedStation, 
  handleStationClick, 
  isSharedView = false 
}) => {
  return (
    <div>
      <h2>捷運站點</h2>
      <ul>
        {stationData.map(station => {
          const favoritesCount = station.favoritesCount || 0;
          const hasSharedFavorites = isSharedView && favoritesCount > 0;
          
          return (
            <li
              key={station.id}
              onClick={() => handleStationClick(station)}
              className={`
                ${selectedStation?.id === station.id ? 'active-station' : ''} 
                ${hasSharedFavorites ? 'has-shared-favorites-indicator' : ''}
              `.trim()}
              title={hasSharedFavorites ? `有 ${favoritesCount} 個分享收藏` : ''}
            >
              {station.name} ({station.id})
              {hasSharedFavorites && (
                <span className="favorites-count-badge">{favoritesCount}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default StationList;