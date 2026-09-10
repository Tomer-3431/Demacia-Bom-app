import { NextFunction, Request, Response } from "express";
import Bom from '../models/Bom';

interface OnshapeID {
    documentID: string;
    wvmType: string;
    wvmID: string;
    elementID: string;
    bomID: string;
}

interface SubPartBody {
    partID: string;
    quantity?: number;
}

interface SubAssemblyBody {
    bomID: string;
    quantity?: number;
}

interface BomBody {
    name?: string;
    catlogNumber?: string;
    projectCatalogNumber?: string;
    revision?: string;
    description?: string;
    engineer?: string;

    parts?: SubPartBody[];
    subAssemblies?: SubAssemblyBody[];

    onshapeURL?: string;

    comments?: string;
    onshapeID?: OnshapeID;
}

function formID(onshapeID: OnshapeID): string {
    return `${onshapeID.documentID}_${onshapeID.wvmType}_${onshapeID.wvmID}_${onshapeID.elementID}_${onshapeID.bomID}`;
}

export async function getAllBoms(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const boms = await Bom.find().sort({ id: 1 });
        return res.status(200).json(boms);
    } catch (err) {
        return next(err);
    }
}

export async function getBomByID(
    req: Request<{ id: string}>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = req.params.id;
        const bom = await Bom.findOne({ id: id });
        if (!bom)
            return res.status(404).json({ message: `Bom ${id} not found` });
        return res.status(200).json(bom);
    } catch (err) {
        return next(err);
    }
}

export async function upsertBomByID(
    req: Request<{ id: string }, unknown, BomBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = req.params.id;
        const existing = await Bom.findOne({ id: id });
        const bom = await Bom.findOneAndUpdate(
            { id: id },
            { ...req.body, id: id },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            },
        );
        
        return res.status(existing ? 200 : 201).json(bom);
    } catch (err) {
        return next(err);
    }
}

export async function deleteBomByID(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = req.params.id;
        const deleted = await Bom.findOneAndDelete({ id: id });
        
        if (!deleted)
            return res.status(404).json({ message: `Bom ${id} not found`});
        return res.status(204).json();
    } catch (err) {
        return next(err);
    }
}

export async function getBomByOnsahpeKey(
    req: Request<OnshapeID>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = formID(req.params);
        const delegateReq = req as unknown as Request<{ id: string }>;
        delegateReq.params = { id: id };
        return getBomByID(delegateReq, res, next);
    } catch (err) {
        return next(err);
    }
}

export async function upsertBomByOnshapeKey(
    req: Request<OnshapeID, unknown, BomBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = formID(req.params);
        const delegateReq = req as unknown as Request<{ id: string }, unknown, BomBody>;
        delegateReq.params = { id: id };
        delegateReq.body = {
            ...req.body,
            onshapeID: req.params
        }
        return upsertBomByID(delegateReq, res, next);
    } catch (err) {
        return next(err);
    }
}

export async function deleteBomByOnshapeKey(
    req: Request<OnshapeID>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = formID(req.params);
        const delegateReq = req as unknown as Request<{ id: string }>;
        delegateReq.params = { id: id };
        return deleteBomByID(delegateReq, res, next);
    } catch (err) {
        return next(err);
    }
}
