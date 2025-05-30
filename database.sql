CREATE TABLE IF NOT EXISTS position_history (
    id SERIAL PRIMARY KEY,
    session_key INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    position INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add an index for faster queries on session_key and driver_number
CREATE INDEX IF NOT EXISTS idx_position_history_session_driver ON position_history (session_key, driver_number, date);
