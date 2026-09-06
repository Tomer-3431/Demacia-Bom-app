import mongoose from "mongoose";

const subPartSchema = new mongoose.Schema(
  {
    partID: { type: String, required: true },
    quantityToal: { type: Number, default: 1 },
    quantityMade: { type: Number, default: 1 },
    statusCode: { type: Number, default: -1 },
    productionGCOwner: { type: String },
    productionMakingOwner: { type: String },
    lastUpdate: { type: Date },
    firstAdded: { type: Date },
  },
  { _id: false },
);

const workOrderSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, unique: true, index: true },

    name: { type: String },
    bomID: { type: String },
    workOrderOwner: { type: String },
    description: { type: String },

    parts: { type: [subPartSchema], default: [] },

    comments: { type: String },
    workOrderCreated: { type: Date },
  },
  { timestamps: true },
);

workOrderSchema.index(
  {
    _id: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

const WorkOrder = mongoose.model('Work Order', workOrderSchema);

export default WorkOrder;
