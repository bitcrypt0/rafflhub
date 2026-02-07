const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:jWaHRMrnTVFsQtpo@db.xanuhcusfbyrcmnuwwys.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    await client.connect();
    console.log('Connected to database');

    const sql = fs.readFileSync('supabase-setup.sql', 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting:', statement.trim().substring(0, 50) + '...');
        const result = await client.query(statement);
        if (result.rows && result.rows.length > 0) {
          console.log('Result:', result.rows);
        }
      }
    }

    console.log('\n✅ Setup completed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
