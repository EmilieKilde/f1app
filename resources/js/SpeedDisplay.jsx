import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion'; // Keep these for potential animations

export default function SpeedDisplay() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverOptions, setDriverOptions] = useState([]); // To populate the dropdown
  const [currentSpeed, setCurrentSpeed] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const backendUrl = 'http://localhost:3001'; // Your backend URL

  // Fetch list of drivers who have position data (to select from)
  useEffect(() => {
    async function fetchDrivers() {
      try {
        const response = await fetch(`${backendUrl}/api/drivers_with_position_data`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const drivers = await response.json();
        setDriverOptions(drivers);
        if (drivers.length > 0) {
          setSelectedDriver(drivers[0].driver_number); // Select the first driver by default
        }
      } catch (err) {
        console.error("Error fetching driver options for SpeedDisplay:", err);
        setError("Failed to load driver options.");
      }
    }

    fetchDrivers();
  }, []);

  // Fetch speed for the selected driver
  useEffect(() => {
    async function fetchSpeed() {
      if (!selectedDriver) {
        setCurrentSpeed(null); // Clear speed if no driver selected
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendUrl}/api/current_speed/${selectedDriver}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCurrentSpeed(data);
      } catch (err) {
        console.error(`Error fetching speed for driver ${selectedDriver}:`, err);
        setError("Failed to load speed data.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSpeed();
    const interval = setInterval(fetchSpeed, 1000); // Fetch speed every 1 second
    return () => clearInterval(interval);

  }, [selectedDriver]); // Re-run when selectedDriver changes

  const handleDriverChange = (event) => {
    setSelectedDriver(parseInt(event.target.value));
  };

  if (error) {
    return <div className="speed-display-container error-message">{error}</div>;
  }

  if (isLoading && currentSpeed === null) {
    return <div className="speed-display-container">Loading speed data...</div>;
  }

  return (
    <div className="speed-display-container">
      <div className="driver-select">
        <label htmlFor="speed-driver-select">Select Driver: </label>
        <select id="speed-driver-select" onChange={handleDriverChange} value={selectedDriver || ''}>
          {driverOptions.map(driver => (
            <option key={driver.driver_number} value={driver.driver_number}>
              {driver.full_name}
            </option>
          ))}
        </select>
      </div>

      {currentSpeed ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSpeed.speed} // Animate on speed change
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -20}}
            transition={{duration: 0.3}}
            className="speed-value"
          >
            {currentSpeed.full_name}: <span className="highlight-speed">{currentSpeed.speed}</span> km/h
            <div className="speed-timestamp">
              (Last updated: {new Date(currentSpeed.date).toLocaleTimeString()})
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        !isLoading && <p>No speed data available for the selected driver yet.</p>
      )}
    </div>
  );
}
