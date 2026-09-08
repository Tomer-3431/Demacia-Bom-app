import mongoose from "mongoose";

const onshapeIDSchema = new mongoose.Schema(
  {
    documentID: { type: String, required: true },
    wvmType: { type: String, required: true },
    wvmID: { type: String, required: true },
    elementID: { type: String, required: true },
    bomID: { type: String, required: true },
  },
  {
    _id: false,
  },
);

const subPartSchema = new mongoose.Schema(
  {
    partID: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const subAseemblySchema = new mongoose.Schema(
  {
    bomID: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const bomSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },

    name: { type: String },
    catalogNumber: { type: String },
    projectCatalogNumber: { type: String },
    description: { type: String },
    engineer: { type: String },

    parts: { type: [subPartSchema], default: [] },
    subAssemblies: { type: [subAseemblySchema], default: [] },

    onshapeURL: { type: String },

    comments: { type: String },
    onshapeID: { type: onshapeIDSchema, required: false },
  },
  { _id: false, timestamps: true },
);

const Bom = mongoose.model('Bom', bomSchema);

export default Bom;
