import type { RowData } from "../components/Table";

export default interface BomTableRow extends RowData {
  avatar: string;
  name: string;
  catalogNumber: string;
  revision: string;
  description: string;
  engineer: string;
  material: string;
  mass: number;
  price: number;
  quantity: number;
  comments: string;
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
  entityID: string;
  onshapeURL: string;
  exportSTL: string;
  exportParasolid: string;
  vendor: string;
}
