import dotenv from 'dotenv';

dotenv.config(); // Call config() after import

import express from 'express';
import pkg from 'pg'; // import as 'pkg' because Pool is a named export or property
const {Pool} = pkg; // Destructure Pool from pkg

import cors from 'cors';
import cron from 'node-cron'; // node-cron also supports import

const app = express();
const port = 3001; // Backend runs on port 3001
const TESTING_MODE = true;
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool - UPDATED VARIABLE NAMES
const pool = new Pool({
  user: process.env.DB_NODE_USER,      // Use DB_NODE_USER
  host: process.env.DB_NODE_HOST,      // Use DB_NODE_HOST
  database: process.env.DB_NODE_DATABASE, // Use DB_NODE_DATABASE
  password: process.env.DB_NODE_PASSWORD, // Use DB_NODE_PASSWORD
  port: Number(process.env.DB_NODE_PORT),      // Use DB_NODE_PORT
});

// Function to fetch the latest race session key
async function fetchLatestRaceSessionKey() {
  try {
    const sessionResponse = await fetch('https://api.openf1.org/v1/sessions?session_key=9971');
    if (!sessionResponse.ok) {
      throw new Error(`HTTP error! status: ${sessionResponse.status}`);
    }

    const sessions = await sessionResponse.json();

    const targetSessions = sessions
      .filter(s => {
        const sessionEndTime = new Date(s.date_end);
        const isTargetType = (s.session_type === "Qualifying" || s.session_type === "Race");
        return isTargetType && sessionEndTime != null;
      })
      .sort((a, b) => new Date(b.date_end) - new Date(a.date_end));

    const latestSession = targetSessions[0];

    if (latestSession) {
      console.log(`[LIVE] Selected session: ${latestSession.session_name} (${latestSession.session_type}, Key: ${latestSession.session_key})`);
      return latestSession.session_key;
    } else {
      console.warn("[LIVE] No suitable sessions found");
      return null;
    }
  } catch (error) {
    console.error("Error fetching latest session key:", error);
    return null;
  }
}

