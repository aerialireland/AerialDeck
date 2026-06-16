const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parse/sync');
// dji-log-parser-js is ESM-only, loaded via dynamic import in parseDJIFlightRecord()
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

// DJI flight record upload (.txt binary files)
const djiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt DJI flight records are allowed.'));
    }
  }
});

// Helper: Parse DJI flight record and extract GPS track
async function parseDJIFlightRecord(buffer) {
  const { DJILog } = await import('dji-log-parser-js');
  const log = new DJILog(buffer);
  const details = log.details;
  const version = log.version;

  // Extract metadata (always available without API key)
  const metadata = {
    date_time_utc: details.startTime,
    air_time_minutes: parseFloat((details.totalTime / 60).toFixed(2)),
    max_altitude_ft: parseFloat((details.maxHeight * 3.28084).toFixed(1)),
    max_speed_mph: parseFloat((details.maxHorizontalSpeed * 2.23694).toFixed(1)),
    latitude: details.latitude,
    longitude: details.longitude,
    drone: details.productType || 'Unknown',
    aircraft_sn: details.aircraftSn,
    battery_sn: details.batterySn,
    total_distance_m: details.totalDistance,
    max_vertical_speed_mph: parseFloat((details.maxVerticalSpeed * 2.23694).toFixed(1)),
  };

  // Try to decrypt GPS track
  let gpsTrack = null;
  let trackError = null;

  const apiKey = process.env.DJI_API_KEY;
  if (apiKey) {
    try {
      const keychains = await log.fetchKeychains(apiKey);
      const frames = log.frames(keychains);

      // Sample frames: aim for ~500 points max
      const sampleInterval = Math.max(1, Math.floor(frames.length / 500));
      const sampled = [];

      for (let i = 0; i < frames.length; i += sampleInterval) {
        const f = frames[i];
        const lat = f.osd?.latitude;
        const lon = f.osd?.longitude;
        const alt = f.osd?.height;
        const time = f.osd?.flyTime;

        // Filter valid GPS coordinates
        if (lat && lon && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && lat !== 0 && lon !== 0) {
          sampled.push({
            lat: parseFloat(lat.toFixed(6)),
            lon: parseFloat(lon.toFixed(6)),
            alt: parseFloat((alt || 0).toFixed(1)),
            time: parseFloat((time || 0).toFixed(1))
          });
        }
      }

      if (sampled.length > 2) {
        gpsTrack = sampled;
      }
    } catch (err) {
      trackError = err.message || 'Failed to decrypt GPS track';
      console.error('DJI GPS track decryption error:', trackError);
    }
  } else {
    trackError = 'DJI_API_KEY not configured - GPS track not available';
  }

  return { metadata, gpsTrack, trackError, version };
}

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
    const { name, date, location, geozone, max_altitude, status, duplicate_from } = req.body;

    // Initialize with default evidence structure
    const initialEvidence = {
      planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: '' },
      flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
      airspaceZones: [],
      flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
    };

    // When duplicating an existing plan, copy its full evidence (flight geography,
    // airspace zones, parameters, documents). Flight logs are NOT copied — a
    // duplicated plan starts with no flights.
    let evidenceToUse = initialEvidence;
    if (duplicate_from) {
      const { data: src, error: srcErr } = await supabase
        .from('flight_plans')
        .select('evidence')
        .eq('id', duplicate_from)
        .single();
      if (!srcErr && src && src.evidence) {
        evidenceToUse = JSON.parse(JSON.stringify(src.evidence));
      }
    }

    const { data, error } = await supabase
      .from('flight_plans')
      .insert([{
        name,
        date,
        location,
        geozone: geozone || null,
        max_altitude: max_altitude || 120,
        status: status || 'Planned',
        evidence: evidenceToUse
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

    const formattedLogs = data.map(log => {
      const hasTrack = log.gps_track !== null && log.gps_track !== undefined
        && Array.isArray(log.gps_track) && log.gps_track.length > 0;
      const { gps_track, ...rest } = log; // Strip gps_track from list response to keep payloads small
      return {
        ...rest,
        has_gps_track: hasTrack,
        flight_plan_name: log.flight_plans?.name || 'Unknown'
      };
    });

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

// Update a flight log
app.put('/api/flight-logs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['flight_plan_id', 'date_time_utc', 'air_time_minutes', 'pic', 'assistant', 'drone', 'battery', 'flight_mode', 'fts_activation'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('flight_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating flight log:', err);
    res.status(500).json({ error: 'Failed to update flight log' });
  }
});

// Delete a flight log
app.delete('/api/flight-logs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('flight_logs')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, deleted: data });
  } catch (err) {
    console.error('Error deleting flight log:', err);
    res.status(500).json({ error: 'Failed to delete flight log' });
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

// ============ DJI FLIGHT RECORD IMPORT ============

// Import DJI flight record (.txt binary file)
app.post('/api/flight-logs/import-dji', requireAuth, djiUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { flight_plan_id, pic, assistant, drone, battery } = req.body;
    if (!flight_plan_id) {
      return res.status(400).json({ error: 'Flight plan ID is required' });
    }

    // Parse DJI flight record
    const { metadata, gpsTrack, trackError, version } = await parseDJIFlightRecord(req.file.buffer);
    console.log('DJI metadata:', JSON.stringify({ aircraft_sn: metadata.aircraft_sn, battery_sn: metadata.battery_sn, drone: metadata.drone }));

    // Detect FTS test (very short flight)
    const isFtsTest = metadata.air_time_minutes < 0.5;

    // Auto-match drone by aircraft serial number
    // DJI serial may be a prefix of the full serial (e.g. "1581F67QC234F014" vs "1581F67QC234F0140NMP")
    let matchedDrone = drone || null;
    if (!matchedDrone && metadata.aircraft_sn) {
      try {
        const { data: dronesList } = await supabase.from('drones').select('*');
        if (dronesList) {
          const djiSn = metadata.aircraft_sn.toLowerCase();
          const match = dronesList.find(d => {
            if (!d.serial_number) return false;
            const dbSn = d.serial_number.toLowerCase();
            return dbSn === djiSn || dbSn.startsWith(djiSn) || djiSn.startsWith(dbSn);
          });
          if (match) {
            matchedDrone = `${match.name}. ${match.serial_number}`;
          }
        }
      } catch (e) {
        console.log('Drone auto-match failed:', e.message);
      }
    }
    if (!matchedDrone) matchedDrone = metadata.drone || 'Unknown';

    // Auto-match battery by serial number from DJI file
    // DJI battery_sn may contain extra prefix chars (e.g. "4ERKKCA5G2131A" contains "G2131A")
    let matchedBattery = battery || null;
    if (!matchedBattery && metadata.battery_sn) {
      try {
        const { data: batteries } = await supabase.from('batteries').select('*');
        if (batteries) {
          const djiBatSn = metadata.battery_sn.toLowerCase();
          const match = batteries.find(b => {
            const serial = (b.serial || b.serial_number || '').toLowerCase();
            if (!serial) return false;
            return djiBatSn === serial || djiBatSn.endsWith(serial) || djiBatSn.includes(serial);
          });
          if (match) {
            matchedBattery = `${match.name} (${match.serial_number || match.serial})`;
          }
        }
      } catch (e) {
        console.log('Battery auto-match failed:', e.message);
      }
    }

    // Create flight log record
    const flightLog = {
      flight_plan_id: parseInt(flight_plan_id),
      date_time_utc: metadata.date_time_utc,
      air_time_minutes: metadata.air_time_minutes,
      pic: pic || 'Unknown',
      assistant: assistant || null,
      fts_activation: isFtsTest ? 1 : 0,
      flight_mode: 'N',
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      drone: matchedDrone,
      battery: matchedBattery,
      gps_track: gpsTrack
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
      has_gps_track: gpsTrack !== null,
      track_points: gpsTrack ? gpsTrack.length : 0,
      track_error: trackError,
      summary: {
        duration_minutes: metadata.air_time_minutes,
        max_altitude_ft: metadata.max_altitude_ft,
        max_speed_mph: metadata.max_speed_mph,
        start_time: metadata.date_time_utc,
        drone: matchedDrone,
        aircraft_sn: metadata.aircraft_sn,
        battery_sn: metadata.battery_sn,
        matched_battery: matchedBattery,
        log_version: version
      }
    });
  } catch (err) {
    console.error('Error importing DJI flight record:', err);
    res.status(500).json({ error: 'Failed to import DJI flight record: ' + err.message });
  }
});

