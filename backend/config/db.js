const { Pool } = require("pg");

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } 
    }
  : {
      user: "postgres",
      host: "localhost",
      database: "workflow_engine",
      password: "priya@98",
      port: 5432
    };

const pool = new Pool(poolConfig);

module.exports = pool;
