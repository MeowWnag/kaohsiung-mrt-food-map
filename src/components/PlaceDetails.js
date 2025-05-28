// src/components/PlaceDetails.js
import React from 'react';

const PlaceDetails = ({ clickedPlace, handleClosePlaceInfo }) => {
  return (
    <div className="place-details-sidebar">
      <h3>{clickedPlace.name}</h3>
      {clickedPlace.photos?.length > 0 && (
        <img
          src={clickedPlace.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })}
          alt={`${clickedPlace.name} 的照片`}
          style={{ width: '100%', height: 'auto', marginTop: '10px', borderRadius: '4px', marginBottom: '10px' }}
        />
      )}
      <p>地址: {clickedPlace.address}</p>
      {clickedPlace.rating !== undefined && (
        <p>評分: {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 0} 則評論)</p>
      )}
      {clickedPlace.openingHours && typeof clickedPlace.openingHours.open_now === 'boolean' && (
        <div
          style={{
            fontSize: '0.9em',
            marginTop: '10px',
            marginBottom: clickedPlace.openingHours?.weekday_text ? '0px' : '5px',
            color: clickedPlace.openingHours.open_now ? 'green' : 'red',
            fontWeight: 'bold',
          }}
        >
          目前狀態: {clickedPlace.openingHours.open_now ? '營業中' : '休息中'}
        </div>
      )}
      {clickedPlace.openingHours?.weekday_text && (
        <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
          <strong>詳細營業時間:</strong>
          <div style={{ paddingLeft: '15px', marginTop: '3px', marginBottom: '5px' }}>
            {clickedPlace.openingHours.weekday_text.map((dailyHours, index) => (
              <div key={index} style={{ marginBottom: '1px' }}>{dailyHours}</div>
            ))}
          </div>
        </div>
      )}
      <button onClick={handleClosePlaceInfo} style={{ marginTop: '10px', marginLeft: '5px' }}>
        關閉資訊
      </button>
    </div>
  );
};

export default PlaceDetails;