// Import DJI flight record from Supabase Storage (for large files that exceed Vercel body limit)
app.post('/api/flight-logs/import-dji-storage', requireAuth, async (req, res) => {
  try {
    const { flight_plan_id, pic, storage_path } = req.body;
    if (!flight_plan_id || !storage_path) {
      return res.status(400).json({ error: 'Flight plan ID and storage path are required' });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('dji-uploads')
      .download(storage_path);

    if (downloadError) throw new Error('Failed to download from storage: ' + downloadError.message);

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Parse DJI flight record
    const { metadata, gpsTrack, trackError, version } = await parseDJIFlightRecord(buffer);
    console.log('DJI metadata (storage):', JSON.stringify({ aircraft_sn: metadata.aircraft_sn, battery_sn: metadata.battery_sn, drone: metadata.drone }));

    // Detect FTS test (very short flight)
    const isFtsTest = metadata.air_time_minutes < 0.5;

    // Auto-match drone
    let matchedDrone = null;
    if (metadata.aircraft_sn) {
      try {
        const { data: dronesList } = await supabase.from('drones').select('*');
        if (dronesList) {
          const djiSn = metadata.aircraft_sn.toLowerCase();
          const match = dronesList.find(d => {
            if (!d.serial_number) return false;
            const dbSn = d.serial_number.toLowerCase();
            return dbSn === djiSn || dbSn.startsWith(djiSn) || djiSn.startsWith(dbSn);
          });
          if (match) matchedDrone = `${match.name}. ${match.serial_number}`;
        }
      } catch (e) { console.log('Drone auto-match failed:', e.message); }
    }
    if (!matchedDrone) matchedDrone = metadata.drone || 'Unknown';

    // Auto-match battery
    let matchedBattery = null;
    if (metadata.battery_sn) {
      try {
        const { data: batteries } = await supabase.from('batteries').select('*');
        if (batteries) {
          const djiBatSn = metadata.battery_sn.toLowerCase();
          const match = batteries.find(b => {
            const serial = (b.serial || b.serial_number || '').toLowerCase();
            if (!serial) return false;
            return djiBatSn === serial || djiBatSn.endsWith(serial) || djiBatSn.includes(serial);
          });
          if (match) matchedBattery = `${match.name} (${match.serial_number || match.serial})`;
        }
      } catch (e) { console.log('Battery auto-match failed:', e.message); }
    }

    // Create flight log record
    const flightLog = {
      flight_plan_id: parseInt(flight_plan_id),
      date_time_utc: metadata.date_time_utc,
      air_time_minutes: metadata.air_time_minutes,
      pic: pic || 'Unknown',
      assistant: null,
      fts_activation: isFtsTest ? 1 : 0,
      flight_mode: 'N',
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      drone: matchedDrone,
      battery: matchedBattery,
      gps_track: gpsTrack
    };

    const { data, error } = await supabase
      .from('flight_logs')
      .insert([flightLog])
      .select()
      .single();

    if (error) throw error;

    // Move temp file to permanent storage (keep original flight record)
    const permanentPath = storage_path.replace('temp/', 'records/');
    try {
      // Copy to permanent location
      const { data: fileData2, error: dlErr } = await supabase.storage.from('dji-uploads').download(storage_path);
      if (!dlErr && fileData2) {
        const fileBuffer = Buffer.from(await fileData2.arrayBuffer());
        await supabase.storage.from('dji-uploads').upload(permanentPath, fileBuffer, {
          contentType: 'text/plain',
          upsert: true
        });
        // Update flight log with file path
        await supabase.from('flight_logs').update({ dji_file_path: permanentPath }).eq('id', data.id);
      }
    } catch (moveErr) {
      console.log('File preservation failed (non-critical):', moveErr.message);
    }
    // Clean up temp file
    await supabase.storage.from('dji-uploads').remove([storage_path]);

    res.json({
      success: true,
      flight_log: data,
      has_gps_track: gpsTrack !== null,
      track_points: gpsTrack ? gpsTrack.length : 0,
      track_error: trackError,
      summary: {
        duration_minutes: metadata.air_time_minutes,
        max_altitude_ft: metadata.max_altitude_ft,
        max_speed_mph: metadata.max_speed_mph,
        start_time: metadata.date_time_utc,
        drone: matchedDrone,
        aircraft_sn: metadata.aircraft_sn,
        battery_sn: metadata.battery_sn,
        matched_battery: matchedBattery,
        log_version: version
      }
    });
  } catch (err) {
    console.error('Error importing DJI from storage:', err);
    res.status(500).json({ error: 'Failed to import DJI flight record: ' + err.message });
  }
});

// Get GPS track for a specific flight log
app.get('/api/flight-logs/:id/gps-track', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('flight_logs')
      .select('id, gps_track')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Flight log not found' });

    res.json({
      id: data.id,
      gps_track: data.gps_track || [],
      has_gps_track: data.gps_track !== null && Array.isArray(data.gps_track) && data.gps_track.length > 0
    });
  } catch (err) {
    console.error('Error fetching GPS track:', err);
    res.status(500).json({ error: 'Failed to fetch GPS track' });
  }
});

