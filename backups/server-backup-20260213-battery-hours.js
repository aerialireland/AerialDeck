const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parse/sync');
require('dotenv').config();

// Import Supabase client
const supabase = require('./database/supabase.js');

// Note: localData.js is no longer needed - all data now stored in Supabase

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
// Trust proxy for Vercel
app.set('trust proxy', 1);

// Use cookie-session for serverless compatibility
app.use(cookieSession({
  name: 'aerialdeck_session',
  keys: [process.env.SESSION_SECRET || 'aerialdeck-secret-key-2026'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: isVercel, // HTTPS only on Vercel
  httpOnly: true,
  sameSite: 'lax'
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
  req.session = null; // cookie-session uses null to clear session
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

    // Initialize with default evidence structure
    const initialEvidence = {
      planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: '' },
      flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
      airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };

    const { data, error } = await supabase
      .from('flight_plans')
      .insert([{
        name,
        date,
        location,
        geozone: geozone || null,
        max_altitude: max_altitude || 120,
        status: status || 'Planned',
        evidence: initialEvidence
      }])
      .select()
      .single();

    if (error) throw error;

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
    const allowedFields = ['name', 'date', 'location', 'geozone', 'max_altitude', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('flight_plans')
      .update(updates)
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

// Delete a flight plan (and associated flight logs)
app.delete('/api/flight-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    console.log('Deleting flight plan:', planId);

    if (!planId || isNaN(planId)) {
      return res.status(400).json({ error: 'Invalid flight plan ID' });
    }

    // First delete associated flight logs
    const { data: deletedLogs, error: logsError } = await supabase
      .from('flight_logs')
      .delete()
      .eq('flight_plan_id', planId)
      .select();

    if (logsError) {
      console.error('Error deleting flight logs:', logsError);
    } else {
      console.log('Deleted flight logs:', deletedLogs?.length || 0);
    }

    // Then delete the flight plan
    const { data: deletedPlan, error: planError } = await supabase
      .from('flight_plans')
      .delete()
      .eq('id', planId)
      .select();

    if (planError) {
      console.error('Supabase delete error:', planError);
      throw planError;
    }

    console.log('Deleted flight plan:', deletedPlan);

    if (!deletedPlan || deletedPlan.length === 0) {
      return res.status(404).json({ error: 'Flight plan not found or already deleted' });
    }

    res.json({ success: true, message: 'Flight plan deleted', deleted: deletedPlan[0] });
  } catch (err) {
    console.error('Error deleting flight plan:', err);
    res.status(500).json({ error: 'Failed to delete flight plan: ' + err.message });
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
      const batteryLogs = logs.filter(l => l.battery && l.battery.includes(battery.serial));
      const specificHours = parseFloat((batteryLogs.reduce((sum, l) => sum + (l.air_time_minutes || 0), 0) / 60).toFixed(1));
      const openHours = parseFloat(battery.open_category_hours || 0);
      return {
        ...battery,
        serial_number: battery.serial,
        cycles: battery.cycles || batteryLogs.length,
        specific_category_hours: specificHours.toFixed(1),
        open_category_hours: openHours.toFixed(1),
        total_hours: (specificHours + openHours).toFixed(1)
      };
    });

    res.json(batteriesWithStats);
  } catch (err) {
    console.error('Error fetching batteries:', err);
    res.status(500).json({ error: 'Failed to fetch batteries' });
  }
});

// Update battery open category hours
app.patch('/api/batteries/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const value = parseFloat(req.body.open_category_hours);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({ error: 'open_category_hours must be a non-negative number' });
    }

    const { data, error } = await supabase
      .from('batteries')
      .update({ open_category_hours: value })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating battery:', err);
    res.status(500).json({ error: 'Failed to update battery' });
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

// ============ SUPABASE DATA ROUTES (Maintenance, Training, Incidents) ============
// All data now persisted in Supabase for reliability on Vercel

