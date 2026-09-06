import {NextFunction, Request, Response} from 'express';
import { productionType, statuses } from '../db/enum';

export function getAllProductionTypes(req: Request, res: Response, next: NextFunction) {
    return res.status(200).json(Object.values(productionType));
}

export function getProductionTypeByID(req: Request<{ id: number }>, res: Response, next: NextFunction) {
    const type = productionType[req.params.id];

    if (!type) 
        return res.status(404).json({ message: `Production type ${req.params.id} not founc` });
    return res.status(200).json(type);
}

export function getAllStatuses(req: Request, res: Response, next: NextFunction) {
    return res.status(200).json(Object.values(statuses));
}

export function getStatusByID(req: Request<{ id: number }>, res: Response, next: NextFunction) {
    const status = statuses[req.params.id];

    if (!status)
        return res.status(404).json({ message: `Status ${req.params.id} not found` });
    return res.status(200).json(status);
}
