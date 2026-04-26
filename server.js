require("dotenv").config({ path: ".env.local" });
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

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
  email: { type: String, required: true },
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

const projectSchema = new mongoose.Schema({
  user: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, default: 'Planning' },
  color: { type: String, default: '#8b5cf6' },
  notes: [{ type: String }] // Array of note titles
});
const Project = mongoose.model("Project", projectSchema);

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Required for parsing JSON bodies from AI fetch requests

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
    const { name, email, password } = req.body;
    
    const newUser = new User({ name, email, password });
    await newUser.save();
    
    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).render("register", { error: "Error registering user" });
  }
})

let currentUser = "";

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email: email, password: password });

    if (user) {
      currentUser = user.name;
      res.redirect("/dashboard");
    } else {
      res.render("login", { error: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).render("login", { error: "Error logging in" });
  }
})

app.post("/delete-note", async (req, res) => {
  try {
    const { title } = req.body;

    await Note.deleteOne({
      user: currentUser,
      title: title
    });

    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting note");
  }
});

app.get("/dashboard", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const userNotes = await Note.find({ user: currentUser });
    res.render("dashboard", { user: currentUser, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
})

app.get("/all-notes", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const userNotes = await Note.find({ user: currentUser });
    res.render("all-notes", { user: currentUser, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
})

app.get("/projects", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const userProjects = await Project.find({ user: currentUser });
    const userNotes = await Note.find({ user: currentUser });
    res.render("projects", { user: currentUser, projects: userProjects, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching projects");
  }
});

app.post("/create-project", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const { name, description, color } = req.body;
    const newProject = new Project({
      user: currentUser,
      name,
      description,
      color: color || '#8b5cf6'
    });
    await newProject.save();
    res.redirect("/projects");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating project");
  }
});

app.post("/delete-project", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const { id } = req.body;
    await Project.findByIdAndDelete(id);
    res.redirect("/projects");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting project");
  }
});

app.post("/link-note-to-project", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const { projectId, noteTitle } = req.body;
    const project = await Project.findById(projectId);
    if (project && !project.notes.includes(noteTitle)) {
        project.notes.push(noteTitle);
        await project.save();
    }
    res.redirect("/projects");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error linking note");
  }
});

app.get("/analytics", async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  try {
    const noteCount = await Note.countDocuments({ user: currentUser });
    const userDoc = await User.findOne({ name: currentUser });
    const aiCount = userDoc ? (userDoc.aiUsageCount || 0) : 0;
    res.render("analytics", { user: currentUser, noteCount: noteCount, aiCount: aiCount });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching analytics");
  }
})

app.get("/logout", (req, res) => {

  currentUser = "";

  res.redirect("/");

});

app.post("/add-note", async (req, res) => {
  try {
    const { title, content } = req.body;

    // check if note already exists for this user + title
    let existingNote = await Note.findOne({
      user: currentUser,
      title: title
    });

    if (existingNote) {
      // UPDATE
      existingNote.content = content;
      await existingNote.save();
    } else {
      // CREATE
      const newNote = new Note({
        user: currentUser,
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

app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  if (!currentUser) return res.redirect("/login");
  
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
      user: currentUser,
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


app.post("/api/ai", async (req, res) => {
  try {
    if (currentUser) {
        await User.updateOne({ name: currentUser }, { $inc: { aiUsageCount: 1 } });
    }
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
    } else if (action === "project-blueprint") {
        prompt = `
        You are an expert AI Project Manager. Analyze the following notes that belong to a single project and provide a synthesized "Executive Summary" and an "Action Plan" for next steps. Make it highly structured, using bold headings and bullet points.
        
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

app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});