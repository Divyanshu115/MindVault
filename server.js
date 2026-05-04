require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();

app.set("trust proxy", 1);
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const logger = require("./middleware/logger");
app.use(logger);

const DB_URI = process.env.MONGODB_URI;
mongoose.connect(DB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));


const indexRoutes = require("./routes/indexRoutes");
const authRoutes = require("./routes/authRoutes");
const noteRoutes = require("./routes/noteRoutes");
const deadlineRoutes = require("./routes/deadlineRoutes");
const aiRoutes = require("./routes/aiRoutes");

app.use("/", indexRoutes);
app.use("/", authRoutes);
app.use("/", noteRoutes);
app.use("/", deadlineRoutes);
app.use("/", aiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});