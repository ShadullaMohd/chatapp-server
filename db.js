import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool, Client } = pg;

async function ensureDatabaseExists() {
  // Always use SSL, even for checking database
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: "postgres", // connect to default postgres DB
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();

    const dbName = process.env.DB_NAME;
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${dbName}'`);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created successfully!`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error("❌ Error ensuring database exists:", err.message);
  } finally {
    await client.end();
  }
}

// Ensure DB exists before connecting
await ensureDatabaseExists();

// ✅ Use SSL in pool connection too
export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
});
