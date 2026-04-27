require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");



// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Ensure you have a .env file with your GEMINI_API_KEY and MONGODB_URI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const DB_URI = process.env.MONGODB_URI;
mongoose.connect(DB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  aiUsageCount: { type: Number, default: 0 }
});
const User = mongoose.model("User", userSchema);

const noteSchema = new mongoose.Schema({
  user: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true }
});
const Note = mongoose.model("Note", noteSchema);

const deadlineSchema = new mongoose.Schema({
  user: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  dueDate: { type: Date, required: true }
});
const Deadline = mongoose.model("Deadline", deadlineSchema);

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Required for parsing JSON bodies from AI fetch requests
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;

const requireAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect("/login");
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie("token");
    return res.redirect("/login");
  }
};

const logger = (req, res, next) => {
  console.log("Request received:", req.method, req.url);
  next();
};

app.use(logger);

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;
    email = email.trim().toLowerCase();
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    
    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).render("register", { error: "Error registering user" });
  }
});

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();
    
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
        
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        return res.redirect("/dashboard");
      }
    }
    
    res.render("login", { error: "Invalid email or password" });
  } catch (error) {
    console.error(error);
    res.status(500).render("login", { error: "Error logging in" });
  }
});

app.post("/delete-note", requireAuth, async (req, res) => {
  try {
    const { title } = req.body;

    await Note.deleteOne({
      user: req.user.name,
      title: title
    });

    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting note");
  }
});

app.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userNotes = await Note.find({ user: req.user.name });
    res.render("dashboard", { user: req.user.name, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
});

app.get("/all-notes", requireAuth, async (req, res) => {
  try {
    const userNotes = await Note.find({ user: req.user.name });
    res.render("all-notes", { user: req.user.name, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
});

app.get("/deadlines", requireAuth, async (req, res) => {
  try {
    const userDeadlines = await Deadline.find({ user: req.user.name }).sort({ dueDate: 1 });
    res.render("deadlines", { user: req.user.name, deadlines: userDeadlines });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching deadlines");
  }
});

app.post("/add-deadline", requireAuth, async (req, res) => {
  try {
    const { title, type, dueDate } = req.body;
    const newDeadline = new Deadline({
      user: req.user.name,
      title,
      type,
      dueDate: new Date(dueDate)
    });
    await newDeadline.save();
    res.redirect("/deadlines");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating deadline");
  }
});

app.post("/delete-deadline", requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    await Deadline.findByIdAndDelete(id);
    res.redirect("/deadlines");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting deadline");
  }
});

app.get("/analytics", requireAuth, async (req, res) => {
  try {
    const noteCount = await Note.countDocuments({ user: req.user.name });
    const userDoc = await User.findOne({ name: req.user.name });
    const aiCount = userDoc ? (userDoc.aiUsageCount || 0) : 0;
    res.render("analytics", { user: req.user.name, noteCount: noteCount, aiCount: aiCount });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching analytics");
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

app.post("/add-note", requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;

    // check if note already exists for this user + title
    let existingNote = await Note.findOne({
      user: req.user.name,
      title: title
    });

    if (existingNote) {
      // UPDATE
      existingNote.content = content;
      await existingNote.save();
    } else {
      // CREATE
      const newNote = new Note({
        user: req.user.name,
        title: title,
        content: content
      });
      await newNote.save();
    }

    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving note");
  }
});

app.post("/upload-pdf", requireAuth, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    // Extract text from PDF
    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    const extractedText = pdfData.text;
    await parser.destroy();

    // Determine title
    let title = req.body.title && req.body.title.trim() !== "" 
      ? req.body.title 
      : req.file.originalname;

    // Create note
    const newNote = new Note({
      user: req.user.name,
      title: title,
      content: extractedText
    });
    await newNote.save();

    res.redirect("/dashboard");
  } catch (error) {
    console.error("PDF Upload Error:", error);
    res.status(500).send("Error processing PDF");
  }
});


app.post("/api/ai", requireAuth, async (req, res) => {
  try {
    await User.updateOne({ name: req.user.name }, { $inc: { aiUsageCount: 1 } });
    
    const { action, content, question, language } = req.body;
    
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
        return res.status(400).json({ error: "Please configure your Gemini API Key in server.js" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let prompt = "";

    if (action === "summarize") {
        prompt = `Summarize the following note clearly and concisely:\n\n${content}`;
    } else if (action === "translate") {
        prompt = `Translate the following note into ${language}:\n\n${content}`;
    } else if (action === "ask") {
        prompt = `Based on the following note, answer the question.\n\nNote:\n${content}\n\nQuestion:\n${question}`;
    }else if (action === "quiz") {
    prompt = `
    Generate 10 multiple choice questions (MCQs) from the following notes.

    Rules:
    - Each question must have 4 options (A, B, C, D)
    - Only one correct answer
    - Clearly mention correct answer
    - Keep it simple

    Notes:
    ${content}
    `;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ result: response.text() });
  } catch (error) {
    console.error("AI Error details:", error.message);
    res.status(500).json({ error: error.message || "Failed to process AI request. Check your API key and network." });
  }
});

// ── Share Note Routes ──
app.get("/shared/:id", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).send("Note not found or has been removed.");
    }
    res.render("shared-note", { note });
  } catch (error) {
    console.error(error);
    res.status(404).send("Note not found.");
  }
});

app.get("/api/share-link/:id", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    const shareUrl = `${req.protocol}://${req.get("host")}/shared/${note._id}`;
    res.json({ shareUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error generating share link" });
  }
});

app.use((req, res) => {
  res.status(404).send("Page Not Found");
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});