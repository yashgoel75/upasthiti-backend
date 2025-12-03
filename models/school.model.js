import mongoose from "mongoose";
const SchoolSchema = new mongoose.Schema({
  id: String,
  name: String,
  block: String, // A, B or C
  dean: String,
  programmeCoordinator: String,
});
export const School = mongoose.model("School", SchoolSchema);