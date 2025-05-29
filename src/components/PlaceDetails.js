// src/components/PlaceDetails.js
import React from 'react';

const PlaceDetails = ({ clickedPlace, handleClosePlaceInfo }) => {
  return (
    <div className="bg-white shadow-xl rounded-lg p-6 max-w-md mx-auto border border-gray-200">
      {/* 標題區域 */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-gray-800 flex-1 pr-2">{clickedPlace.name}</h3>
        <button 
          onClick={handleClosePlaceInfo} 
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
          aria-label="關閉資訊"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 照片區域 */}
      {clickedPlace.photos?.length > 0 && (
        <div className="mb-4">
          <img
            src={clickedPlace.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })}
            alt={`${clickedPlace.name} 的照片`}
            className="w-full h-48 object-cover rounded-lg shadow-md"
          />
        </div>
      )}

      {/* 地址區域 */}
      <div className="mb-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-700">{clickedPlace.address}</p>
        </div>
      </div>

      {/* 評分區域 */}
      {clickedPlace.rating !== undefined && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-sm font-medium text-gray-800 ml-1">{clickedPlace.rating}</span>
            </div>
            <span className="text-xs text-gray-500">({clickedPlace.userRatingsTotal || 0} 則評論)</span>
          </div>
        </div>
      )}

      {/* 營業狀態 */}
      {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${clickedPlace.openingHours.open_now ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${clickedPlace.openingHours.open_now ? 'text-green-600' : 'text-red-600'}`}>
              {clickedPlace.openingHours.open_now ? '營業中' : '休息中'}
            </span>
          </div>
        </div>
      )}

      {/* 詳細營業時間 */}
      {clickedPlace.openingHours?.weekday_text && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            營業時間
          </h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            {clickedPlace.openingHours.weekday_text.map((dailyHours, index) => (
              <div key={index} className="text-xs text-gray-600 leading-relaxed">
                {dailyHours}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 關閉按鈕 */}
      <div className="pt-2 border-t border-gray-100">
        <button 
          onClick={handleClosePlaceInfo} 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          關閉資訊
        </button>
      </div>
    </div>
  );
};

export default PlaceDetails;