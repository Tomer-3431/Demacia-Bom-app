import type { RowData } from "../components/Table";

export default interface WorkOrderTableRow extends RowData {
    avatar: string;
    name: string;
    catalogNumber: string;
    revision: string;
    description: string;
    engineer: string;
    material: string;
    mass: number;
    price: number;
    quantityTotal: number;
    quantityMade: number;
    statusCode: number;
    productionGCOwner: string;
    productionMakingOwner: string;
    lastUpadte: Date;
    firstAdded: Date;
    comments: string;
    documentID: string;
    wvmType: string;
    wvmID: string;
    elementID: string;
    entityID: string;
    onshapeURL: string;
    exportSTL: string;
    exportParasolid: string;
}