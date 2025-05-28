// src/components/StationList.js
import React from 'react';

const StationList = ({ stationData, selectedStation, handleStationClick }) => {
  return (
    <div>
      <h2>捷運站點</h2>
      <ul>
        {stationData.map(station => (
          <li
            key={station.id}
            onClick={() => handleStationClick(station)}
            className={selectedStation?.id === station.id ? 'active-station' : ''}
          >
            {station.name} ({station.id})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StationList;