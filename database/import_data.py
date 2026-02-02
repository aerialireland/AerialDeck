#!/usr/bin/env python3
"""Import flight logs from Excel into Supabase database"""

import os
import sys
import pandas as pd
from datetime import datetime
import requests
import json

# Supabase configuration
SUPABASE_URL = "https://xvevvssehmtbpkcztzmj.supabase.co"
# The anon key for this project (safe to use with RLS enabled)
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZXZ2c3NlaG10YnBrY3p0em1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MTI2NzEsImV4cCI6MjA1NDA4ODY3MX0.LkgXdZPEKPLYTY8xCsqNlWMYHLYrXrWqBX7_K0vH8Z8"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def api_request(method, table, data=None, params=None):
    """Make a request to Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"

    if method == "GET":
        response = requests.get(url, headers=HEADERS, params=params)
    elif method == "POST":
        response = requests.post(url, headers=HEADERS, json=data)
    elif method == "PATCH":
        response = requests.patch(url, headers=HEADERS, json=data, params=params)

    if response.status_code >= 400:
        print(f"API Error: {response.status_code} - {response.text}")
        return None

    try:
        return response.json()
    except:
        return response.text

def import_flight_logs(excel_path):
    """Import flight logs from Excel file into Supabase"""

    print(f"Reading Excel file: {excel_path}")

    # Read Excel with correct header row (row 3 = index 2)
    df = pd.read_excel(excel_path, header=2)
    print(f"Found {len(df)} rows")

    # Extract unique flight plans and create them
    flight_plans = df['Flightplan'].dropna().unique()
    plan_id_map = {}

    print(f"\n=== Creating {len(flight_plans)} Flight Plans ===")
    for plan_name in flight_plans:
        # Extract date from plan name if possible (format: "Name DDMMYY")
        parts = str(plan_name).rsplit(' ', 1)
        plan_date = None
        if len(parts) == 2 and len(parts[1]) == 6:
            try:
                plan_date = datetime.strptime(parts[1], '%d%m%y').strftime('%Y-%m-%d')
            except:
                pass

        # Insert flight plan
        result = api_request("POST", "flight_plans", {
            "name": str(plan_name),
            "date": plan_date,
            "status": "Completed"
        })

        if result and len(result) > 0:
            plan_id_map[plan_name] = result[0]['id']
            print(f"  Created: {plan_name} (ID: {result[0]['id']})")
        else:
            print(f"  Failed to create: {plan_name}")

    print(f"\nCreated {len(plan_id_map)} flight plans")

    # Import flight logs
    logs_imported = 0
    errors = 0
    print(f"\n=== Importing Flight Logs ===")

    for idx, row in df.iterrows():
        if pd.isna(row['Date & Time (UTC)']):
            continue

        plan_id = plan_id_map.get(row['Flightplan']) if pd.notna(row['Flightplan']) else None

        # Handle FTS Activation - convert to int
        fts = 0
        if pd.notna(row.get('FTS Activation')):
            fts = 1 if row['FTS Activation'] == 1 else 0

        # Prepare log data
        log_data = {
            "flight_plan_id": plan_id,
            "date_time_utc": str(row['Date & Time (UTC)']),
            "air_time_minutes": float(row['Air time minutes']) if pd.notna(row.get('Air time minutes')) else None,
            "pic": str(row['PIC']) if pd.notna(row.get('PIC')) else 'Unknown',
            "assistant": str(row['Assistant']) if pd.notna(row.get('Assistant')) and row['Assistant'] != '-' else None,
            "fts_activation": fts,
            "flight_mode": str(row['Mode']) if pd.notna(row.get('Mode')) else None,
            "latitude": float(row['Latitude']) if pd.notna(row.get('Latitude')) else None,
            "longitude": float(row['Longitude']) if pd.notna(row.get('Longitude')) else None,
            "takeoff_landing_address": str(row['Take Off & Landing address']) if pd.notna(row.get('Take Off & Landing address')) else None,
            "drone": str(row['Drone']) if pd.notna(row.get('Drone')) else 'Unknown',
            "battery": str(row['Battery']) if pd.notna(row.get('Battery')) else None,
            "accident_or_incident": str(row['Accident or serious Incident']) if pd.notna(row.get('Accident or serious Incident')) and row['Accident or serious Incident'] != '-' else None,
            "defects_or_rectification": str(row['Defects or Rectification']) if pd.notna(row.get('Defects or Rectification')) and row['Defects or Rectification'] != '-' else None,
            "repairs_changes": str(row['Repairs/Changes']) if pd.notna(row.get('Repairs/Changes')) and row['Repairs/Changes'] != '-' else None
        }

        # Remove None values
        log_data = {k: v for k, v in log_data.items() if v is not None}

        result = api_request("POST", "flight_logs", log_data)
        if result:
            logs_imported += 1
            if logs_imported % 10 == 0:
                print(f"  Imported {logs_imported} logs...")
        else:
            errors += 1

    print(f"\nImported {logs_imported} flight logs ({errors} errors)")

    # Extract and create pilots
    pilots = df['PIC'].dropna().unique()
    pilot_names = {
        'ROC': "Rob O'Connor",
        'TK': 'Tony Kinlan',
        'SM': 'Sarah Murphy',
        'CK': 'Conor Kelly'
    }

    print(f"\n=== Creating {len(pilots)} Pilots ===")
    for pilot_code in pilots:
        name = pilot_names.get(str(pilot_code), str(pilot_code))
        result = api_request("POST", "pilots", {
            "code": str(pilot_code),
            "name": name,
            "role": "Chief Pilot" if pilot_code == 'ROC' else "Pilot"
        })
        if result:
            print(f"  Created pilot: {name} ({pilot_code})")

    # Extract and create drones
    drones = df['Drone'].dropna().unique()
    print(f"\n=== Creating {len(drones)} Drones ===")
    for drone_str in drones:
        # Parse drone string like "DJI mavic 3 pro. 1581F67QC234F0140NMP"
        parts = str(drone_str).split('. ')
        name = parts[0] if parts else str(drone_str)
        serial = parts[1] if len(parts) > 1 else None

        drone_data = {
            "name": name,
            "manufacturer": "DJI",
            "model": name.replace("DJI ", ""),
            "status": "Active"
        }
        if serial:
            drone_data["serial_number"] = serial

        result = api_request("POST", "drones", drone_data)
        if result:
            print(f"  Created drone: {name}")

    # Extract and create batteries
    batteries = df['Battery'].dropna().unique()
    print(f"\n=== Creating {len(batteries)} Batteries ===")
    for battery_str in batteries:
        result = api_request("POST", "batteries", {
            "serial": str(battery_str),
            "name": str(battery_str),
            "status": "Active"
        })
        if result:
            print(f"  Created battery: {battery_str}")

    print("\n" + "="*50)
    print("IMPORT COMPLETE!")
    print("="*50)


if __name__ == '__main__':
    # Default Excel path
    excel_path = '/sessions/busy-nifty-bohr/mnt/uploads/Logs Green Graph Adore 030625.xlsx'

    if len(sys.argv) > 1:
        excel_path = sys.argv[1]

    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found: {excel_path}")
        sys.exit(1)

    import_flight_logs(excel_path)
