const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const workflowRoutes = require("./routes/workflowRoutes");
const stepRoutes = require("./routes/stepRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const executionRoutes = require("./routes/executionRoutes");
const adminRoutes = require("./routes/adminRoutes");

const errorHandler = require("./middleware/errorHandler");
const { NotFoundError } = require("./utils/errors");

const app = express();

app.use(cors());
app.use(express.json());

// Routes

app.use("/api", workflowRoutes);
app.use("/api", stepRoutes);
app.use("/api", ruleRoutes);
app.use("/api", executionRoutes);
app.use("/api", adminRoutes);

// Database health check
app.get("/health", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "success",
      message: "Halleyx Workflow Automation API Running",
      server_time: result.rows[0].now
    });
  } catch (err) {
    next(err);
  }
});

// 404 Handler
app.use((req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// Global Error Handler
app.use(errorHandler);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
