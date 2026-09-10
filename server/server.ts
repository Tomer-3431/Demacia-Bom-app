import dotenv from 'dotenv';
import dns from 'node:dns';
import app from './app';
import { connect } from './db/connection';

dotenv.config();
dns.setDefaultResultOrder("ipv4first");

const PORT = process.env.PORT || 5050;

async function startServer(): Promise<void> {
  try {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    await connect();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1)
  }
}

startServer();

