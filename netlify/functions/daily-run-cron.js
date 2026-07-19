// Native fetch is available globally in Node 18+ on Netlify

exports.handler = async function(event, context) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  // Fallback to production default URL if env not defined
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://truyen24h.vn';
  
  console.log(`[Cron] Triggering daily run cron at ${siteUrl}/api/admin/daily-run-cron`);
  
  try {
    // Native fetch is available in Node 18+ runtime on Netlify
    const response = await fetch(`${siteUrl}/api/admin/daily-run-cron`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Cron] Response status: ${response.status}`);
    return {
      statusCode: response.status,
      body: JSON.stringify({ message: `Triggered daily run cron, status: ${response.status}` })
    };
  } catch (error) {
    console.error('[Cron] Error triggering cron:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
