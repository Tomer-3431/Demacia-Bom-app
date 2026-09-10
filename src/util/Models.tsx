export interface OnshapeID {
  documentID?: string;
  wvmType?: string;
  wvmID?: string;
  elementID?: string;
  bomID?: string;
  partID?: string;
}

export interface BomModel {
  id: string;
  name?: string;
  description?: string;
  catalogNumber?: string;
  engineer?: string;
  comments?: string;
  onshapeURL?: string;
  avatarID?: string;
  onshapeID?: OnshapeID;
  parts: { partID: string; quantity: number }[];
  subAssemblies: { bomID: string; quantity: number }[];
}

export interface PartModel {
  id: string;
  name?: string;
  catalogNumber?: string;
  revision?: string;
  description?: string;
  engineer?: string;
  material?: string;
  mass?: number;
  price?: number;
  comments?: string;
  onshapeURL?: string;
  avatarID?: string;
  stlLink?: string;
  parasolidLink?: string;
  onshapeID?: OnshapeID;
}

export interface WorkorderPartModel {
  partID: string;
  quantityTotal?: number;
  quantityMade?: number;
  statusCode?: number;
  productionGCOwner?: string;
  productionMakingOwner?: string;
  lastUpdate?: Date;
  firstAdded?: Date;
}

export interface WorkorderModel {
  id: string;
  name?: string;
  bomID?: string;
  workOrderOwner?: string;
  description?: string;
  parts?: WorkorderPartModel[];
  avatarID?: string;
  comments?: string;
  workOrderCreated?: Date;
}
