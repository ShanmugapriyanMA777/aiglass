// VisionAssist Guardian Portal - Master Supabase Realtime Subscriptions

function initMasterRealtimeChannel() {
  if (isDemoMode()) return;

  const client = getSupabase();
  if (!client) return;

  console.log("Initializing Master Supabase Realtime Channels...");

  // Subscribe to Location updates
  client.channel('guardian-locations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, payload => {
      console.log('Realtime location update:', payload.new);
      if (typeof updateMapLocation === 'function') {
        updateMapLocation(payload.new.latitude, payload.new.longitude, payload.new.address);
      }
    })
    .subscribe();

  // Subscribe to Safety Alerts
  client.channel('guardian-alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
      console.log('Realtime safety alert event:', payload.new);
      if (payload.new.severity === 'CRITICAL' || payload.new.alert_type === 'SOS') {
        if (typeof triggerEmergencySOSAlert === 'function') {
          triggerEmergencySOSAlert({
            user_name: 'VisionAssist User',
            location: payload.new.message,
            time: new Date(payload.new.created_at).toLocaleTimeString(),
            message: payload.new.message
          });
        }
      }
    })
    .subscribe();

  // Subscribe to Device Status
  client.channel('guardian-device')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'device_status' }, payload => {
      console.log('Realtime device status update:', payload.new);
      if (typeof updateDashboardMetrics === 'function') {
        updateDashboardMetrics();
      }
    })
    .subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
  initMasterRealtimeChannel();
});
