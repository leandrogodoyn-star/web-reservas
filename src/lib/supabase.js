import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ocwxvrtmgzcjnysapvvr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jd3h2cnRtZ3pjam55c2FwdnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDMwNzcsImV4cCI6MjA4Njk3OTA3N30.l7MgVmM7EBEpnyfnnoYNZE56fW4_pUeRR6XU1IcLnFI"; // ← la encontrás en Supabase Settings → API

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