// Add GPS track to existing flight log (retroactive upload)
app.put('/api/flight-logs/:id/gps-track', requireAuth, djiUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { id } = req.params;

    // Verify flight log exists
    const { data: existing, error: findError } = await supabase
      .from('flight_logs')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Flight log not found' });
    }

    // Parse DJI flight record for GPS track only
    const { gpsTrack, trackError } = await parseDJIFlightRecord(req.file.buffer);

    if (!gpsTrack) {
      return res.status(400).json({
        error: 'Could not extract GPS track from file',
        detail: trackError
      });
    }

    // Update only the gps_track column
    const { data, error } = await supabase
      .from('flight_logs')
      .update({ gps_track: gpsTrack })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      id: data.id,
      track_points: gpsTrack.length,
      has_gps_track: true
    });
  } catch (err) {
    console.error('Error adding GPS track:', err);
    res.status(500).json({ error: 'Failed to add GPS track: ' + err.message });
  }
});

// ============ DATABASE MIGRATION ============
// One-time route to add gps_track column (run once, then remove)
app.post('/api/migrate/add-gps-track', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE flight_logs ADD COLUMN IF NOT EXISTS gps_track JSONB DEFAULT NULL;'
    });

    if (error) {
      // If rpc doesn't exist, try direct approach - column may already exist
      console.log('Migration note:', error.message);
      return res.json({
        success: true,
        message: 'Column may already exist or needs manual addition via Supabase SQL editor: ALTER TABLE flight_logs ADD COLUMN IF NOT EXISTS gps_track JSONB DEFAULT NULL;'
      });
    }

    res.json({ success: true, message: 'gps_track column added to flight_logs table' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
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

// Create battery
app.post('/api/batteries', requireAuth, async (req, res) => {
  try {
    const { serial, name, drone_id, purchase_date, status, cycles, health, notes } = req.body || {};

    if (!serial || typeof serial !== 'string' || !serial.trim()) {
      return res.status(400).json({ error: 'serial is required' });
    }

    const row = {
      serial: serial.trim(),
      name: name && name.trim() ? name.trim() : null,
      drone_id: drone_id ? parseInt(drone_id, 10) : null,
      purchase_date: purchase_date || null,
      status: status || 'Active',
      cycles: (cycles !== undefined && cycles !== '' && cycles !== null) ? parseInt(cycles, 10) : 0,
      health: (health !== undefined && health !== '' && health !== null) ? parseInt(health, 10) : 100,
      notes: notes && typeof notes === 'string' ? (notes.trim() || null) : (notes || null)
    };

    const { data, error } = await supabase
      .from('batteries')
      .insert([row])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A battery with that serial already exists' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    console.error('Error creating battery:', err);
    res.status(500).json({ error: 'Failed to create battery' });
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

// ============ UPLOADED IAA GEOZONE VERSIONS ============
// Uploaded GeoZone versions are stored as a small JSON manifest in the
// aerialdeck-files bucket. The large .geojson files themselves are uploaded
// to the same bucket directly from the browser. Built-in versions still come
// from the static public/geozones/index.json (merged client-side).
const GEOZONE_MANIFEST_PATH = 'geozones/uploaded-index.json';

async function readGeozoneManifest() {
  try {
    const { data, error } = await supabase.storage
      .from('aerialdeck-files')
      .download(GEOZONE_MANIFEST_PATH);
    if (error || !data) return { versions: [] };
    const text = await data.text();
    const parsed = JSON.parse(text);
    return { versions: Array.isArray(parsed.versions) ? parsed.versions : [] };
  } catch (err) {
    // No manifest yet (first upload) — treat as empty
    return { versions: [] };
  }
}

app.get('/api/geozone-versions', requireAuth, async (req, res) => {
  try {
    const manifest = await readGeozoneManifest();
    res.json(manifest);
  } catch (err) {
    console.error('Error reading geozone manifest:', err);
    res.status(500).json({ error: 'Failed to read geozone versions' });
  }
});

app.post('/api/geozone-versions', requireAuth, async (req, res) => {
  try {
    const v = req.body || {};
    if (!v.id || !v.url || !v.storagePath) {
      return res.status(400).json({ error: 'Missing required fields (id, url, storagePath)' });
    }
    const version = {
      id: String(v.id),
      name: v.name || `IAA ${v.id}`,
      fullName: v.fullName || `UAS Geographical Zones Ireland ${v.id}`,
      issued: v.issued || null,
      validFrom: v.validFrom || null,
      file: v.storagePath,
      url: v.url,
      uploaded: true,
      uploadedAt: new Date().toISOString()
    };

    const manifest = await readGeozoneManifest();
    // Replace any existing version with the same id, then add the new one
    manifest.versions = manifest.versions.filter(x => x.id !== version.id);
    manifest.versions.push(version);

    const { error: writeError } = await supabase.storage
      .from('aerialdeck-files')
      .upload(GEOZONE_MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)), {
        contentType: 'application/json',
        upsert: true
      });
    if (writeError) throw writeError;

    res.json(manifest);
  } catch (err) {
    console.error('Error saving geozone version:', err);
    res.status(500).json({ error: 'Failed to save geozone version' });
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

// ============ SORA DOCUMENTS ============
// Company-level SORA documentation, stored in Supabase Storage as metadata JSON + files

const SORA_METADATA_PATH = 'sora-docs/metadata.json';
let soraMetadataCache = null;

async function getSoraMetadata() {
  if (soraMetadataCache !== null) return soraMetadataCache;
  try {
    const { data, error } = await supabase.storage
      .from('aerialdeck-files')
      .download(SORA_METADATA_PATH);
    if (error) { soraMetadataCache = []; return []; }
    const text = await data.text();
    const parsed = JSON.parse(text);
    // Migrate from old category-keyed object to flat array if needed
    if (Array.isArray(parsed)) { soraMetadataCache = parsed; return parsed; }
    // Old format: { category: [files...] } — flatten to array
    const flat = [];
    for (const cat of Object.keys(parsed)) {
      for (const file of parsed[cat]) {
        flat.push(file);
      }
    }
    soraMetadataCache = flat;
    return flat;
  } catch (err) {
    soraMetadataCache = [];
    return [];
  }
}

async function saveSoraMetadata(metadata) {
  soraMetadataCache = metadata;
  const buffer = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const { error } = await supabase.storage
    .from('aerialdeck-files')
    .upload(SORA_METADATA_PATH, buffer, {
      contentType: 'application/json',
      upsert: true
    });
  if (error) throw error;
}

// Get all SORA documents
app.get('/api/sora-documents', requireAuth, async (req, res) => {
  try {
    const metadata = await getSoraMetadata();
    res.json(metadata);
  } catch (err) {
    console.error('Error fetching SORA documents:', err);
    res.json([]);
  }
});

// Save SORA document metadata (file already uploaded to Supabase Storage from browser)
app.post('/api/sora-documents/metadata', requireAuth, async (req, res) => {
  try {
    const metadata = await getSoraMetadata();
    const fileRecord = req.body;
    metadata.push(fileRecord);
    await saveSoraMetadata(metadata);
    res.json(fileRecord);
  } catch (err) {
    console.error('Error saving SORA document metadata:', err);
    res.status(500).json({ error: 'Failed to save metadata' });
  }
});

// Replace a SORA document (update metadata for a specific file)
app.put('/api/sora-documents/:fileId/metadata', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = await getSoraMetadata();

    const fileIndex = metadata.findIndex(f => f.id === parseInt(fileId));
    if (fileIndex === -1) return res.status(404).json({ error: 'File not found' });

    // Try to delete old file from storage
    const oldFile = metadata[fileIndex];
    if (oldFile.path && oldFile.path.includes('supabase')) {
      try {
        const storagePath = oldFile.path.split('/aerialdeck-files/')[1];
        if (storagePath) await supabase.storage.from('aerialdeck-files').remove([storagePath]);
      } catch (e) { console.error('Error deleting old SORA file:', e); }
    }

    metadata[fileIndex] = req.body;
    await saveSoraMetadata(metadata);
    res.json(req.body);
  } catch (err) {
    console.error('Error replacing SORA document:', err);
    res.status(500).json({ error: 'Failed to replace document' });
  }
});

// Delete a SORA document
app.delete('/api/sora-documents/:fileId', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = await getSoraMetadata();

    const fileIndex = metadata.findIndex(f => f.id === parseInt(fileId));
    if (fileIndex === -1) return res.status(404).json({ error: 'File not found' });

    const file = metadata[fileIndex];
    // Delete from Supabase Storage
    if (file.path && file.path.includes('supabase')) {
      try {
        const storagePath = file.path.split('/aerialdeck-files/')[1];
        if (storagePath) await supabase.storage.from('aerialdeck-files').remove([storagePath]);
      } catch (e) { console.error('Error deleting SORA file from storage:', e); }
    }

    metadata.splice(fileIndex, 1);
    await saveSoraMetadata(metadata);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting SORA document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

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
