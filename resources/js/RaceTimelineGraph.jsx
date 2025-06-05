import React, {useEffect, useState} from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function RaceTimelineGraph() {
  const [driverOptions, setDriverOptions] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [positionHistory, setPositionHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log('Component state:', {
    selectedDriver,
    driverOptionsLength: driverOptions.length,
    positionHistoryLength: positionHistory.length,
    isLoading,
    error
  });

  // First useEffect: Fetch drivers (this works!)
  useEffect(() => {
    console.log('Fetching drivers...');

    async function fetchDrivers() {
      try {
        const response = await fetch('http://localhost:3001/api/drivers_with_position_data');
        console.log('Drivers response:', response.status, response.ok);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const drivers = await response.json();
        console.log('Loaded drivers:', drivers.length);

        setDriverOptions(drivers);

        if (drivers.length > 0) {
          setSelectedDriver(drivers[0].driver_number);
          console.log('Auto-selected driver:', drivers[0].driver_number);
        }
      } catch (error) {
        console.error('Error fetching drivers:', error);
        setError('Failed to load drivers: ' + error.message);
      }
    }

    fetchDrivers();
  }, []);

  // Second useEffect: Fetch position history for selected driver
  useEffect(() => {
    if (!selectedDriver) {
      console.log('No driver selected, skipping position fetch');
      return;
    }

    console.log('Fetching position history for driver:', selectedDriver);

    async function fetchPositionHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`http://localhost:3001/api/positions/history/${selectedDriver}`);
        console.log('Position history response:', response.status, response.ok);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data = await response.json();
        console.log('Raw position data:', data);

        // Handle case where backend returns error object instead of array
        if (!Array.isArray(data)) {
          if (data.message) {
            console.log('Backend message:', data.message);
            setPositionHistory([]);
            return;
          }
          throw new Error('Expected array but got: ' + typeof data);
        }

        // Process the data
        data = data.map(item => ({
          ...item,
          date: new Date(item.date)
        })).sort((a, b) => a.date - b.date);

        console.log('Processed position data:', data.length, 'records');
        setPositionHistory(data);

      } catch (error) {
        console.error('Error fetching position history:', error);
        setError('Failed to load position history: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPositionHistory();

    // Set up auto-refresh every 3 seconds
    const interval = setInterval(fetchPositionHistory, 3000);
    return () => {
      console.log('Clearing interval for driver:', selectedDriver);
      clearInterval(interval);
    };

  }, [selectedDriver]);

  const handleDriverChange = (event) => {
    const newDriver = parseInt(event.target.value);
    console.log('Driver changed to:', newDriver);
    setSelectedDriver(newDriver);
  };

  const formatXAxis = (tickItem) => {
    if (tickItem instanceof Date) {
      return tickItem.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    }
    return '';
  };

  const CustomTooltip = ({active, payload, label}) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#fff',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{margin: 0, fontWeight: 'bold'}}>
            Time: {new Date(label).toLocaleTimeString()}
          </p>
          <p style={{margin: 0, color: '#FF1801'}}>
            {payload[0].payload.full_name}: Position {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="race-timeline-container">
      {/* Driver Selection */}
      <div style={{marginBottom: '15px'}}>
        <label htmlFor="driver-select" style={{marginRight: '10px'}}>
          Select Driver:
        </label>
        <select
          id="driver-select"
          onChange={handleDriverChange}
          value={selectedDriver || ''}
          style={{padding: '5px', minWidth: '200px'}}
        >
          {driverOptions.map(driver => (
            <option key={driver.driver_number} value={driver.driver_number}>
              {driver.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Status Info */}
      <div style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '15px',
        display: 'flex',
        gap: '15px'
      }}>
        <span>Driver: {selectedDriver || 'None'}</span>
        <span>Records: {positionHistory.length}</span>
        {isLoading && <span style={{color: '#ff6600'}}>⟳ Updating...</span>}
      </div>

      {/* Error Display - lidt cute den popper op*/}
      {error && (
        <div style={{
          color: '#ff4444',
          backgroundColor: '#ffebee',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}

      {/* Chart - tager lige nu alle værdier den får ind og sætter på. Det lidt noget rod, men altså, sådan er det jo :)) */}
      {positionHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={positionHistory}
            margin={{top: 5, right: 30, left: 20, bottom: 5}}
          >
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              type="category"
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={[0, 22]}
              reversed={true}
              tickCount={11}
              label={{value: 'Position', angle: -90, position: 'insideLeft'}}
            />
            <Tooltip content={<CustomTooltip/>}/>
            <Legend/>
            <Line
              type="stepAfter"
              dataKey="position"
              stroke="#FF1801"
              strokeWidth={2}
              activeDot={{r: 6}}
              name="Position"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        !isLoading && selectedDriver && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px'
          }}>
            No position data available
            for {driverOptions.find(d => d.driver_number === selectedDriver)?.full_name || 'this driver'} yet.
            <br/>
            <small>Position data will appear as the race progresses.</small>
          </div>
        )
      )}

      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <details style={{marginTop: '20px', fontSize: '11px', color: '#999'}}>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify({
            selectedDriver,
            driverOptionsCount: driverOptions.length,
            positionHistoryCount: positionHistory.length,
            isLoading,
            error,
            lastUpdate: positionHistory.length > 0 ? positionHistory[positionHistory.length - 1]?.date : null
          }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
