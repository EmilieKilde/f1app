import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

export default function Positions() {
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const backendUrl = 'http://localhost:3001';
  useEffect(() => {
    const fetchCurrentPositions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendUrl}/api/current_positions`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPositions(data);
      } catch (err) {
        console.error("Failed to fetch current positions from backend:", err);
        setError("Failed to load current positions.");
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch initially
    fetchCurrentPositions();

    // Set up interval to refetch every 3 seconds
    const intervalId = setInterval(fetchCurrentPositions, 3000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  if (isLoading && positions.length === 0) {
    return <div className="positions-list">Loading positions...</div>;
  }

  if (error) {
    return <div className="positions-list error-message">{error}</div>;
  }

  if (positions.length === 0 && !isLoading) {
    return <div className="positions-list">No current position data available.</div>;
  }

  return (
    <div className="positions-list">
      <AnimatePresence>
        {positions.map((driver, index) => (
          <motion.div
            key={driver.driver_number} // Use driver_number as key as it's unique and stable
            layout
            initial={{opacity: 0, y: -20}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 20}}
            transition={{duration: 0.4}}
            className="positions-item"
            style={{borderLeft: `5px solid #${driver.team_color}`}} {/* Add team color stripe */}
          >
            <span className="position-number">#{driver.position}</span>
            <span className="driver-name">{driver.full_name}</span>
            <span className="team-name">({driver.team_name})</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
