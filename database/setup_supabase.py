#!/usr/bin/env python3
"""Set up Supabase database and import flight logs"""

import os
import pandas as pd
from datetime import datetime
from supabase import create_client, Client

# Supabase credentials
SUPABASE_URL = "https://xvevvssehmtbpkcztzmj.supabase.co"
# Using the anon key - will work with RLS policies
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZXZ2c3NlaG10YnBrY3p0em1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MTI2NzEsImV4cCI6MjA1NDA4ODY3MX0.LkgXd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_flight_logs(excel_path):
    """Import flight logs from Excel file into Supabase"""

    # Read Excel with correct header row
    df = pd.read_excel(excel_path, header=2)
    print(f"Read {len(df)} rows from Excel")

    # Extract unique flight plans and create them
    flight_plans = df['Flightplan'].dropna().unique()
    plan_id_map = {}

    print(f"\nCreating {len(flight_plans)} flight plans...")
    for plan_name in flight_plans:
        # Extract date from plan name if possible (format: "Name DDMMYY")
        parts = plan_name.rsplit(' ', 1)
        plan_date = None
        if len(parts) == 2 and len(parts[1]) == 6:
            try:
                plan_date = datetime.strptime(parts[1], '%d%m%y').strftime('%Y-%m-%d')
            except:
                pass

        # Insert flight plan
        result = supabase.table('flight_plans').insert({
            'name': plan_name,
            'date': plan_date,
            'status': 'Completed'
        }).execute()

        if result.data:
            plan_id_map[plan_name] = result.data[0]['id']
            print(f"  Created: {plan_name}")

    print(f"\nCreated {len(plan_id_map)} flight plans")

    # Import flight logs
    logs_imported = 0
    print(f"\nImporting flight logs...")

    for _, row in df.iterrows():
        if pd.isna(row['Date & Time (UTC)']):
            continue

        plan_id = plan_id_map.get(row['Flightplan']) if pd.notna(row['Flightplan']) else None

        # Handle FTS Activation - convert to int
        fts = 0
        if pd.notna(row['FTS Activation']):
            fts = 1 if row['FTS Activation'] == 1 else 0

        # Prepare log data
        log_data = {
            'flight_plan_id': plan_id,
            'date_time_utc': str(row['Date & Time (UTC)']),
            'air_time_minutes': float(row['Air time minutes']) if pd.notna(row['Air time minutes']) else None,
            'pic': row['PIC'] if pd.notna(row['PIC']) else 'Unknown',
            'assistant': row['Assistant'] if pd.notna(row['Assistant']) and row['Assistant'] != '-' else None,
            'fts_activation': fts,
            'flight_mode': row['Mode'] if pd.notna(row['Mode']) else None,
            'latitude': float(row['Latitude']) if pd.notna(row['Latitude']) else None,
            'longitude': float(row['Longitude']) if pd.notna(row['Longitude']) else None,
            'takeoff_landing_address': row['Take Off & Landing address'] if pd.notna(row['Take Off & Landing address']) else None,
            'drone': row['Drone'] if pd.notna(row['Drone']) else 'Unknown',
            'battery': row['Battery'] if pd.notna(row['Battery']) else None,
            'accident_or_incident': row['Accident or serious Incident'] if pd.notna(row['Accident or serious Incident']) and row['Accident or serious Incident'] != '-' else None,
            'defects_or_rectification': row['Defects or Rectification'] if pd.notna(row['Defects or Rectification']) and row['Defects or Rectification'] != '-' else None,
            'repairs_changes': row['Repairs/Changes'] if pd.notna(row['Repairs/Changes']) and row['Repairs/Changes'] != '-' else None
        }

        result = supabase.table('flight_logs').insert(log_data).execute()
        if result.data:
            logs_imported += 1

    print(f"Imported {logs_imported} flight logs")

    # Extract and create pilots
    pilots = df['PIC'].dropna().unique()
    pilot_names = {
        'ROC': "Rob O'Connor",
        'TK': 'Tony Kinlan',
        'SM': 'Sarah Murphy',
        'CK': 'Conor Kelly'
    }

    print(f"\nCreating {len(pilots)} pilots...")
    for pilot_code in pilots:
        name = pilot_names.get(pilot_code, pilot_code)
        result = supabase.table('pilots').insert({
            'code': pilot_code,
            'name': name,
            'role': 'Chief Pilot' if pilot_code == 'ROC' else 'Pilot'
        }).execute()
        if result.data:
            print(f"  Created pilot: {name} ({pilot_code})")

    # Extract and create drones
    drones = df['Drone'].dropna().unique()
    print(f"\nCreating {len(drones)} drones...")
    for drone_str in drones:
        # Parse drone string like "DJI mavic 3 pro. 1581F67QC234F0140NMP"
        parts = drone_str.split('. ')
        name = parts[0] if parts else drone_str
        serial = parts[1] if len(parts) > 1 else None

        result = supabase.table('drones').insert({
            'name': name,
            'manufacturer': 'DJI',
            'model': name.replace('DJI ', ''),
            'serial_number': serial,
            'status': 'Active'
        }).execute()
        if result.data:
            print(f"  Created drone: {name}")

    # Extract and create batteries
    batteries = df['Battery'].dropna().unique()
    print(f"\nCreating {len(batteries)} batteries...")
    for battery_str in batteries:
        result = supabase.table('batteries').insert({
            'serial': battery_str,
            'name': battery_str,
            'status': 'Active'
        }).execute()
        if result.data:
            print(f"  Created battery: {battery_str}")

    print("\n=== Import Complete ===")


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        import_flight_logs(sys.argv[1])
    else:
        # Default path
        excel_path = '/sessions/busy-nifty-bohr/mnt/uploads/Logs Green Graph Adore 030625.xlsx'
        if os.path.exists(excel_path):
            import_flight_logs(excel_path)
        else:
            print("Usage: python setup_supabase.py <excel_file>")
