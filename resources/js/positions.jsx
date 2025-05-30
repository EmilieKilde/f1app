import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

export default function Positions() {
  const [positions, setPositions] = useState([]);

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

    async function fetchPositions() {
      try {
        const sessionKey = await fetchLatestRaceSessionKey();
        if (!sessionKey) {
          console.error("Ingen aktive løb");
          return;
        }

        const positionResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}`);
        const positionData = await positionResponse.json();

        const driverResponse = await fetch('https://api.openf1.org/v1/drivers?session_key=10033');
        const driverData = await driverResponse.json();

        const latestPositionsMap = new Map();
        positionData.forEach(pos => {
          latestPositionsMap.set(pos.driver_number, pos);
        });

        const latestPositions = Array.from(latestPositionsMap.values());

        const validTeams = [
          'Red Bull Racing', 'Ferrari', 'McLaren', 'Mercedes', 'Aston Martin',
          'Alpine', 'Williams', 'Haas F1 Team', 'Racing Bulls', 'Kick Sauber'
        ];

        const activeDrivers = driverData
          //.filter(driver => driver.position >= 1 && driver.position <= 20)
          .map(driver => {
            const driverInfo = latestPositions.find(d => d.driver_number === driver.driver_number);
            return {
              ...driver,
              name: driverInfo ? driverInfo.full_name : `Driver #${driver.driver_number}`,
              team: driverInfo ? driverInfo.team_name : 'Unknown',
              position: driverInfo ? driverInfo.position : null
            };
          })
          .filter(driver =>
            validTeams.includes(driver.team)
          )
          .sort((a, b) => a.position - b.position);

        setPositions(activeDrivers);
      } catch (error) {
        console.error('Fejl: Kan ikke fetche positioner:', error);
      }
    }


    fetchPositions();


    const interval = setInterval(fetchPositions, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="positions-list">
      {positions.length === 0 ? (
        <div>Loading positions...</div>
      ) : (
        <AnimatePresence>
          {positions.map((driver, index) => (
            <motion.div
              key={driver.driver_number}
              layout //
              initial={{opacity: 0, y: -20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 20}}
              transition={{duration: 0.4}}
              className="positions-item"
            >
              #{index + 1}-{driver.name}({driver.team})
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

