import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { action, payload } = await req.json()

    let result = null;

    if (action === 'trigger_signal_loss') {
      const { error } = await supabase
        .from('buses')
        .update({ last_telemetry_at: new Date(Date.now() - 95000).toISOString() })
        .eq('id', payload.bus_id)
      if (error) throw error;
      result = { success: true }
    } 
    else if (action === 'trigger_id_conflict') {
      const { error } = await supabase
        .from('telemetry_log')
        .insert([
          { bus_id: payload.bus_id, lat: 38.7749, lng: -121.4194, origin_timestamp: new Date().toISOString() }
        ])
      if (error) throw error;
      result = { success: true }
    }
    else if (action === 'report_breakdown') {
      const { error } = await supabase
        .from('breakdown_reports')
        .insert([{ bus_id: payload.bus_id, reported_by: 'Admin Panel' }])
      if (error) throw error;
      result = { success: true }
    }
    else if (action === 'toggle_road_closure') {
      const { data } = await supabase.from('road_segments').select('status').eq('id', 'SEG-MAIN-ST').single()
      const newStatus = data?.status === 'closed' ? 'open' : 'closed';
      
      const { error } = await supabase
        .from('road_segments')
        .update({ status: newStatus })
        .eq('id', 'SEG-MAIN-ST')
        
      if (error && error.code === 'PGRST116') {
         // Doesn't exist, insert it
         const { error: insErr } = await supabase.from('road_segments').insert([{ id: 'SEG-MAIN-ST', status: 'closed', affected_route_ids: ['R-101'] }])
         if (insErr) throw insErr;
      } else if (error) {
        throw error;
      }
      result = { success: true, status: newStatus }
    }
    else if (action === 'toggle_weather_event') {
      const { data } = await supabase.from('weather_events').select('id, active').order('started_at', { ascending: false }).limit(1).single()
      const newActive = !data?.active;
      
      const { error } = await supabase
        .from('weather_events')
        .insert([{ active: newActive, delay_tolerance_multiplier: newActive ? 0.6 : 1.0, toggled_by: 'Admin Panel' }])
      if (error) throw error;
      result = { success: true, active: newActive }
    }
    else if (action === 'resolve_conflict') {
      // Clear allocation_frozen and delete alerts
      await supabase.from('buses').update({ allocation_frozen: false }).eq('id', payload.bus_id)
      await supabase.from('alerts').update({ resolved_at: new Date().toISOString() }).eq('type', 'id_conflict').eq('related_bus_id', payload.bus_id)
      result = { success: true }
    }
    else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