// Function to fetch and save position data
async function fetchAndSavePositions() {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Database connection established");

    //const sessionKey = await fetchLatestRaceSessionKey();
    const sessionKey = '9971';
    console.log(`Session key result: ${sessionKey}`);

    if (!sessionKey) {
      console.warn("❌ No session found. Skipping position data fetch.");
      return;
    }

    console.log(`🏁 Fetching position data for session: ${sessionKey}`);
    const positionResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}`);

    if (!positionResponse.ok) {
      throw new Error(`HTTP error! status: ${positionResponse.status}`);
    }

    const positionData = await positionResponse.json();
    console.log(`📊 Retrieved ${positionData.length} position data points`);

    if (positionData.length === 0) {
      console.warn("⚠️ No position data found for this session");
      return;
    }

    console.log(`🏎️ Fetching driver data for session: ${sessionKey}`);
    const driverResponse = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);

    if (!driverResponse.ok) {
      throw new Error(`HTTP error! status: ${driverResponse.status}`);
    }

    const driverData = await driverResponse.json();
    console.log(`👨‍🏁 Retrieved ${driverData.length} drivers`);

    const driverMap = new Map(driverData.map(d => [d.driver_number, d]));

    const validTeams = [
      'Red Bull Racing', 'Ferrari', 'McLaren', 'Mercedes', 'Aston Martin',
      'Alpine', 'Williams', 'Haas F1 Team', 'Racing Bulls', 'Kick Sauber'
    ];

    if (TESTING_MODE) {
      // In test mode, simulate live data by taking position data from different time points
      // and treating them as if they're happening now
      console.log("🧪 TEST MODE: Simulating live data updates");

      // Group position data by timestamp and take several recent ones
      const positionsByTime = new Map();
      positionData.forEach(pos => {
        if (!positionsByTime.has(pos.date)) {
          positionsByTime.set(pos.date, []);
        }
        positionsByTime.get(pos.date).push(pos);
      });

      // Get the last few timestamps
      const timestamps = Array.from(positionsByTime.keys())
        .sort()
        .slice(-5); // Take last 5 timestamps

      console.log(`Found ${timestamps.length} different timestamps to simulate`);

      // Process each timestamp as if it's happening now
      for (const timestamp of timestamps) {
        const positions = positionsByTime.get(timestamp);
        console.log(`Processing ${positions.length} positions from ${timestamp}`);

        for (const pos of positions) {
          const driverInfo = driverMap.get(pos.driver_number);
          if (driverInfo && validTeams.includes(driverInfo.team_name)) {
            const full_name = driverInfo.full_name;
            const team_name = driverInfo.team_name;
            const position = pos.position;
            // Use current time instead of historical time to simulate live data
            const fakeDate = new Date(); // Current time!

            // Add some randomness to avoid duplicate timestamps
            fakeDate.setMilliseconds(fakeDate.getMilliseconds() + Math.random() * 1000);

            const exists = await client.query(
              `SELECT 1
               FROM position_history
               WHERE driver_number = $1
                 AND position = $2
                 AND date = $3`,
              [pos.driver_number, position, fakeDate]
            );

            if (exists.rows.length === 0) {
              await client.query(
                `INSERT INTO position_history (session_key, driver_number, full_name, team_name, position, date)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [sessionKey, pos.driver_number, full_name, team_name, position, fakeDate]
              );
              console.log(`✅ Inserted (simulated): ${full_name} - Position ${position}`);
            }
          }
        }

        // Add a small delay between timestamps to spread out the data
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      // Original live mode logic
      const latestPositionsMap = new Map();
      positionData.forEach(pos => {
        if (!latestPositionsMap.has(pos.driver_number) || new Date(pos.date) > new Date(latestPositionsMap.get(pos.driver_number).date)) {
          latestPositionsMap.set(pos.driver_number, pos);
        }
      });

      console.log(`🔄 Processing ${latestPositionsMap.size} unique drivers with latest positions`);
      for (const [driverNumber, pos] of latestPositionsMap.entries()) {
        const driverInfo = driverMap.get(driverNumber);

        if (driverInfo && validTeams.includes(driverInfo.team_name)) {
          const full_name = driverInfo.full_name;
          const team_name = driverInfo.team_name;
          const position = pos.position;
          const date = new Date(pos.date);

          const exists = await client.query(
            `SELECT 1
             FROM position_history
             WHERE driver_number = $1
               AND position = $2
               AND date = $3`,
            [driverNumber, position, date]
          );

          if (exists.rows.length === 0) {
            await client.query(
              `INSERT INTO position_history (session_key, driver_number, full_name, team_name, position, date)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [sessionKey, driverNumber, full_name, team_name, position, date]
            );
            console.log(`✅ Inserted: ${full_name} - Position ${position}`);
          }
        }
      }
    }

    console.log("✅ Position data processing completed successfully.");

  } catch (error) {
    console.error("❌ Error in fetchAndSavePositions:", error);
  } finally {
    if (client) {
      client.release();
      console.log("🔌 Database connection released");
    }
  }
}

cron.schedule('*/5 * * * * *', () => {
  fetchAndSavePositions();
});

// Enhanced API endpoints with detailed logging
app.get('/api/current_positions', async (req, res) => {
  try {
    //const sessionKey = await fetchLatestRaceSessionKey();
    const sessionKey = '9971';
    if (!sessionKey) {
      return res.status(404).json({message: "No active session found."});
    }
    const positionResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}&order=desc&limit=500`);

    const positionData = await positionResponse.json();

    const driversResponse = await fetch('https://api.openf1.org/v1/drivers');
    const drivers = await driversResponse.json();

    const validTeams = ['Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Aston Martin',
      'Alpine', 'Williams', 'Haas F1 Team', 'Racing Bulls', 'Kick Sauber'];

    const currentPositions = [];

    for (const pos of positionData) {
      const driverInfo = drivers.find(d => d.driver_number == pos.driver_number);

      if (pos.position != null && driverInfo && validTeams.includes(driverInfo.team_name)) {
        currentPositions.push({
          driver_number: pos.driver_number,
          team_name: driverInfo.team_name,
          full_name: `${driverInfo.first_name} ${driverInfo.last_name}`,
          position: pos.position
        });
      }
    }

    // ✅ Deduplicate by driver_number
    const seen = new Set();
    const uniquePositions = [];

    for (const entry of currentPositions) {
      if (!seen.has(entry.driver_number)) {
        uniquePositions.push(entry);
        seen.add(entry.driver_number);
      }
    }

    res.json(uniquePositions);
  } catch (error) {
    console.error('Error fetching current positions:', error);
    res.status(500).json({error: 'Internal server error'});
  }
});


