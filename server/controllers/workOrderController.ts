import { NextFunction, Request, Response } from "express";
import WorkOrder from "../models/WorkOrder";

interface SubPartBody {
  partID: string;
  quantityTotal?: number;
  quantityMade?: number;
  statusCode?: number;
  productionGCOwner?: string;
  productionMakingOwner?: string;
  lastUpdate?: Date;
  firstAdded?: Date;
}

interface WorkOrderBody {
  name?: string;
  bomID?: string;
  workOrderOwner?: string;
  description?: string;

  parts?: SubPartBody[];

  comments?: string;
  workOrderCreated?: Date;
}

export async function getAllWorkOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const workOrders = await WorkOrder.find().sort({ id: 1 });
    return res.status(200).json(workOrders);
  } catch (err) {
    return next(err);
  }
}

export async function getWorkOrderByID(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const workOrder = WorkOrder.findOne({ id: id });
    if (!workOrder)
      return res.status(404).json({ message: `Work Order ${id} not found` });
    return res.status(200).json(workOrder);
  } catch (err) {
    return next(err);
  }
}

export async function upsertWorkOrderByID(
  req: Request<{ id: string }, unknown, WorkOrderBody>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const existing = await WorkOrder.findOne({ id: id });
    const workOrder = await WorkOrder.findByIdAndUpdate(
      { id: id },
      { ...req.body, id: id },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(existing ? 200 : 201).json(workOrder);
  } catch (err) {
    return next(err);
  }
}

export async function deleteWorkOrderByID(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    const deleted = await WorkOrder.findOneAndDelete({ id: id });

    if (!deleted)
      return res.status(404).json({ message: `Work order ${id} not found` });
    return res.status(204).json();
  } catch (err) {
    return next(err);
  }
}
