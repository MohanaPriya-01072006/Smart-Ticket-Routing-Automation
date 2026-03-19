const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "workflow_engine",
  password: "priya@98",
  port: 5432
});

module.exports = pool;
