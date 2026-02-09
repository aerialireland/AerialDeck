// Supabase client configuration
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xvevvssehmtbpkcztzmj.supabase.co';

// Use service role key for server-side operations (bypasses RLS)
// Falls back to anon key for backwards compatibility
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZXZ2c3NlaG10YnBrY3p0em1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAxMzMsImV4cCI6MjA4NTYxNjEzM30._ed3mYbiO_9XkxFus6-c5Io_Tp3WXkc_OzvE8qWIa1c';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
