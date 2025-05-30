import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

export default function SpeedDisplay() {
  const [driverSpeeds, setDriverSpeeds] = useState({}); // Stores driver_number: speed

  useEffect(() => {
    async function fetchLatestRaceSessionKey() {
      const sessionResponse = await fetch('https://api.openf1.org/v1/sessions');
      const sessions = await sessionResponse.json();

      const raceSessions = sessions
        .filter(s => s.session_type === "Race")
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      const latestRace = raceSessions[0];

      return latestRace ? latestRace.session_key : null;
    }

    async function fetchSpeedData() {
      try {
        const sessionKey = await fetchLatestRaceSessionKey();
        if (!sessionKey) {
          console.error("No active races found to fetch speed data.");
          return;
        }

        // Fetch car data which includes speed
        const carDataResponse = await fetch(`https://api.openf1.org/v1/car_data?session_key=${sessionKey}`);
        const carData = await carDataResponse.json();

        // Fetch driver data to get names
        const driverResponse = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
        const driverData = await driverResponse.json();
        const driverMap = new Map(driverData.map(driver => [driver.driver_number, driver.full_name]));


        const latestSpeeds = {};
        // Group car data by driver and find the latest speed for each
        carData.forEach(data => {
          if (!latestSpeeds[data.driver_number] || data.date > latestSpeeds[data.driver_number].date) {
            latestSpeeds[data.driver_number] = {
              speed: data.speed,
              date: data.date,
              full_name: driverMap.get(data.driver_number) || `Driver #${data.driver_number}`
            };
          }
        });

        setDriverSpeeds(latestSpeeds);

      } catch (error) {
        console.error('Error fetching speed data:', error);
      }
    }

    fetchSpeedData();
    const interval = setInterval(fetchSpeedData, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="speed-list">
      {Object.keys(driverSpeeds).length === 0 ? (
        <div>Loading speeds...</div>
      ) : (
        <AnimatePresence>
          {Object.entries(driverSpeeds)
            .sort(([, a], [, b]) => b.speed - a.speed) // Sort by speed descending
            .map(([driverNumber, data]) => (
              <motion.div
                key={driverNumber}
                layout
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: 20}}
                transition={{duration: 0.4}}
                className="speed-item"
              >
                {data.full_name}: {data.speed} km/h
              </motion.div>
            ))}
        </AnimatePresence>
      )}
    </div>
  );
}
