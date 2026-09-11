import mongoose from "mongoose";

const onshapeIDSchema = new mongoose.Schema(
  {
    documentID: { type: String, required: true },
    wvmType: { type: String, enum: ["w", "v", "m"], required: true },
    wvmID: { type: String, required: true },
    elementID: { type: String, required: true },
    partID: { type: String, required: true },
  },
  { _id: false },
);

const partSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },

    name: { type: String },
    catalogNumber: { type: String },
    revision: { type: String },
    description: { type: String },
    engineer: { type: String },

    material: { type: String },
    mass: { type: Number },
    price: { type: Number },
    productionType: { type: Number, ref: "ProductionType" },

    onshapeURL: { type: String },
    avatarID: { type: String },
    stlLink: { type: String },
    parasolidLink: { type: String },

    comments: { type: String },
    onshapeID: { type: onshapeIDSchema, required: false },
    vendor: { type: String, },
  },
  { _id: false, timestamps: true },
);

const Part = mongoose.model('Part', partSchema);

export default Part;
