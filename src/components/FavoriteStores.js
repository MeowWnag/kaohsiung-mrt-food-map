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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span>{selectedStation.name} 的最愛</span>
          <span className="bg-white/20 text-white text-sm px-2 py-1 rounded-full ml-auto">
            {myFavoriteStores.length}/15
          </span>
        </h2>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {myFavoriteStores.length > 0 ? (
          <div className="space-y-2">
            {myFavoriteStores.map((store, index) => (
              <div 
                key={store.id}
                className="group bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 transition-all duration-200 ease-in-out transform hover:scale-[1.02] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleSidebarFavoriteStoreClick(store)}
                    className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 group-hover:bg-blue-200 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm transition-colors shrink-0">
                        {index + 1}
                      </div>
                      <span className="text-gray-800 group-hover:text-blue-700 font-medium transition-colors line-clamp-2">
                        {store.name}
                      </span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleRemoveFromMyList(store)}
                    disabled={isRemovingFromList}
                    className="ml-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed group/remove"
                    title={`從 ${selectedStation.name} 移除 ${store.name}`}
                  >
                    {isRemovingFromList ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 group-hover/remove:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">尚無最愛店家</p>
            <p className="text-gray-400 text-sm">
              點擊地圖上的店家圖標，將喜歡的店家加入{selectedStation.name}的最愛清單
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoriteStores;