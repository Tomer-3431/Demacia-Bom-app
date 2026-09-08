import express, { Express } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import dns from 'node:dns';
import { MongoClient } from 'mongodb';

dotenv.config();

dns.setDefaultResultOrder("ipv4first");

const PORT = process.env.PORT || 5050;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(mongoUri);
const app: Express = express();

app.use(cors());
app.use(express.json());

async function startServer(): Promise<void> {
  try {
    await client.connect();
    console.log("Succeessfully connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1)
  }
}
app.use('/api', require('./routes').default);
startServer();
