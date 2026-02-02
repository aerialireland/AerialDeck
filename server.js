const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Import Supabase client
const supabase = require('./database/supabase.js');

// Import local data for evidence (file-based storage for now)
const localData = require('./database/local-data.js');

// ============ FILE UPLOAD SETUP ============
// Vercel has read-only filesystem - use /tmp or memory storage
const isVercel = process.env.VERCEL === '1';
let uploadsDir = '/tmp/uploads/evidence';

// Only try to create dirs if not on Vercel (or use /tmp on Vercel)
if (!isVercel) {
  uploadsDir = path.join(__dirname, 'public', 'uploads', 'evidence');
}
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.log('Note: Could not create uploads dir (expected on Vercel):', err.message);
}

// Configure multer for evidence file uploads
// On Vercel, use memory storage since filesystem is ephemeral
const storage = isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    const planId = req.params.planId;
    const category = req.params.category;
    const dir = path.join(uploadsDir, planId, category);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.log('Could not create upload dir:', err.message);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

// CSV upload for AirData logs
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'changeme';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'aerialdeck-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ============ AUTH ROUTES ============
app.post('/api/login', (req, res) => {
  if (req.body.password === DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// ============ SUPABASE DATA ROUTES ============

// Get flight plans with stats
app.get('/api/flight-plans', requireAuth, async (req, res) => {
  try {
    // Get flight plans
    const { data: plans, error: plansError } = await supabase
      .from('flight_plans')
      .select('*')
      .order('date', { ascending: false });

    if (plansError) throw plansError;

    // Get flight logs for stats
    const { data: logs, error: logsError } = await supabase
      .from('flight_logs')
      .select('flight_plan_id, air_time_minutes');

    if (logsError) throw logsError;

    // Calculate stats for each plan
    const plansWithStats = plans.map(plan => {
      const planLogs = logs.filter(l => l.flight_plan_id === plan.id);
      return {
        ...plan,
        flight_count: planLogs.length,
        total_air_time: planLogs.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0)
      };
    });

    res.json(plansWithStats);
  } catch (err) {
    console.error('Error fetching flight plans:', err);
    res.status(500).json({ error: 'Failed to fetch flight plans' });
  }
});

// Create a new flight plan
app.post('/api/flight-plans', requireAuth, async (req, res) => {
  try {
    const { name, date, location, geozone, max_altitude, status } = req.body;

    const { data, error } = await supabase
      .from('flight_plans')
      .insert([{
        name,
        date,
        location,
        geozone: geozone || null,
        max_altitude: max_altitude || 120,
        status: status || 'Planned'
      }])
      .select()
      .single();

    if (error) throw error;

    // Initialize evidence for this plan
    localData.flightPlanEvidence[data.id] = {
      planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: 'Zephyr CC MVC3' },
      flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
      airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };

    res.json(data);
  } catch (err) {
    console.error('Error creating flight plan:', err);
    res.status(500).json({ error: 'Failed to create flight plan' });
  }
});

// Update a flight plan
app.put('/api/flight-plans/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, location, geozone, max_altitude, status } = req.body;

    const { data, error } = await supabase
      .from('flight_plans')
      .update({ name, date, location, geozone, max_altitude, status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating flight plan:', err);
    res.status(500).json({ error: 'Failed to update flight plan' });
  }
});

// Get flight logs
app.get('/api/flight-logs', requireAuth, async (req, res) => {
  try {
    const { plan_id, limit = 100 } = req.query;

    let query = supabase
      .from('flight_logs')
      .select('*, flight_plans(name)')
      .order('date_time_utc', { ascending: false })
      .limit(parseInt(limit));

    if (plan_id) {
      query = query.eq('flight_plan_id', parseInt(plan_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const formattedLogs = data.map(log => ({
      ...log,
      flight_plan_name: log.flight_plans?.name || 'Unknown'
    }));

    res.json(formattedLogs);
  } catch (err) {
    console.error('Error fetching flight logs:', err);
    res.status(500).json({ error: 'Failed to fetch flight logs' });
  }
});

// Create a new flight log (manual entry)
app.post('/api/flight-logs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flight_logs')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error creating flight log:', err);
    res.status(500).json({ error: 'Failed to create flight log' });
  }
});

// Import AirData CSV
app.post('/api/flight-logs/import-airdata', requireAuth, csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { flight_plan_id, drone, pic, assistant } = req.body;
    if (!flight_plan_id) {
      return res.status(400).json({ error: 'Flight plan ID is required' });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString();
    const records = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Extract summary data from telemetry
    const firstRow = records[0];
    const lastRow = records[records.length - 1];

    // Calculate duration from milliseconds
    const durationMs = parseInt(lastRow['time(millisecond)']) - parseInt(firstRow['time(millisecond)']);
    const durationMinutes = durationMs / 60000;

    // Extract max values
    let maxAltitude = 0;
    let maxSpeed = 0;
    records.forEach(row => {
      const alt = parseFloat(row['max_altitude(feet)']) || 0;
      const speed = parseFloat(row['max_speed(mph)']) || 0;
      if (alt > maxAltitude) maxAltitude = alt;
      if (speed > maxSpeed) maxSpeed = speed;
    });

    // Get start time and coordinates
    const startTime = firstRow['datetime(utc)'];
    const latitude = parseFloat(firstRow['latitude']) || null;
    const longitude = parseFloat(firstRow['longitude']) || null;

    // Check for FTS test (very short flight at start)
    const isFtsTest = durationMinutes < 0.5;

    // Create flight log record
    const flightLog = {
      flight_plan_id: parseInt(flight_plan_id),
      date_time_utc: startTime,
      air_time_minutes: parseFloat(durationMinutes.toFixed(2)),
      pic: pic || 'Unknown',
      assistant: assistant || null,
      fts_activation: isFtsTest ? 1 : 0,
      flight_mode: 'N', // Normal by default
      latitude,
      longitude,
      drone: drone || 'DJI Mavic 3 Pro',
      max_altitude_ft: maxAltitude,
      max_speed_mph: maxSpeed,
      battery: req.body.battery || null
    };

    const { data, error } = await supabase
      .from('flight_logs')
      .insert([flightLog])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      flight_log: data,
      summary: {
        duration_minutes: durationMinutes.toFixed(2),
        max_altitude_ft: maxAltitude.toFixed(1),
        max_speed_mph: maxSpeed.toFixed(1),
        start_time: startTime,
        location: `${latitude}, ${longitude}`
      }
    });
  } catch (err) {
    console.error('Error importing AirData CSV:', err);
    res.status(500).json({ error: 'Failed to import AirData CSV: ' + err.message });
  }
});

