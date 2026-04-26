require("dotenv/config");
const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  out: "./migrations",
  schema: "./src/database/schemas",
  dialect: "sqlite",
  dbCredentials: {
    url: "./dev.db",
  },
});
