import { NextFunction, Request, Response } from "express";
import Part from "../models/Part";

interface OnshapeID {
  documentID: string;
  wvmType: "w" | "v" | "m";
  wvmID: string;
  elementID: string;
  partID: string;
}

interface PartBody {
  name?: string;
  catalogNumber?: string;
  revision?: string;
  description?: string;
  engineer?: string;

  material?: string;
  mass?: number;
  price?: number;
  productionType?: number;

  onshapeURL?: string;
  stlLink?: string;
  parasolidLink?: string;

  comments?: string;
  onshapeID?: OnshapeID;
}

function formID(OnshapeID: OnshapeID): string {
  return `${OnshapeID.documentID}_${OnshapeID.wvmType}_${OnshapeID.wvmID}_${OnshapeID.elementID}_${OnshapeID.partID}`;
}

export async function getAllParts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parts = await Part.find().sort({ id: 1 });
    return res.status(200).json(parts);
  } catch (err) {
    return next(err);
  }
}

export async function getPartByID(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const part = await Part.findOne({ id: id });
    if (!part)
      return res
        .status(404)
        .json({ message: `Part ${id} not found` });
    return res.status(200).json(part);
  } catch (err) {
    return next(err);
  }
}

export async function upsertPartByID(
  req: Request<{ id: string }, unknown, PartBody>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const existing = await Part.findOne({ id: id });
    const part = await Part.findOneAndUpdate(
      { id: id },
      { ...req.body, id: id },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(existing ? 200 : 201).json(part);
  } catch (err) {
    return next(err);
  }
}

export async function deletePartByID(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const deleted = await Part.findOneAndDelete({ id: id });

    if (!deleted)
      return res.status(404).json({ message: `Part ${id} not found` });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

export async function getPartByOnshapeKey(
  req: Request<OnshapeID>,
  res: Response,
  next: NextFunction,
) {
  const id = formID(req.params);
  const delegateReq = req as unknown as Request<{ id: string }>;
  delegateReq.params = { id: id };
  return getPartByID(delegateReq, res, next);
}

export async function upsertPartByOnshapeKey(
  req: Request<OnshapeID, unknown, PartBody>,
  res: Response,
  next: NextFunction,
) {
  const id = formID(req.params);
  const delegateReq = req as unknown as Request<
    { id: string },
    unknown,
    PartBody
  >;
  delegateReq.params = { id: id };
  delegateReq.body = {
    ...req.body,
    onshapeID: req.params,
  };
  return upsertPartByID(delegateReq, res, next);
}

export async function deletePartByOnshapeKey(
  req: Request<OnshapeID>,
  res: Response,
  next: NextFunction,
) {
  const id = formID(req.params);
  const delegateReq = req as unknown as Request<{ id: string }>;
  delegateReq.params = { id: id };
  return deletePartByID(delegateReq, res, next);
}
