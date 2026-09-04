import express from "express";
import cors from "cors";
import dotenv from 'dotenv';
import { Bom } from "../models/Bom.ts";
import dns from 'node:dns';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const PORT = process.env.PORT || 5050;
const client = new MongoClient(process.env.MONGODB_URI);
const dbName = 'Test';
const app = express();

app.use(cors());
app.use(express.json());

client.connect();
const db = client.db(dbName);

app.get('/api/bom/getBomDataDB/:documentId/:wvmType/:wvmId/:elementId', async (req, res) => {
  const { documentId, wvmType, wvmId, elementId } = req.params;

  if (!documentId || !wvmType || !wvmId || !elementId) {
    return res.status(400).json({ error: 'Missing required Onshape parametrs' });
  }

  try {
    const savedRecord = await db.collection('bom').findOne({
      _id: `${documentId}${wvmType}${wvmId}${elementId}`
    });

    console.info('find a record: ', savedRecord);

    res.status(200).json({
      success: true,
      data: savedRecord
    });
  } catch (err) {
    console.error("Found an error while trying to find a record", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bom/uploadBom', async (req, res) => {
  const { documentId, wvmType, wvmId, elementId } = req.body;

  if (!documentId || !wvmType || !wvmId || !elementId) {
    return res.status(400).json({ error: 'Missing required Onshape parametrs' });
  }

  try {
    const onshapeUrl = `https://cad.onshape.com/api/assemblies/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/bom`;
    const credentails = process.env.ONSHAPE_API_CREDENTIALS;

    const onshapeRes = await fetch(onshapeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;charset=UTF-8;qs=0.09',
        'Authorization': `Basic ${credentails}`
      },
    });

    if (!onshapeRes.ok) {
      throw new Error(`Onshape API responded with status ${onshapeRes.status}`);
    }

    const fetchedBomData = await onshapeRes.json();

    const savedRecord = await db.collection('bom').insertOne(
      {
        _id: `${documentId}${wvmType}${wvmId}${elementId}`, documentId, wvmType, wvmId, elementId, bomData: fetchedBomData, createdAt: new Date()
      },
      { returnDocument: 'after', upsert: true, maxTimeMS: 15000 }
    );

    console.info('successfully upload the new data, id:', savedRecord)

    res.status(200).json({
      success: true,
      mongoId: savedRecord._id,
      data: savedRecord._id,
    });
  } catch (error) {
    console.error('Error fetching/saving BOM:', error);
    res.status(500).json({ error: error.message });
  }
});

// start the Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