app.get('/api/maintenance-logs', requireAuth, async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('maintenance_logs')
      .select('*, drones(name)')
      .order('date', { ascending: false });

    if (error) throw error;

    const logsWithDroneName = logs.map(log => ({
      ...log,
      drone_name: log.drones?.name || 'Unknown'
    }));

    res.json(logsWithDroneName);
  } catch (err) {
    console.error('Error fetching maintenance logs:', err);
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

app.post('/api/maintenance-logs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert([{
        date: req.body.date,
        type: req.body.type,
        scheduled: req.body.scheduled === true || req.body.scheduled === 'true',
        performed_by: req.body.performed_by,
        drone_id: req.body.drone_id,
        next_scheduled: req.body.next_scheduled || null,
        notes: req.body.notes || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error creating maintenance log:', err);
    res.status(500).json({ error: 'Failed to create maintenance log' });
  }
});

app.get('/api/training-logs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('training_logs')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching training logs:', err);
    res.status(500).json({ error: 'Failed to fetch training logs' });
  }
});

app.post('/api/training-logs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('training_logs')
      .insert([{
        date: req.body.date,
        type: req.body.type,
        scheduled: req.body.scheduled === true || req.body.scheduled === 'true',
        pilot_id: req.body.pilot_id,
        pilot_name: req.body.pilot_name,
        next_scheduled: req.body.next_scheduled || null,
        notes: req.body.notes || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error creating training log:', err);
    res.status(500).json({ error: 'Failed to create training log' });
  }
});

app.get('/api/incident-reports', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('incident_reports')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching incident reports:', err);
    res.status(500).json({ error: 'Failed to fetch incident reports' });
  }
});

app.post('/api/incident-reports', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('incident_reports')
      .insert([{
        date: req.body.date,
        type: req.body.type,
        description: req.body.description,
        pilot_id: req.body.pilot_id,
        flight_plan_id: req.body.flight_plan_id,
        severity: req.body.severity,
        resolution: req.body.resolution,
        reported_to_iaa: req.body.reported_to_iaa === true || req.body.reported_to_iaa === 'true',
        notes: req.body.notes || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error creating incident report:', err);
    res.status(500).json({ error: 'Failed to create incident report' });
  }
});

// ============ EVIDENCE ROUTES (Supabase-persisted) ============
// Evidence data stored in flight_plans.evidence JSONB column
// Files stored in Supabase Storage

const defaultEvidence = {
  planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: '' },
  flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
  airspaceZones: [],
  flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
};

// Helper to get evidence from Supabase
async function getEvidence(planId) {
  const { data, error } = await supabase
    .from('flight_plans')
    .select('evidence')
    .eq('id', planId)
    .single();

  if (error) throw error;
  return data?.evidence || { ...defaultEvidence };
}

// Helper to save evidence to Supabase
async function saveEvidence(planId, evidence) {
  const { error } = await supabase
    .from('flight_plans')
    .update({ evidence })
    .eq('id', planId);

  if (error) throw error;
}

app.get('/api/flight-plans/:planId/evidence', requireAuth, async (req, res) => {
  try {
    const evidence = await getEvidence(req.params.planId);
    res.json(evidence);
  } catch (err) {
    console.error('Error fetching evidence:', err);
    res.json(defaultEvidence);
  }
});

app.post('/api/flight-plans/:planId/evidence/planning', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const evidence = await getEvidence(planId);
    evidence.planning = req.body;
    await saveEvidence(planId, evidence);
    res.json(evidence.planning);
  } catch (err) {
    console.error('Error saving planning data:', err);
    res.status(500).json({ error: 'Failed to save planning data' });
  }
});

app.post('/api/flight-plans/:planId/evidence/flightGeographyData', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const evidence = await getEvidence(planId);
    evidence.flightGeographyData = req.body;
    await saveEvidence(planId, evidence);
    res.json(evidence.flightGeographyData);
  } catch (err) {
    console.error('Error saving flight geography data:', err);
    res.status(500).json({ error: 'Failed to save flight geography data' });
  }
});

// Flight Geography Map data (KML coordinates, buffers, etc.)
app.post('/api/flight-plans/:planId/evidence/flightGeographyMap', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const evidence = await getEvidence(planId);
    evidence.flightGeographyMap = req.body;
    await saveEvidence(planId, evidence);
    res.json(evidence.flightGeographyMap);
  } catch (err) {
    console.error('Error saving flight geography map data:', err);
    res.status(500).json({ error: 'Failed to save flight geography map data' });
  }
});