// Get pilots
app.get('/api/pilots', requireAuth, async (req, res) => {
  try {
    const { data: pilots, error: pilotsError } = await supabase
      .from('pilots')
      .select('*');
    if (pilotsError) throw pilotsError;

    const { data: logs, error: logsError } = await supabase
      .from('flight_logs')
      .select('pic, air_time_minutes');
    if (logsError) throw logsError;

    const pilotsWithStats = pilots.map(pilot => {
      const pilotLogs = logs.filter(l => l.pic === pilot.code);
      return {
        ...pilot,
        flights: pilotLogs.length,
        total_hours: (pilotLogs.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0) / 60).toFixed(1)
      };
    });

    res.json(pilotsWithStats);
  } catch (err) {
    console.error('Error fetching pilots:', err);
    res.status(500).json({ error: 'Failed to fetch pilots' });
  }
});

// Get drones
app.get('/api/drones', requireAuth, async (req, res) => {
  try {
    const { data: drones, error: dronesError } = await supabase
      .from('drones')
      .select('*');
    if (dronesError) throw dronesError;

    const { data: logs, error: logsError } = await supabase
      .from('flight_logs')
      .select('drone, air_time_minutes');
    if (logsError) throw logsError;

    const dronesWithStats = drones.map(drone => {
      const droneLogs = logs.filter(l => l.drone && l.drone.includes(drone.name));
      return {
        ...drone,
        total_flights: droneLogs.length,
        total_hours: (droneLogs.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0) / 60).toFixed(1)
      };
    });

    res.json(dronesWithStats);
  } catch (err) {
    console.error('Error fetching drones:', err);
    res.status(500).json({ error: 'Failed to fetch drones' });
  }
});

