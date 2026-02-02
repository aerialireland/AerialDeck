// Local data for AerialDeck when Supabase is unavailable
// This is your real flight data from Dronedeck

const flightPlans = [
  { id: 1, name: "Baldoyle - Portmarnock Greenway", date: "2025-02-12", location: "Portmarnock, Dublin", geozone: "Baldoyle/Portmarnock", max_altitude: 120, status: "Completed" },
  { id: 2, name: "RDS Ballsbridge", date: "2025-03-04", location: "Ballsbridge, Dublin 4", geozone: "RDS/Ballsbridge", max_altitude: 120, status: "Completed" },
  { id: 3, name: "St Patrick's Cathedral", date: "2025-03-20", location: "Dublin 8", geozone: "St Patrick's/Liberties", max_altitude: 90, status: "Completed" },
  { id: 4, name: "Rathmines", date: "2025-04-01", location: "Rathmines, Dublin 6", geozone: "Rathmines", max_altitude: 120, status: "Completed" },
  { id: 5, name: "North Wall Quay - Docklands", date: "2025-04-09", location: "North Wall, Dublin 1", geozone: "Docklands", max_altitude: 120, status: "Completed" },
  { id: 6, name: "Palmerstown", date: "2025-04-09", location: "Palmerstown, Dublin 20", geozone: "Palmerstown", max_altitude: 120, status: "Completed" },
  { id: 7, name: "O'Connell Gardens - Ballsbridge", date: "2025-04-11", location: "Ballsbridge, Dublin 4", geozone: "Ballsbridge", max_altitude: 120, status: "Completed" },
  { id: 8, name: "Galway City", date: "2025-04-15", location: "Galway City", geozone: "Galway Harbour/City", max_altitude: 120, status: "Completed" },
  { id: 9, name: "Digital Hub - Thomas Street", date: "2025-05-23", location: "The Liberties, Dublin 8", geozone: "Digital Hub", max_altitude: 90, status: "Completed" },
  { id: 10, name: "Smithfield / Four Courts", date: "2025-05-24", location: "Smithfield, Dublin 7", geozone: "Smithfield", max_altitude: 90, status: "Completed" },
  { id: 11, name: "Phoenix Park - People's Garden", date: "2025-05-24", location: "Phoenix Park, Dublin 8", geozone: "Phoenix Park", max_altitude: 60, status: "Completed" },
  { id: 12, name: "Phoenix Park - Magazine Fort", date: "2025-05-24", location: "Phoenix Park, Dublin 8", geozone: "Phoenix Park", max_altitude: 60, status: "Completed" },
  { id: 13, name: "Digital Hub - Evening", date: "2025-05-24", location: "The Liberties, Dublin 8", geozone: "Digital Hub", max_altitude: 90, status: "Completed" },
  { id: 14, name: "Digital Hub - Thomas Street 2", date: "2025-05-25", location: "The Liberties, Dublin 8", geozone: "Digital Hub", max_altitude: 90, status: "Completed" },
  { id: 15, name: "Royal Hospital Kilmainham", date: "2025-05-31", location: "Kilmainham, Dublin 8", geozone: "Kilmainham", max_altitude: 90, status: "Completed" },
  { id: 16, name: "IMMA Gardens", date: "2025-05-31", location: "Kilmainham, Dublin 8", geozone: "Kilmainham", max_altitude: 90, status: "Completed" },
  { id: 17, name: "RHK Gardens - Day 2", date: "2025-06-01", location: "Kilmainham, Dublin 8", geozone: "Kilmainham", max_altitude: 90, status: "Completed" },
  { id: 18, name: "Kilmainham Lane", date: "2025-06-01", location: "Kilmainham, Dublin 8", geozone: "Kilmainham", max_altitude: 90, status: "Completed" }
];