app.post('/api/flight-plans/:planId/evidence/airspaceZones', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const evidence = await getEvidence(planId);
    evidence.airspaceZones = req.body.zones || [];
    await saveEvidence(planId, evidence);
    res.json({ zones: evidence.airspaceZones });
  } catch (err) {
    console.error('Error saving airspace zones:', err);
    res.status(500).json({ error: 'Failed to save airspace zones' });
  }
});

app.post('/api/flight-plans/:planId/evidence/:category', requireAuth, upload.single('file'), async (req, res) => {
  const { planId, category } = req.params;
  const validCategories = ['flightGeography', 'emergencyResponsePlan', 'weather', 'nearbyEvents', 'notams', 'uf101Permission', 'uf101Application'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid evidence category' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const evidence = await getEvidence(planId);
    if (!evidence[category]) {
      evidence[category] = [];
    }

    let filePath;
    const timestamp = Date.now();
    const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Always upload to Supabase Storage for persistence
    if (req.file.buffer || isVercel) {
      const storagePath = `evidence/${planId}/${category}/${timestamp}_${safeFilename}`;
      const fileBuffer = req.file.buffer || fs.readFileSync(req.file.path);

      const { data, error } = await supabase
        .storage
        .from('aerialdeck-files')
        .upload(storagePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase storage upload error:', error);
        return res.status(500).json({ error: 'Storage error: ' + error.message });
      }

      const { data: urlData } = supabase.storage.from('aerialdeck-files').getPublicUrl(storagePath);
      filePath = urlData.publicUrl;
    } else {
      // Fallback to local filesystem path
      filePath = `/uploads/evidence/${planId}/${category}/${req.file.filename}`;
    }

    const fileRecord = {
      id: timestamp,
      filename: req.file.filename || `${timestamp}_${safeFilename}`,
      originalName: req.file.originalname,
      uploadDate: new Date().toISOString().split('T')[0],
      fileType: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf',
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: filePath
    };

    evidence[category].push(fileRecord);
    await saveEvidence(planId, evidence);
    res.json(fileRecord);
  } catch (err) {
    console.error('Error uploading evidence file:', err);
    res.status(500).json({ error: 'Upload error: ' + err.message });
  }
});

// Save file metadata only (file already uploaded directly to Supabase from browser)
app.post('/api/flight-plans/:planId/evidence/:category/metadata', requireAuth, async (req, res) => {
  const { planId, category } = req.params;
  const validCategories = ['flightGeography', 'emergencyResponsePlan', 'weather', 'nearbyEvents', 'notams', 'uf101Permission', 'uf101Application'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid evidence category' });
  }

  try {
    const evidence = await getEvidence(planId);
    if (!evidence[category]) {
      evidence[category] = [];
    }

    const fileRecord = req.body;
    evidence[category].push(fileRecord);
    await saveEvidence(planId, evidence);
    res.json(fileRecord);
  } catch (err) {
    console.error('Error saving evidence metadata:', err);
    res.status(500).json({ error: 'Failed to save metadata' });
  }
});

app.delete('/api/flight-plans/:planId/evidence/:category/:fileId', requireAuth, async (req, res) => {
  const { planId, category, fileId } = req.params;

  try {
    const evidence = await getEvidence(planId);

    if (!evidence[category]) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const files = evidence[category];
    const fileIndex = files.findIndex(f => f.id === parseInt(fileId));

    if (fileIndex === -1) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[fileIndex];

    // Try to delete from Supabase Storage if it's a Supabase URL
    if (file.path && file.path.includes('supabase')) {
      try {
        const storagePath = file.path.split('/aerialdeck-files/')[1];
        if (storagePath) {
          await supabase.storage.from('aerialdeck-files').remove([storagePath]);
        }
      } catch (storageErr) {
        console.error('Error deleting from storage:', storageErr);
      }
    } else {
      // Try to delete from local filesystem
      const localPath = path.join(__dirname, 'public', file.path);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    files.splice(fileIndex, 1);
    await saveEvidence(planId, evidence);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting evidence file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
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
