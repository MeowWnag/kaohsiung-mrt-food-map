// src/data/stations.js

export const stationData = [
  {
    id: 'O7',
    name: '文化中心',
    lines: ['orange'],
    //coords: { x: '43.45%', y: '61.28%' },
    coords: { x: '43.45%', y: '61.28%' },
    // 選項 1: 只儲存 Plus Code
    plusCode: '87QJ+GR 高雄市 前金區', // 範例 Plus Code (文化中心站附近)
    realCoords: { lat: 22.630488326745954, lng: 120.31758363974788 }, // Google Maps 實際經緯度 (文化中心站大約位置)
  }
  // ... 其他站點
];

export const lineColors = {
  red: '#DC0451',
  orange: '#FF6F00',
};