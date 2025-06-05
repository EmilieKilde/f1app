import "../css/index.css";
import Positions from './Positions.jsx';
import SpeedDisplay from './SpeedDisplay.jsx';
import RaceTimelineGraph from './RaceTimelineGraph.jsx';
import React from 'react';
import SpeedIcon from "./assets/speed_24dp_FF1801_FILL0_wght400_GRAD0_opsz24.svg?react";
import GraphIcon from "./assets/timeline_24dp_FF1801_FILL0_wght400_GRAD0_opsz24.svg?react";
import PosIcon from "./assets/social_leaderboard_24dp_FF1801_FILL0_wght400_GRAD0_opsz24.svg?react";

export default function Mainpage() {
  return (
    <div className="dashboard">
      <h2 className="dashboard-title">
        Live <span className="highlight">F1</span> data
      </h2>
      <div className="dashboard-grid">
        {/* Left section - Positions */}
        <div className="card positions">
          <div className="card-title">
            <PosIcon className="icon" width={24} height={24}/>
            Positions
          </div>
          <Positions/>
        </div>

        {/* Top right - Speed */}
        <div className="card">
          <div className="card-title">
            <SpeedIcon className="icon" width={24} height={24}/>
            Speed
          </div>
          <SpeedDisplay/>
        </div>
      </div>

      {/* Bottom - Race timeline */}
      <div className="card timeline">
        <div className="card-title">
          <GraphIcon className="icon" width={24} height={24}/>
          Race timeline
        </div>
        <RaceTimelineGraph/>
      </div>
    </div>

  );
}

