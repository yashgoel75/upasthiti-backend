import express from "express";
import { register } from "./instrumentation.js";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.listen(5000, () => {
  register();
  console.log("Server running on http://localhost:5000");
});