const flightLogs = [
  { id: 1, flight_plan_id: 1, date_time_utc: "2025-02-12 13:40:00", air_time_minutes: 0.23, pic: "TK", assistant: "ROC", fts_activation: 1, flight_mode: "N", latitude: 53.40277011, longitude: -6.13157731, takeoff_landing_address: "Baldoyle to Portmarnock Greenway, Portmarnock", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 2, flight_plan_id: 1, date_time_utc: "2025-02-12 13:43:00", air_time_minutes: 11.72, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.40278748, longitude: -6.13156818, takeoff_landing_address: "Baldoyle to Portmarnock Greenway, Portmarnock", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 3, flight_plan_id: 1, date_time_utc: "2025-02-12 14:29:00", air_time_minutes: 21.02, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.40693729, longitude: -6.15172139, takeoff_landing_address: "3 Marrsfield Ave, Donaghmede, Dublin 13", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 4, flight_plan_id: 1, date_time_utc: "2025-02-12 14:54:00", air_time_minutes: 20.97, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.40693727, longitude: -6.15173464, takeoff_landing_address: "3 Marrsfield Ave, Donaghmede, Dublin 13", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 5, flight_plan_id: 1, date_time_utc: "2025-02-12 15:36:00", air_time_minutes: 12.28, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.41497266, longitude: -6.17835547, takeoff_landing_address: "Saint Doolagh's Church, Malahide Rd", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 6, flight_plan_id: 1, date_time_utc: "2025-02-12 16:01:00", air_time_minutes: 11.3, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.41119266, longitude: -6.16573015, takeoff_landing_address: "174 Castlemoyne, Balgriffin Park, Dublin 13", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 7, flight_plan_id: 2, date_time_utc: "2025-03-04 12:52:00", air_time_minutes: 0.3, pic: "TK", assistant: null, fts_activation: 1, flight_mode: "N", latitude: 53.33141176, longitude: -6.22824657, takeoff_landing_address: "The Sweepstakes, Ballsbridge Park, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 8, flight_plan_id: 2, date_time_utc: "2025-03-04 12:53:00", air_time_minutes: 13.73, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.33146869, longitude: -6.22822053, takeoff_landing_address: "The Sweepstakes, Ballsbridge Park, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 9, flight_plan_id: 2, date_time_utc: "2025-03-04 13:09:00", air_time_minutes: 0.53, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.33147258, longitude: -6.22821503, takeoff_landing_address: "The Sweepstakes, Ballsbridge Park, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 10, flight_plan_id: 2, date_time_utc: "2025-03-04 13:12:00", air_time_minutes: 24.62, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.33145421, longitude: -6.22821631, takeoff_landing_address: "The Sweepstakes, Ballsbridge Park, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 11, flight_plan_id: 2, date_time_utc: "2025-03-04 13:38:00", air_time_minutes: 6.85, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.33143587, longitude: -6.22822902, takeoff_landing_address: "The Sweepstakes, Ballsbridge Park, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 12, flight_plan_id: 3, date_time_utc: "2025-03-20 14:47:00", air_time_minutes: 0.35, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.33875628, longitude: -6.2706567, takeoff_landing_address: "Saint Patrick's Cathedral Deanery, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 13, flight_plan_id: 3, date_time_utc: "2025-03-20 14:53:00", air_time_minutes: 13.6, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.33874242, longitude: -6.27074664, takeoff_landing_address: "Saint Patrick's Cathedral Deanery, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 14, flight_plan_id: 3, date_time_utc: "2025-03-20 16:48:00", air_time_minutes: 0.12, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34120156, longitude: -6.27600778, takeoff_landing_address: "15 Garden Ln, The Liberties, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 15, flight_plan_id: 3, date_time_utc: "2025-03-20 16:50:00", air_time_minutes: 10.42, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34123253, longitude: -6.27600902, takeoff_landing_address: "15 Garden Ln, The Liberties, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 16, flight_plan_id: 3, date_time_utc: "2025-03-20 17:14:00", air_time_minutes: 5.18, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3415483, longitude: -6.27733603, takeoff_landing_address: "Michael Mallin House, Vicar St, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 17, flight_plan_id: 4, date_time_utc: "2025-04-01 09:42:00", air_time_minutes: 0.17, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "N", latitude: 53.3244892, longitude: -6.26681815, takeoff_landing_address: "3 Leinster Rd, Rathmines, Dublin 6", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 18, flight_plan_id: 4, date_time_utc: "2025-04-01 09:46:00", air_time_minutes: 20.38, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.32452247, longitude: -6.26681284, takeoff_landing_address: "3 Leinster Rd, Rathmines, Dublin 6", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 19, flight_plan_id: 5, date_time_utc: "2025-04-09 17:55:00", air_time_minutes: 0.12, pic: "TK", assistant: "ROC", fts_activation: 1, flight_mode: "N", latitude: 53.34716168, longitude: -6.23667736, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 20, flight_plan_id: 5, date_time_utc: "2025-04-09 18:06:00", air_time_minutes: 21.43, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.34712761, longitude: -6.23673374, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 21, flight_plan_id: 5, date_time_utc: "2025-04-09 18:30:00", air_time_minutes: 24.27, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.34714429, longitude: -6.23662571, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 22, flight_plan_id: 5, date_time_utc: "2025-04-09 18:55:00", air_time_minutes: 25.02, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.34710869, longitude: -6.23663345, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 23, flight_plan_id: 5, date_time_utc: "2025-04-09 19:24:00", air_time_minutes: 25.37, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.34715328, longitude: -6.23660443, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 24, flight_plan_id: 5, date_time_utc: "2025-04-09 19:54:00", air_time_minutes: 26.08, pic: "TK", assistant: "ROC", fts_activation: 0, flight_mode: "N", latitude: 53.34719177, longitude: -6.23650801, takeoff_landing_address: "North Wall Quay, Dublin 1", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 25, flight_plan_id: 6, date_time_utc: "2025-04-09 21:12:00", air_time_minutes: 25.68, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "N", latitude: 53.3565077, longitude: -6.38996158, takeoff_landing_address: "Abingdon, Old Lucan Rd, Palmerstown, Dublin 20", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 26, flight_plan_id: 7, date_time_utc: "2025-04-11 19:08:00", air_time_minutes: 0.25, pic: "TK", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.33678985, longitude: -6.22852735, takeoff_landing_address: "12 O'Connell Gardens, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 27, flight_plan_id: 7, date_time_utc: "2025-04-11 19:11:00", air_time_minutes: 23.08, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.33677708, longitude: -6.22852313, takeoff_landing_address: "68 O'Connell Gardens, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 28, flight_plan_id: 7, date_time_utc: "2025-04-11 19:36:00", air_time_minutes: 5.45, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.33676826, longitude: -6.22851656, takeoff_landing_address: "68 O'Connell Gardens, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 29, flight_plan_id: 7, date_time_utc: "2025-04-11 19:42:00", air_time_minutes: 22.03, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.33677148, longitude: -6.22851485, takeoff_landing_address: "68 O'Connell Gardens, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 30, flight_plan_id: 7, date_time_utc: "2025-04-11 20:05:00", air_time_minutes: 19.23, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.33677191, longitude: -6.22850227, takeoff_landing_address: "68 O'Connell Gardens, Dublin 4", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 31, flight_plan_id: 8, date_time_utc: "2025-04-15 10:39:00", air_time_minutes: 0.15, pic: "ROC", assistant: "TK", fts_activation: 1, flight_mode: "N", latitude: 53.26723119, longitude: -9.0432841, takeoff_landing_address: "Galway Harbour Enterprise Park", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 32, flight_plan_id: 8, date_time_utc: "2025-04-15 10:40:00", air_time_minutes: 18.3, pic: "ROC", assistant: "TK", fts_activation: 0, flight_mode: "N", latitude: 53.26723171, longitude: -9.04328507, takeoff_landing_address: "Galway Harbour Enterprise Park", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 33, flight_plan_id: 8, date_time_utc: "2025-04-15 11:52:00", air_time_minutes: 0.25, pic: "ROC", assistant: "TK", fts_activation: 0, flight_mode: "N", latitude: 53.2763388, longitude: -9.05661061, takeoff_landing_address: "Fisheries Cottage, Earls Island, Galway", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 34, flight_plan_id: 8, date_time_utc: "2025-04-15 11:53:00", air_time_minutes: 13.2, pic: "ROC", assistant: "TK", fts_activation: 0, flight_mode: "N", latitude: 53.27635367, longitude: -9.05660662, takeoff_landing_address: "Fisheries Cottage, Earls Island, Galway", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 35, flight_plan_id: 8, date_time_utc: "2025-04-15 16:28:00", air_time_minutes: 21.6, pic: "ROC", assistant: "TK", fts_activation: 0, flight_mode: "N", latitude: 53.23092191, longitude: -9.45942214, takeoff_landing_address: "Cnoc Carrach, County Galway", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 36, flight_plan_id: 9, date_time_utc: "2025-05-23 19:31:00", air_time_minutes: 0.08, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.34400513, longitude: -6.28424694, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 37, flight_plan_id: 9, date_time_utc: "2025-05-23 19:38:00", air_time_minutes: 20.53, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34397465, longitude: -6.28424823, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 38, flight_plan_id: 9, date_time_utc: "2025-05-23 20:23:00", air_time_minutes: 11.28, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34098726, longitude: -6.28631842, takeoff_landing_address: "24 Taylor's Ln, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 39, flight_plan_id: 9, date_time_utc: "2025-05-23 20:43:00", air_time_minutes: 26.18, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3439896, longitude: -6.28419322, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 40, flight_plan_id: 9, date_time_utc: "2025-05-23 21:15:00", air_time_minutes: 14.37, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34098459, longitude: -6.28640965, takeoff_landing_address: "24 Taylor's Ln, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 41, flight_plan_id: 10, date_time_utc: "2025-05-24 09:19:00", air_time_minutes: 0.13, pic: "TK", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.3482785, longitude: -6.28240235, takeoff_landing_address: "Wolfe Tone Quay, Stoneybatter, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 42, flight_plan_id: 10, date_time_utc: "2025-05-24 09:42:00", air_time_minutes: 8.98, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34868353, longitude: -6.28148493, takeoff_landing_address: "7 Blackhall St, Smithfield, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 43, flight_plan_id: 11, date_time_utc: "2025-05-24 10:02:00", air_time_minutes: 13.4, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.35039181, longitude: -6.3002161, takeoff_landing_address: "Peoples Garden Lodge, Phoenix Park, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 44, flight_plan_id: 12, date_time_utc: "2025-05-24 10:21:00", air_time_minutes: 20.88, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3526264, longitude: -6.31330373, takeoff_landing_address: "Magazine Fort, Phoenix Park, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 45, flight_plan_id: 10, date_time_utc: "2025-05-24 11:13:00", air_time_minutes: 25.9, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34830394, longitude: -6.28235407, takeoff_landing_address: "Wolfe Tone Quay, Stoneybatter, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 46, flight_plan_id: 10, date_time_utc: "2025-05-24 11:59:00", air_time_minutes: 4.0, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3483739, longitude: -6.28422807, takeoff_landing_address: "Collins Square, 43 Benburb St, Smithfield, Dublin 7", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 47, flight_plan_id: 13, date_time_utc: "2025-05-24 18:47:00", air_time_minutes: 0.12, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.34399629, longitude: -6.28421603, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 48, flight_plan_id: 13, date_time_utc: "2025-05-24 18:50:00", air_time_minutes: 0.58, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34400084, longitude: -6.28423463, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 49, flight_plan_id: 13, date_time_utc: "2025-05-24 18:52:00", air_time_minutes: 3.6, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34399668, longitude: -6.28423912, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 50, flight_plan_id: 13, date_time_utc: "2025-05-24 20:08:00", air_time_minutes: 18.07, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34296405, longitude: -6.28213315, takeoff_landing_address: "24 Thomas St, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 51, flight_plan_id: 13, date_time_utc: "2025-05-24 20:35:00", air_time_minutes: 2.1, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34098497, longitude: -6.2864296, takeoff_landing_address: "24 Taylor's Ln, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 52, flight_plan_id: 13, date_time_utc: "2025-05-24 20:55:00", air_time_minutes: 20.62, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34295634, longitude: -6.28212149, takeoff_landing_address: "24 Thomas St, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 53, flight_plan_id: 14, date_time_utc: "2025-05-25 17:20:00", air_time_minutes: 0.07, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.34400927, longitude: -6.28422382, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 54, flight_plan_id: 14, date_time_utc: "2025-05-25 17:24:00", air_time_minutes: 11.87, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34400215, longitude: -6.28421412, takeoff_landing_address: "The Digital Hub, Roe Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 55, flight_plan_id: 14, date_time_utc: "2025-05-25 18:44:00", air_time_minutes: 12.53, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3429591, longitude: -6.28216582, takeoff_landing_address: "24 Thomas St, The Liberties, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 56, flight_plan_id: 15, date_time_utc: "2025-05-31 12:51:00", air_time_minutes: 0.08, pic: "ROC", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.34344549, longitude: -6.30154747, takeoff_landing_address: "Royal Hospital Kilmainham, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 57, flight_plan_id: 15, date_time_utc: "2025-05-31 12:55:00", air_time_minutes: 24.65, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34342869, longitude: -6.30156811, takeoff_landing_address: "Royal Hospital Kilmainham, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 58, flight_plan_id: 15, date_time_utc: "2025-05-31 13:40:00", air_time_minutes: 21.47, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34403951, longitude: -6.30179479, takeoff_landing_address: "IMMA Gardens, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 59, flight_plan_id: 16, date_time_utc: "2025-05-31 15:41:00", air_time_minutes: 17.72, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34199409, longitude: -6.30226905, takeoff_landing_address: "61 Kilmainham Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 60, flight_plan_id: 16, date_time_utc: "2025-05-31 16:10:00", air_time_minutes: 3.12, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34446436, longitude: -6.3023233, takeoff_landing_address: "IMMA Gardens, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 61, flight_plan_id: 16, date_time_utc: "2025-05-31 16:45:00", air_time_minutes: 24.12, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34428414, longitude: -6.30045426, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 62, flight_plan_id: 16, date_time_utc: "2025-05-31 17:11:00", air_time_minutes: 28.6, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34430018, longitude: -6.30038459, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 63, flight_plan_id: 16, date_time_utc: "2025-05-31 18:53:00", air_time_minutes: 26.17, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.341994, longitude: -6.30225781, takeoff_landing_address: "61 Kilmainham Ln, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 64, flight_plan_id: 16, date_time_utc: "2025-05-31 19:26:00", air_time_minutes: 9.72, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34430989, longitude: -6.30036582, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 65, flight_plan_id: 16, date_time_utc: "2025-05-31 20:04:00", air_time_minutes: 17.27, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34216091, longitude: -6.30244636, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 66, flight_plan_id: 16, date_time_utc: "2025-05-31 20:22:00", air_time_minutes: 2.58, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34219318, longitude: -6.30213666, takeoff_landing_address: "Royal Hospital Kilmainham, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 67, flight_plan_id: 16, date_time_utc: "2025-05-31 20:46:00", air_time_minutes: 14.32, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3442915, longitude: -6.30043309, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 68, flight_plan_id: 16, date_time_utc: "2025-05-31 21:07:00", air_time_minutes: 4.85, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3420787, longitude: -6.30287719, takeoff_landing_address: "High Road, Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 69, flight_plan_id: 16, date_time_utc: "2025-05-31 21:37:00", air_time_minutes: 8.85, pic: "ROC", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34218059, longitude: -6.30242901, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 70, flight_plan_id: 17, date_time_utc: "2025-06-01 15:41:00", air_time_minutes: 0.12, pic: "TK", assistant: null, fts_activation: 1, flight_mode: "C", latitude: 53.34426929, longitude: -6.30044951, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 71, flight_plan_id: 17, date_time_utc: "2025-06-01 15:44:00", air_time_minutes: 19.63, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34428904, longitude: -6.30040819, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 72, flight_plan_id: 17, date_time_utc: "2025-06-01 16:41:00", air_time_minutes: 12.75, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34207898, longitude: -6.30232674, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 73, flight_plan_id: 17, date_time_utc: "2025-06-01 17:21:00", air_time_minutes: 23.67, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34428095, longitude: -6.30046701, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A0C76F (Pink 01)" },
  { id: 74, flight_plan_id: 18, date_time_utc: "2025-06-01 18:00:00", air_time_minutes: 11.58, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34228087, longitude: -6.3055419, takeoff_landing_address: "2 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 75, flight_plan_id: 18, date_time_utc: "2025-06-01 18:18:00", air_time_minutes: 24.97, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34340201, longitude: -6.30636244, takeoff_landing_address: "687 S Circular Rd, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" },
  { id: 76, flight_plan_id: 17, date_time_utc: "2025-06-01 19:24:00", air_time_minutes: 19.85, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34208056, longitude: -6.30231162, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B99 (Orange 03)" },
  { id: 77, flight_plan_id: 17, date_time_utc: "2025-06-01 19:51:00", air_time_minutes: 24.03, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34428212, longitude: -6.30044133, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G217BA (White 07)" },
  { id: 78, flight_plan_id: 17, date_time_utc: "2025-06-01 20:17:00", air_time_minutes: 14.45, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34428628, longitude: -6.30043206, takeoff_landing_address: "RHK Gardens, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17CYM (Red 04)" },
  { id: 79, flight_plan_id: 17, date_time_utc: "2025-06-01 20:49:00", air_time_minutes: 10.78, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34209004, longitude: -6.30229757, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-A17B2M (Green 02)" },
  { id: 80, flight_plan_id: 18, date_time_utc: "2025-06-01 21:08:00", air_time_minutes: 23.28, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.3433889, longitude: -6.30635111, takeoff_landing_address: "687 S Circular Rd, Dublin", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G2131A (Blue 06)" },
  { id: 81, flight_plan_id: 17, date_time_utc: "2025-06-01 21:38:00", air_time_minutes: 6.2, pic: "TK", assistant: null, fts_activation: 0, flight_mode: "C", latitude: 53.34212135, longitude: -6.30264836, takeoff_landing_address: "High Road, 3 Kilmainham Ln, Dublin 8", drone: "DJI Mavic 3 Pro", battery: "Bat-Mavic3-G20UQA (Yellow 05)" }
];

const pilots = [
  { id: 1, code: "ROC", name: "Rob O'Connor", license: "A2 CofC", email: "rob@aerial.ie" },
  { id: 2, code: "TK", name: "Tony Kinlan", license: "A2 CofC", email: "tony@aerial.ie" },
  { id: 3, code: "FMcC", name: "Fergal McCarthy", license: "A2 CofC", email: "fergal@aerial.ie" }
];

const drones = [
  { id: 1, manufacturer: "DJI", model: "Mavic 3 Pro", name: "DJI Mavic 3 Pro", type: "Quadcopter", serial_number: "1581F67QC234F0140NMP", colour: "Grey/Black", weight: 958, status: "Active" },
  { id: 2, manufacturer: "DJI", model: "Mavic 3 Pro Cine", name: "DJI Mavic 3 Pro Cine", type: "Quadcopter", serial_number: null, colour: null, weight: 958, status: "Not Purchased" },
  { id: 3, manufacturer: "DJI", model: "Mavic 3 Thermal", name: "DJI Mavic 3 Thermal", type: "Quadcopter", serial_number: null, colour: null, weight: 920, status: "Not Purchased" },
  { id: 4, manufacturer: "DJI", model: "Mavic 3 Enterprise", name: "DJI Mavic 3 Enterprise", type: "Quadcopter", serial_number: null, colour: null, weight: 915, status: "Not Purchased" }
];

const batteries = [
  { id: 1, name: "Bat-Mavic3-A0C76F (Pink 01)", serial_number: "A0C76F", capacity: 5000 },
  { id: 2, name: "Bat-Mavic3-A17B2M (Green 02)", serial_number: "A17B2M", capacity: 5000 },
  { id: 3, name: "Bat-Mavic3-A17B99 (Orange 03)", serial_number: "A17B99", capacity: 5000 },
  { id: 4, name: "Bat-Mavic3-A17CYM (Red 04)", serial_number: "A17CYM", capacity: 5000 },
  { id: 5, name: "Bat-Mavic3-G20UQA (Yellow 05)", serial_number: "G20UQA", capacity: 5000 },
  { id: 6, name: "Bat-Mavic3-G2131A (Blue 06)", serial_number: "G2131A", capacity: 5000 },
  { id: 7, name: "Bat-Mavic3-G217BA (White 07)", serial_number: "G217BA", capacity: 5000 }
];

// Maintenance Logs from audit records
const maintenanceLogs = [
  { id: 1, date: "2025-02-04", type: "Deep Maintenance", scheduled: true, performed_by: "Droneworks", drone_id: 1, next_scheduled: "2026-07-04", notes: "Every 600hrs / 18 Months" },
  { id: 2, date: "2025-02-04", type: "Routine Maintenance", scheduled: true, performed_by: "Droneworks", drone_id: 1, next_scheduled: "2026-02-04", notes: "Every 400hrs / 12 Months" },
  { id: 3, date: "2025-02-04", type: "Basic Maintenance", scheduled: true, performed_by: "Droneworks", drone_id: 1, next_scheduled: "2025-07-04", notes: "Every 200hrs / 6 Months" },
  { id: 4, date: "2025-02-06", type: "Battery Maintenance", scheduled: true, performed_by: "ROC", drone_id: 1, next_scheduled: "2025-05-06", notes: "Every 50 Charges / 3 Months" },
  { id: 5, date: "2025-03-06", type: "Software Update", scheduled: false, performed_by: "ROC", drone_id: 1, next_scheduled: null, notes: "Fly App V1.16.4" },
  { id: 6, date: "2025-05-06", type: "Battery Maintenance", scheduled: true, performed_by: "ROC", drone_id: 1, next_scheduled: "2025-08-06", notes: "Every 50 Charges / 3 Months" }
];

// Training Logs from audit records
const trainingLogs = [
  { id: 1, date: "2022-09-08", type: "A1/A3, A2, STS Training", scheduled: true, pilot_id: 2, pilot_name: "Tony Kinlan", next_scheduled: "2027-09-08", notes: null },
  { id: 2, date: "2022-09-08", type: "A1/A3, A2, STS Training", scheduled: true, pilot_id: 1, pilot_name: "Rob O'Connor", next_scheduled: "2027-09-08", notes: null },
  { id: 3, date: "2024-10-29", type: "ERP Training", scheduled: true, pilot_id: 2, pilot_name: "Tony Kinlan", next_scheduled: "2025-10-29", notes: null },
  { id: 4, date: "2024-10-29", type: "ERP Training", scheduled: true, pilot_id: 1, pilot_name: "Rob O'Connor", next_scheduled: "2025-10-29", notes: null },
  { id: 5, date: "2025-02-05", type: "Specific Category Training", scheduled: true, pilot_id: 2, pilot_name: "Tony Kinlan", next_scheduled: "2030-05-02", notes: null },
  { id: 6, date: "2025-02-05", type: "Specific Category Training", scheduled: true, pilot_id: 1, pilot_name: "Rob O'Connor", next_scheduled: "2030-05-02", notes: null }
];

// Incident/Accident Reports (empty - no incidents recorded)
const incidentReports = [];

// Evidence for flight plans
// Supports both file uploads and form data
const flightPlanEvidence = {};

// Evidence categories - file-based (for image/PDF uploads)
const fileCategories = [
  'flightGeography',        // Map image from DroneDeck
  'emergencyResponsePlan',  // ERP image
  'weather',                // Weather screenshots
  'nearbyEvents',           // Local events check
  'notams',                 // PIB/NOTAMs (PDF)
  'uf101Permission',        // IAA U.F.101 approval (image)
  'uf101Application'        // U.F.101 application form (PDF)
];

// Initialize evidence structure for all flight plans
flightPlans.forEach(fp => {
  flightPlanEvidence[fp.id] = {
    // Form data
    planning: {
      pilotInCommand: null,
      assistant: null,
      ftsOperator: null,
      ftsModel: 'Zephyr CC MVC3'
    },
    flightGeographyData: {
      latitude: null,
      longitude: null,
      operationalScenario: null,
      flightObjective: 'Photo & Video',
      flightCondition: 'Specific category',
      maxHeight: null,
      groundRiskBuffer: null,
      maxFlightSpeed: null,
      contingencyVolume: null,
      adjacentArea: null
    },
    airspaceZones: [],  // Array of zone strings
    // File uploads
    flightGeography: [],
    emergencyResponsePlan: [],
    weather: [],
    nearbyEvents: [],
    notams: [],
    uf101Permission: [],
    uf101Application: []
  };
});

// Scan uploads directory to recover existing files
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'evidence');

if (fs.existsSync(uploadsDir)) {
  const planFolders = fs.readdirSync(uploadsDir).filter(f => {
    return fs.statSync(path.join(uploadsDir, f)).isDirectory();
  });

  planFolders.forEach(planId => {
    const planDir = path.join(uploadsDir, planId);

    // Initialize if not exists
    if (!flightPlanEvidence[planId]) {
      flightPlanEvidence[planId] = {
        planning: { pilotInCommand: null, assistant: null, ftsOperator: null, ftsModel: 'Zephyr CC MVC3' },
        flightGeographyData: { latitude: null, longitude: null, operationalScenario: null, flightObjective: 'Photo & Video', flightCondition: 'Specific category', maxHeight: null, groundRiskBuffer: null, maxFlightSpeed: null, contingencyVolume: null, adjacentArea: null },
        airspaceZones: [],
        flightGeography: [], emergencyResponsePlan: [], weather: [], nearbyEvents: [], notams: [], uf101Permission: [], uf101Application: []
      };
    }

    // Scan category folders for files
    const categoryFolders = fs.readdirSync(planDir).filter(f => {
      return fs.statSync(path.join(planDir, f)).isDirectory();
    });

    categoryFolders.forEach(category => {
      // Only process file-based categories
      if (!fileCategories.includes(category)) return;

      const categoryDir = path.join(planDir, category);
      const files = fs.readdirSync(categoryDir);

      // Initialize array if needed
      if (!Array.isArray(flightPlanEvidence[planId][category])) {
        flightPlanEvidence[planId][category] = [];
      }

      files.forEach(filename => {
        const filePath = path.join(categoryDir, filename);
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

        const fileRecord = {
          id: parseInt(filename.split('-')[0]) || Date.now(),
          filename: filename,
          originalName: filename.replace(/^\d+-/, '').replace(/_/g, ' '),
          uploadDate: stats.mtime.toISOString().split('T')[0],
          fileType: isImage ? 'image' : 'pdf',
          mimeType: isImage ? `image/${ext.slice(1)}` : 'application/pdf',
          size: stats.size,
          path: `/uploads/evidence/${planId}/${category}/${filename}`
        };

        const exists = flightPlanEvidence[planId][category].some(f => f.filename === filename);
        if (!exists) {
          flightPlanEvidence[planId][category].push(fileRecord);
        }
      });
    });
  });

  console.log('Evidence files recovered from disk');
}

module.exports = { flightPlans, flightLogs, pilots, drones, batteries, maintenanceLogs, trainingLogs, incidentReports, flightPlanEvidence, fileCategories };
