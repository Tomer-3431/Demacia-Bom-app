export const productionType: { id: number; name: string; description: string }[] = [
  { id: 0, name: "Manual", description: "" },
  { id: 1, name: "3D Printed", description: "" },
  { id: 2, name: "CNC", description: "" },
  { id: 3, name: "Lathe", description: "Machreta" },
  { id: 4, name: "Milled", description: "Carsomet" },
  { id: 5, name: "Externally made", description: "" },
  { id: 6, name: "Purchased externally", description: "" },
];

export const statuses: {
  id: number;
  name: string;
  description: string;
  color: string;
}[] = [
  { id: 0, name: "Not Started", description: "", color: "#000000" },
  { id: 1, name: "Parts being made", description: "", color: "#000000" },
  {
    id: 2,
    name: "Part G code being made",
    description: "",
    color: "#000000",
  },
  { id: 3, name: "On hold", description: "", color: "#000000" },
  { id: 4, name: "Done", description: "", color: "#000000" },
  { id: 5, name: "Cancelled", description: "", color: "#000000" },
];
