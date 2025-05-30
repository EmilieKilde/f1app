import dotenv from 'dotenv';

dotenv.config(); // Call config() after import

import express from 'express';
import pkg from 'pg'; // import as 'pkg' because Pool is a named export or property
const {Pool} = pkg; // Destructure Pool from pkg

import cors from 'cors';
import cron from 'node-cron'; // node-cron also supports import

const app = express();
const port = 3001; // Backend runs on port 3001

app.use(cors());
app.use(express.json());

// PostgreSQL connection pool - UPDATED VARIABLE NAMES
const pool = new Pool({
  user: process.env.DB_NODE_USER,      // Use DB_NODE_USER
  host: process.env.DB_NODE_HOST,      // Use DB_NODE_HOST
  database: process.env.DB_NODE_DATABASE, // Use DB_NODE_DATABASE
  password: process.env.DB_NODE_PASSWORD, // Use DB_NODE_PASSWORD
  port: process.env.DB_NODE_PORT,      // Use DB_NODE_PORT
});

// Function to fetch the latest race session key
async function fetchLatestRaceSessionKey() {
  try {
    const sessionResponse = await fetch('https://api.openf1.org/v1/sessions');
    if (!sessionResponse.ok) {
      throw new Error(`HTTP error! status: ${sessionResponse.status}`);
    }
    const sessions = await sessionResponse.json();

    const raceSessions = sessions
      .filter(s => s.session_type === "Race")
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    const latestRace = raceSessions[0];
    return latestRace ? latestRace.session_key : null;
  } catch (error) {
    console.error("Error fetching latest session key:", error);
    return null;
  }
}

// Function to fetch and save position data
async function fetchAndSavePositions() {
  console.log("Fetching and saving position data...");
  let client;
  try {
    client = await pool.connect();
    const sessionKey = await fetchLatestRaceSessionKey();
    if (!sessionKey) {
      console.warn("No active race session found. Skipping position data fetch.");
      return;
    }

    const positionResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}`);
    if (!positionResponse.ok) {
      throw new Error(`HTTP error! status: ${positionResponse.status}`);
    }
    const positionData = await positionResponse.json();

    const driverResponse = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
    if (!driverResponse.ok) {
      throw new Error(`HTTP error! status: ${driverResponse.status}`);
    }
    const driverData = await driverResponse.json();
    const driverMap = new Map(driverData.map(d => [d.driver_number, d]));

    const validTeams = [
      'Red Bull Racing', 'Ferrari', 'McLaren', 'Mercedes', 'Aston Martin',
      'Alpine', 'Williams', 'Haas F1 Team', 'Racing Bulls', 'Kick Sauber'
    ];

    const latestPositionsMap = new Map();
    positionData.forEach(pos => {
      if (!latestPositionsMap.has(pos.driver_number) || new Date(pos.date) > new Date(latestPositionsMap.get(pos.driver_number).date)) {
        latestPositionsMap.set(pos.driver_number, pos);
      }
    });

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
        }
      }
    }
    console.log("Position data saved successfully.");

  } catch (error) {
    console.error("Error fetching or saving position data:", error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

cron.schedule('*/3 * * * * *', () => {
  fetchAndSavePositions();
});

app.get('/api/positions/history/:driverNumber', async (req, res) => {
  const {driverNumber} = req.params;
  try {
    const sessionKey = await fetchLatestRaceSessionKey();
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
    const sessionKey = await fetchLatestRaceSessionKey();
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
