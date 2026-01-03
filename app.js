import express from "express";
import cors from "cors";
import adminRouter from "./routes/admin.routes.js";
import utilRouter from "./routes/util.routes.js";
import facultiesRouter from "./routes/faculties.routes.js";
import studentsRouter from "./routes/students.routes.js";

const app = express();
const allowedOrigins = [
  "http://localhost:3000",
  "https://upasthiti-admin-frontend.vercel.app",
  "https://upasthiti-student-frontend.vercel.app",
  "https://upasthiti-faculty-frontend.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/admin", adminRouter);

app.use("/api/faculty", facultiesRouter);

app.use("/api/student", studentsRouter);

app.use("/api", utilRouter);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

export { app };
