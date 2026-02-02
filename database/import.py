#!/usr/bin/env python3
"""Import flight logs from Excel into SQLite database"""

import sqlite3
import pandas as pd
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'aerialdeck.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def init_db():
    """Initialize database with schema"""
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, 'r') as f:
        conn.executescript(f.read())
    conn.commit()
    return conn

def import_flight_logs(excel_path):
    """Import flight logs from Excel file"""
    conn = init_db()
    cursor = conn.cursor()

    # Read Excel with correct header row
    df = pd.read_excel(excel_path, header=2)

    # Extract unique flight plans and create them
    flight_plans = df['Flightplan'].dropna().unique()
    plan_id_map = {}

    for plan_name in flight_plans:
        # Extract date from plan name if possible (format: "Name DDMMYY")
        parts = plan_name.rsplit(' ', 1)
        plan_date = None
        if len(parts) == 2 and len(parts[1]) == 6:
            try:
                plan_date = datetime.strptime(parts[1], '%d%m%y').strftime('%Y-%m-%d')
            except:
                pass

        cursor.execute('''
            INSERT OR IGNORE INTO flight_plans (name, date, status)
            VALUES (?, ?, 'Completed')
        ''', (plan_name, plan_date))

        cursor.execute('SELECT id FROM flight_plans WHERE name = ?', (plan_name,))
        result = cursor.fetchone()
        if result:
            plan_id_map[plan_name] = result[0]

    conn.commit()
    print(f"Created {len(plan_id_map)} flight plans")

    # Import flight logs
    logs_imported = 0
    for _, row in df.iterrows():
        if pd.isna(row['Date & Time (UTC)']):
            continue

        plan_id = plan_id_map.get(row['Flightplan']) if pd.notna(row['Flightplan']) else None

        # Handle FTS Activation - convert to int
        fts = 0
        if pd.notna(row['FTS Activation']):
            fts = 1 if row['FTS Activation'] == 1 else 0

        cursor.execute('''
            INSERT INTO flight_logs (
                flight_plan_id, date_time_utc, air_time_minutes, pic, assistant,
                fts_activation, flight_mode, latitude, longitude, takeoff_landing_address,
                drone, battery, accident_or_incident, defects_or_rectification, repairs_changes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            plan_id,
            row['Date & Time (UTC)'],
            row['Air time minutes'] if pd.notna(row['Air time minutes']) else None,
            row['PIC'] if pd.notna(row['PIC']) else 'Unknown',
            row['Assistant'] if pd.notna(row['Assistant']) and row['Assistant'] != '-' else None,
            fts,
            row['Mode'] if pd.notna(row['Mode']) else None,
            row['Latitude'] if pd.notna(row['Latitude']) else None,
            row['Longitude'] if pd.notna(row['Longitude']) else None,
            row['Take Off & Landing address'] if pd.notna(row['Take Off & Landing address']) else None,
            row['Drone'] if pd.notna(row['Drone']) else 'Unknown',
            row['Battery'] if pd.notna(row['Battery']) else None,
            row['Accident or serious Incident'] if pd.notna(row['Accident or serious Incident']) and row['Accident or serious Incident'] != '-' else None,
            row['Defects or Rectification'] if pd.notna(row['Defects or Rectification']) and row['Defects or Rectification'] != '-' else None,
            row['Repairs/Changes'] if pd.notna(row['Repairs/Changes']) and row['Repairs/Changes'] != '-' else None
        ))
        logs_imported += 1

    conn.commit()
    print(f"Imported {logs_imported} flight logs")

    # Extract and create pilots
    pilots = df['PIC'].dropna().unique()
    pilot_names = {
        'ROC': 'Rob O\'Connor',
        'TK': 'Tony Kinlan',
        'SM': 'Sarah Murphy',
        'CK': 'Conor Kelly'
    }
    for pilot_code in pilots:
        name = pilot_names.get(pilot_code, pilot_code)
        cursor.execute('''
            INSERT OR IGNORE INTO pilots (code, name, role)
            VALUES (?, ?, ?)
        ''', (pilot_code, name, 'Pilot' if pilot_code != 'ROC' else 'Chief Pilot'))

    conn.commit()
    print(f"Created {len(pilots)} pilots")

    # Extract and create drones
    drones = df['Drone'].dropna().unique()
    for drone_str in drones:
        # Parse drone string like "DJI mavic 3 pro. 1581F67QC234F0140NMP"
        parts = drone_str.split('. ')
        name = parts[0] if parts else drone_str
        serial = parts[1] if len(parts) > 1 else None

        cursor.execute('''
            INSERT OR IGNORE INTO drones (name, manufacturer, model, serial_number, status)
            VALUES (?, ?, ?, ?, 'Active')
        ''', (name, 'DJI', name.replace('DJI ', ''), serial))

    conn.commit()
    print(f"Created drone records")

    # Extract and create batteries
    batteries = df['Battery'].dropna().unique()
    for battery_str in batteries:
        cursor.execute('''
            INSERT OR IGNORE INTO batteries (serial, name, status)
            VALUES (?, ?, 'Active')
        ''', (battery_str, battery_str))

    conn.commit()
    print(f"Created {len(batteries)} battery records")

    conn.close()
    print(f"\nDatabase created at: {DB_PATH}")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        import_flight_logs(sys.argv[1])
    else:
        print("Usage: python import.py <excel_file>")
