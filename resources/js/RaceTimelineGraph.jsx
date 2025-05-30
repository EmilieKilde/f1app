import React, {useEffect, useState} from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function RaceTimelineGraph() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverOptions, setDriverOptions] = useState([]);
  const [positionHistory, setPositionHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const backendUrl = 'http://localhost:3001'; // Your backend URL

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
          setSelectedDriver(drivers[0].driver_number);
        }
      } catch (err) {
        console.error("Error fetching driver options:", err);
        setError("Failed to load driver options.");
      }
    }

    fetchDrivers();
  }, []);

  useEffect(() => {
    async function fetchPositionHistory() {
      if (!selectedDriver) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`<span class="math-inline">\{backendUrl\}/api/positions/history/</span>{selectedDriver}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();

        data = data.map(item => ({
          ...item,
          date: new Date(item.date)
        })).sort((a, b) => a.date - b.date);

        setPositionHistory(data);
      } catch (err) {
        console.error(`Error fetching position history for driver ${selectedDriver}:`, err);
        setError("Failed to load position history.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPositionHistory();
    const interval = setInterval(fetchPositionHistory, 3000);
    return () => clearInterval(interval);

  }, [selectedDriver]);

  const handleDriverChange = (event) => {
    setSelectedDriver(parseInt(event.target.value));
  };

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (isLoading && positionHistory.length === 0) {
    return <div>Loading race timeline...</div>;
  }

  const formatXAxis = (tickItem) => {
    if (tickItem instanceof Date) {
      return tickItem.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    }
    return '';
  };

  const CustomTooltip = ({active, payload, label}) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc'}}>
          <p className="label">{`Time: ${new Date(label).toLocaleTimeString()}`}</p>
          <p className="intro">{`${payload[0].payload.full_name}: Position ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const fixedMinY = 0;
  const fixedMaxY = 22;

  return (
    <div className="race-timeline-container">
      <div className="driver-select">
        <label htmlFor="driver-select">Select Driver: </label>
        <select id="driver-select" onChange={handleDriverChange} value={selectedDriver || ''}>
          {driverOptions.map(driver => (
            <option key={driver.driver_number} value={driver.driver_number}>
              {driver.full_name}
            </option>
          ))}
        </select>
      </div>

      {positionHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={positionHistory}
            margin={{
              top: 5, right: 30, left: 20, bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              type="category"
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={[fixedMinY, fixedMaxY]}
              reversed={true}
              tickCount={22}
              label={{value: 'Position', angle: -90, position: 'insideLeft'}}
            />
            <Tooltip content={<CustomTooltip/>}/>
            <Legend/>
            <Line
              type="stepAfter"
              dataKey="position"
              stroke="#FF1801"
              activeDot={{r: 8}}
              name="Position"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        !isLoading && <p>No position data available for the selected driver yet.</p>
      )}
    </div>
  );
}
