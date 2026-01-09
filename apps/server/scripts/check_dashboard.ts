
async function run() {
    console.log('Fetching dashboard stats as admin...');
    const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0].trim();
    const res = await fetch('http://localhost:3000/api/dashboard/stats', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // Admin cookie
            'Cookie': `session=${encodeURIComponent(JSON.stringify({
                id: 'admin_123',
                name: 'Admin User',
                email: adminEmail,
                isAdmin: true
            }))}`
        }
    });

    if (res.ok) {
        const data = await res.json();
        console.log('Dashboard Stats:', JSON.stringify(data, null, 2));
    } else {
        console.log('Error:', res.status, await res.text());
    }
}

run();
