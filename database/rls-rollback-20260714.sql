-- ROLLBACK for the RLS table lockdown applied 14 July 2026.
-- Paste into the Supabase SQL editor to restore the exact policies that existed before.
--
-- These 17 policies allowed ANYONE holding the anon key (which is embedded in the page
-- source at public/index.html and readable via View Source) to read every table and
-- insert rows into all 8 of them, and to update flight_plans.
--
-- They were dropped because the browser never queries tables directly — it only uploads
-- to Storage. All table access goes through server.js, which runs with SUPABASE_SERVICE_KEY
-- and bypasses RLS. Verified: `grep supabaseClient.from( public/index.html` returns nothing.
--
-- Only run this if the lockdown broke something.

-- SELECT (read) --------------------------------------------------------------
create policy "Allow public read flight_plans"      on flight_plans      for select using (true);
create policy "Allow public read flight_logs"       on flight_logs       for select using (true);
create policy "Allow public read pilots"            on pilots            for select using (true);
create policy "Allow public read drones"            on drones            for select using (true);
create policy "Allow public read batteries"         on batteries         for select using (true);
create policy "Allow public read maintenance_logs"  on maintenance_logs  for select using (true);
create policy "Allow public read training_logs"     on training_logs     for select using (true);
create policy "Allow public read incident_reports"  on incident_reports  for select using (true);

-- INSERT ---------------------------------------------------------------------
create policy "Allow public insert flight_plans"     on flight_plans     for insert with check (true);
create policy "Allow public insert flight_logs"      on flight_logs      for insert with check (true);
create policy "Allow public insert pilots"           on pilots           for insert with check (true);
create policy "Allow public insert drones"           on drones           for insert with check (true);
create policy "Allow public insert batteries"        on batteries        for insert with check (true);
create policy "Allow public insert maintenance_logs" on maintenance_logs for insert with check (true);
create policy "Allow public insert training_logs"    on training_logs    for insert with check (true);
create policy "Allow public insert incident_reports" on incident_reports for insert with check (true);

-- UPDATE ---------------------------------------------------------------------
create policy "Allow public update flight_plans"     on flight_plans     for update using (true);