app.get('/api/current_speed/:driverNumber', async (req, res) => {
  const {driverNumber} = req.params;
  console.log(`\n=== API: /api/current_speed/${driverNumber} called ===`);

  try {
    //const sessionKey = await fetchLatestRaceSessionKey();
    const sessionKey = '9971';
    if (!sessionKey) {
      return res.status(404).json({message: "No active session found."});
    }

    // Get driver info first
    const driverResponse = await fetch(`https://api.openf1.org/v1/drivers?session_key=9971&driver_number=${driverNumber}`);

    if (!driverResponse.ok) {
      throw new Error(`HTTP error! status: ${driverResponse.status}`);
    }

    const driverInfo = (await driverResponse.json())[0];

    if (!driverInfo) {
      return res.status(404).json({message: "Driver not found in this session."});
    }

    if (TESTING_MODE) {
      // In test mode, generate realistic fake speed data
      console.log("🧪 TEST MODE: Generating simulated speed data");

      // Generate realistic F1 speeds (200-350 km/h)
      const baseSpeed = 250 + Math.random() * 100; // 250-350 km/h
      const speed = Math.round(baseSpeed * 10) / 10; // Round to 1 decimal

      const speedResponse = {
        driver_number: driverNumber,
        full_name: driverInfo.full_name,
        speed: speed,
        date: new Date().toISOString()
      };

      console.log(`Generated speed data: ${driverInfo.full_name} - ${speed} km/h`);
      res.json(speedResponse);

    } else {
      // Live mode - get real speed from OpenF1
      console.log("🔴 LIVE MODE: Getting real speed from OpenF1");

      const carDataResponse = await fetch(`https://api.openf1.org/v1/car_data?session_key=9971&driver_number=${driverNumber}&limit=1&order=desc`);

      if (!carDataResponse.ok) {
        throw new Error(`HTTP error! status: ${carDataResponse.status}`);
      }

      const carData = await carDataResponse.json();

      if (carData.length === 0) {
        return res.status(404).json({message: "No car data found for this driver in the current session."});
      }

      const latestCarData = carData[0];

      if (!latestCarData || !latestCarData.speed) {
        return res.status(404).json({message: "Speed data not available for this driver."});
      }

      const speedResponse = {
        driver_number: driverNumber,
        full_name: driverInfo.full_name,
        speed: latestCarData.speed,
        date: latestCarData.date
      };

      res.json(speedResponse);
    }

  } catch (error) {
    console.error(`Error fetching speed for driver ${driverNumber}:`, error);
    res.status(500).json({message: "Internal server error"});
  }
});
app.get('/api/positions/history/:driverNumber', async (req, res) => {
  const {driverNumber} = req.params;
  try {
    //const sessionKey = await fetchLatestRaceSessionKey();
    const sessionKey = '9971';
    if (!sessionKey) {
      return res.status(404).json({message: "No active race session found."});
    }

    const result = await pool.query(
      `SELECT driver_number, full_name, position, date
       FROM position_history
       WHERE driver_number = $1
         AND session_key = $2
       ORDER BY date ASC`,
      [driverNumber, sessionKey]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching historical positions:", error);
    res.status(500).json({message: "Internal server error"});
  }
});

app.get('/api/drivers_with_position_data', async (req, res) => {
  try {
    //const sessionKey = await fetchLatestRaceSessionKey();
    const sessionKey = '9971';
    if (!sessionKey) {
      return res.json([]);
    }
    const result = await pool.query(
      `SELECT DISTINCT driver_number, full_name
       FROM position_history
       WHERE session_key = $1
       ORDER BY full_name ASC`,
      [sessionKey]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching drivers with position data:", error);
    res.status(500).json({message: "Internal server error"});
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  fetchAndSavePositions();
});