// Get batteries
app.get('/api/batteries', requireAuth, async (req, res) => {
  try {
    const { data: batteries, error: batteriesError } = await supabase
      .from('batteries')
      .select('*');
    if (batteriesError) throw batteriesError;

    const { data: logs, error: logsError } = await supabase
      .from('flight_logs')
      .select('battery, air_time_minutes');
    if (logsError) throw logsError;

    const batteriesWithStats = batteries.map(battery => {
      const batteryLogs = logs.filter(l => l.battery && l.battery.includes(battery.serial_number));
      return {
        ...battery,
        cycles: batteryLogs.length,
        total_hours: (batteryLogs.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0) / 60).toFixed(1)
      };
    });

    res.json(batteriesWithStats);
  } catch (err) {
    console.error('Error fetching batteries:', err);
    res.status(500).json({ error: 'Failed to fetch batteries' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const { count: planCount } = await supabase.from('flight_plans').select('*', { count: 'exact', head: true });
    const { count: logCount } = await supabase.from('flight_logs').select('*', { count: 'exact', head: true });
    const { count: pilotCount } = await supabase.from('pilots').select('*', { count: 'exact', head: true });
    const { count: droneCount } = await supabase.from('drones').select('*', { count: 'exact', head: true });
    const { count: batteryCount } = await supabase.from('batteries').select('*', { count: 'exact', head: true });

    const { data: logs } = await supabase.from('flight_logs').select('air_time_minutes');
    const totalMinutes = logs?.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0) || 0;

    res.json({
      flight_plans: planCount || 0,
      flight_logs: logCount || 0,
      pilots: pilotCount || 0,
      drones: droneCount || 0,
      batteries: batteryCount || 0,
      total_flight_hours: (totalMinutes / 60).toFixed(1),
      total_flight_minutes: totalMinutes.toFixed(1)
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Recent activity
app.get('/api/dashboard/recent', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flight_logs')
      .select('*, flight_plans(name)')
      .order('date_time_utc', { ascending: false })
      .limit(10);

    if (error) throw error;

    const logs = data.map(log => ({
      ...log,
      flight_plan_name: log.flight_plans?.name || 'Unknown'
    }));

    res.json(logs);
  } catch (err) {
    console.error('Error fetching recent activity:', err);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// ============ LOCAL DATA ROUTES (Maintenance, Training, Incidents, Evidence) ============
// These remain file-based for now - will migrate to Supabase later

app.get('/api/maintenance-logs', requireAuth, (req, res) => {
  const logs = localData.maintenanceLogs.map(log => {
    const drone = localData.drones.find(d => d.id === log.drone_id);
    return { ...log, drone_name: drone?.name || 'Unknown' };
  });
  res.json(logs);
});

app.post('/api/maintenance-logs', requireAuth, (req, res) => {
  const newLog = {
    id: localData.maintenanceLogs.length + 1,
    ...req.body,
    scheduled: req.body.scheduled === true || req.body.scheduled === 'true'
  };
  localData.maintenanceLogs.push(newLog);
  res.json(newLog);
});

app.get('/api/training-logs', requireAuth, (req, res) => {
  res.json(localData.trainingLogs);
});

app.post('/api/training-logs', requireAuth, (req, res) => {
  const newLog = {
    id: localData.trainingLogs.length + 1,
    ...req.body,
    scheduled: req.body.scheduled === true || req.body.scheduled === 'true'
  };
  localData.trainingLogs.push(newLog);
  res.json(newLog);
});

app.get('/api/incident-reports', requireAuth, (req, res) => {
  res.json(localData.incidentReports);
});

app.post('/api/incident-reports', requireAuth, (req, res) => {
  const newReport = {
    id: localData.incidentReports.length + 1,
    ...req.body,
    created_at: new Date().toISOString()
  };
  localData.incidentReports.push(newReport);
  res.json(newReport);
});

// ============ EVIDENCE ROUTES (File-based) ============

app.get('/api/flight-plans/:planId/evidence', requireAuth, (req, res) => {
  const planId = req.params.planId;
  const defaultEvidence = {
    planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: 'Zephyr CC MVC3' },
    flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
    airspaceZones: [],
    flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
  };
  res.json(localData.flightPlanEvidence[planId] || defaultEvidence);
});

app.post('/api/flight-plans/:planId/evidence/planning', requireAuth, (req, res) => {
  const { planId } = req.params;
  if (!localData.flightPlanEvidence[planId]) {
    localData.flightPlanEvidence[planId] = {
      planning: {}, flightGeographyData: {}, airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };
  }
  localData.flightPlanEvidence[planId].planning = req.body;
  res.json(localData.flightPlanEvidence[planId].planning);
});

app.post('/api/flight-plans/:planId/evidence/flightGeographyData', requireAuth, (req, res) => {
  const { planId } = req.params;
  if (!localData.flightPlanEvidence[planId]) {
    localData.flightPlanEvidence[planId] = {
      planning: {}, flightGeographyData: {}, airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };
  }
  localData.flightPlanEvidence[planId].flightGeographyData = req.body;
  res.json(localData.flightPlanEvidence[planId].flightGeographyData);
});

app.post('/api/flight-plans/:planId/evidence/airspaceZones', requireAuth, (req, res) => {
  const { planId } = req.params;
  if (!localData.flightPlanEvidence[planId]) {
    localData.flightPlanEvidence[planId] = {
      planning: {}, flightGeographyData: {}, airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };
  }
  localData.flightPlanEvidence[planId].airspaceZones = req.body.zones || [];
  res.json({ zones: localData.flightPlanEvidence[planId].airspaceZones });
});

app.post('/api/flight-plans/:planId/evidence/:category', requireAuth, upload.single('file'), (req, res) => {
  const { planId, category } = req.params;
  const validCategories = ['flightGeography', 'emergencyResponsePlan', 'weather', 'nearbyEvents', 'notams', 'uf101Permission', 'uf101Application'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid evidence category' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!localData.flightPlanEvidence[planId]) {
    localData.flightPlanEvidence[planId] = {
      planning: {}, flightGeographyData: {}, airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };
  }
  if (!localData.flightPlanEvidence[planId][category]) {
    localData.flightPlanEvidence[planId][category] = [];
  }

  const fileRecord = {
    id: Date.now(),
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadDate: new Date().toISOString().split('T')[0],
    fileType: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf',
    mimeType: req.file.mimetype,
    size: req.file.size,
    path: `/uploads/evidence/${planId}/${category}/${req.file.filename}`
  };

  localData.flightPlanEvidence[planId][category].push(fileRecord);
  res.json(fileRecord);
});

app.delete('/api/flight-plans/:planId/evidence/:category/:fileId', requireAuth, (req, res) => {
  const { planId, category, fileId } = req.params;

  if (!localData.flightPlanEvidence[planId]?.[category]) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  const files = localData.flightPlanEvidence[planId][category];
  const fileIndex = files.findIndex(f => f.id === parseInt(fileId));

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = files[fileIndex];
  const filePath = path.join(__dirname, 'public', file.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  files.splice(fileIndex, 1);
  res.json({ success: true });
});

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Serve frontend
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel serverless
module.exports = app;

// Start server only when running locally (not on Vercel)
if (process.env.VERCEL !== '1' && require.main === module) {
  app.listen(PORT, async () => {
    // Test Supabase connection
    try {
      const { count, error } = await supabase.from('flight_logs').select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`
  AerialDeck - IAA-Compliant Flight Records Management
  Database: Supabase ✓ (${count} flight logs)
  Server running at: http://localhost:${PORT}
      `);
    } catch (err) {
      console.log(`
  AerialDeck - IAA-Compliant Flight Records Management
  Database: Supabase (offline - deploy to enable)
  Note: Supabase requires network access. Deploy to Vercel/Railway for full functionality.
  Server running at: http://localhost:${PORT}
      `);
    }
  });
}
