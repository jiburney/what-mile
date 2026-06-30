-- Grant permissions to service_role for daily challenge tables
-- Run this in Supabase SQL Editor

GRANT ALL ON TABLE daily_challenges TO service_role;
GRANT ALL ON TABLE daily_scores TO service_role;
GRANT ALL ON TABLE photos TO service_role;

-- Grant usage on sequences (for auto-incrementing IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
