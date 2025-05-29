// src/components/StationList.js
import React from 'react';
import { lineColors } from '../data/stations';

const StationList = ({ 
  stationData, 
  selectedStation, 
  handleStationClick, 
  isSharedView = false 
}) => {
  // 根據路線獲取顏色的輔助函數
  const getLineColor = (station) => {
    if (station.lines && station.lines.length > 0) {
      const primaryLine = station.lines[0];
      return lineColors[primaryLine] || '#6B7280'; // 預設灰色
    }
    return '#6B7280';
  };

  // 根據路線獲取 Tailwind 類別的輔助函數
  const getLineColorClasses = (station, isSelected) => {
    if (station.lines && station.lines.length > 0) {
      const primaryLine = station.lines[0];
      if (primaryLine === 'red') {
        return {
          bg: isSelected ? 'bg-red-50' : 'bg-gray-50',
          border: isSelected ? 'border-red-300' : 'border-gray-200',
          ring: isSelected ? 'ring-red-200' : '',
          dot: isSelected ? 'bg-red-500' : 'bg-red-300',
          text: isSelected ? 'text-red-900' : 'text-gray-700',
          badge: isSelected ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500',
          indicator: 'bg-red-500',
          hover: 'hover:bg-red-25'
        };
      } else if (primaryLine === 'orange') {
        return {
          bg: isSelected ? 'bg-orange-50' : 'bg-gray-50',
          border: isSelected ? 'border-orange-300' : 'border-gray-200',
          ring: isSelected ? 'ring-orange-200' : '',
          dot: isSelected ? 'bg-orange-500' : 'bg-orange-300',
          text: isSelected ? 'text-orange-900' : 'text-gray-700',
          badge: isSelected ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500',
          indicator: 'bg-orange-500',
          hover: 'hover:bg-orange-25'
        };
      }
    }
    // 預設藍色（保留原有樣式）
    return {
      bg: isSelected ? 'bg-blue-50' : 'bg-gray-50',
      border: isSelected ? 'border-blue-300' : 'border-gray-200',
      ring: isSelected ? 'ring-blue-200' : '',
      dot: isSelected ? 'bg-blue-500' : 'bg-gray-300',
      text: isSelected ? 'text-blue-900' : 'text-gray-700',
      badge: isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500',
      indicator: 'bg-blue-500',
      hover: 'hover:bg-gray-100'
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-h-96 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        捷運站點
      </h2>
      
      <div className="space-y-2">
        {stationData.map(station => {
          const favoritesCount = station.favoritesCount || 0;
          const hasSharedFavorites = isSharedView && favoritesCount > 0;
          const isSelected = selectedStation?.id === station.id;
          const colorClasses = getLineColorClasses(station, isSelected);
          
          return (
            <div
              key={station.id}
              onClick={() => handleStationClick(station)}
              className={`
                relative p-3 rounded-lg border cursor-pointer transition-all duration-200 
                hover:shadow-md hover:scale-[1.02] transform
                ${colorClasses.bg} ${colorClasses.border} ${colorClasses.hover}
                ${isSelected ? `shadow-md ring-2 ${colorClasses.ring}` : ''}
                ${hasSharedFavorites ? 'border-l-4 border-l-orange-400' : ''}
              `.trim()}
              title={hasSharedFavorites ? `有 ${favoritesCount} 個分享收藏` : ''}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${colorClasses.dot}`} />
                  <span className={`font-medium ${colorClasses.text}`}>
                    {station.name}
                  </span>
                  <span className={`text-sm px-2 py-1 rounded-full ${colorClasses.badge}`}>
                    {station.id}
                  </span>
                </div>
                
                {hasSharedFavorites && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
                      {favoritesCount}
                    </span>
                  </div>
                )}
              </div>
              
              {isSelected && (
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClasses.indicator} rounded-l-lg`} />
              )}
            </div>
          );
        })}
      </div>
      
      {stationData.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 text-sm">暫無捷運站點資料</p>
        </div>
      )}
    </div>
  );
};

export default StationList;