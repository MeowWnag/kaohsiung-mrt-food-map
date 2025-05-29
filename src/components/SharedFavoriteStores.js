// src/components/SharedFavoriteStores.js
import React from 'react';

const SharedFavoriteStores = ({ selectedStation, displayedFavoriteStores, handleSidebarFavoriteStoreClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 標題區域 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {selectedStation.name} 的分享收藏
        </h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
          {displayedFavoriteStores.length}
        </span>
      </div>

      {/* 收藏店家列表 */}
      {displayedFavoriteStores.length > 0 ? (
        <div className="space-y-2">
          {displayedFavoriteStores.map(store => (
            <div
              key={store.googlePlaceId}
              onClick={() => handleSidebarFavoriteStoreClick(store)}
              className="group cursor-pointer bg-gray-50 hover:bg-blue-50 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-blue-200 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors duration-200">
                    {store.name}
                  </span>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-2">此捷運站沒有分享的收藏店家</p>
          <p className="text-xs text-gray-400">成為第一個分享收藏的人吧！</p>
        </div>
      )}
    </div>
  );
};

export default SharedFavoriteStores;