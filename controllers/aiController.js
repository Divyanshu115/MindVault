const User = require("../models/User");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFParse } = require("pdf-parse");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

exports.getAnalytics = async (req, res) => {
  try {
    const Note = require("../models/Note");
    const noteCount = await Note.countDocuments({ user: req.user.name });
    const userDoc = await User.findOne({ name: req.user.name });
    const aiCount = userDoc ? (userDoc.aiUsageCount || 0) : 0;
    res.render("analytics", { user: req.user.name, noteCount: noteCount, aiCount: aiCount });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching analytics");
  }
};

exports.postAiAction = async (req, res) => {
  try {
    await User.updateOne({ name: req.user.name }, { $inc: { aiUsageCount: 1 } });

    const { action, content, question, language } = req.body;

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" || !GEMINI_API_KEY) {
      return res.status(400).json({ error: "Please configure your Gemini API Key" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let prompt = "";

    if (action === "summarize") {
      prompt = `Summarize the following note clearly and concisely:\n\n${content}`;
    } else if (action === "translate") {
      prompt = `Translate the following note into ${language}:\n\n${content}`;
    } else if (action === "ask") {
      prompt = `Based on the following note, answer the question.\n\nNote:\n${content}\n\nQuestion:\n${question}`;
    } else if (action === "quiz") {
      prompt = `Generate 10 multiple choice questions (MCQs) from the following notes.\n\nRules:\n- Each question must have 4 options (A, B, C, D)\n- Only one correct answer\n- Clearly mention correct answer\n- Keep it simple\n\nNotes:\n${content}`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ result: response.text() });
  } catch (error) {
    console.error("AI Error details:", error.message);
    res.status(500).json({ error: error.message || "Failed to process AI request." });
  }
};

exports.getSyllabus = (req, res) => {
  res.render("syllabus", { user: req.user.name });
};

exports.postSyllabusNotes = async (req, res) => {
  try {
    await User.updateOne({ name: req.user.name }, { $inc: { aiUsageCount: 1 } });

    const { syllabusText } = req.body;
    if (!syllabusText || syllabusText.trim().length === 0) {
      return res.status(400).json({ error: "Please provide syllabus text." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert academic tutor. Based on the following syllabus, generate comprehensive yet concise short notes that a student can use for exam revision.

Rules:
- Cover every topic mentioned in the syllabus
- Use clear headings (## for units/modules, ### for sub-topics)
- Write short, crisp definitions and key points using bullet points
- Highlight important formulas, theorems, or concepts in bold
- Keep the language simple and exam-oriented
- Add memory tips or mnemonics where helpful
- If the syllabus mentions "Introduction to AI", cover basic concepts like:
  - What is AI?
  - Types of AI (narrow, general, super)
  - History of AI
  - Applications of AI
  - Ethical considerations
  - Relation to Machine Learning
-Not more than 500 words

Syllabus:
${syllabusText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ result: response.text() });
  } catch (error) {
    console.error("Syllabus Notes Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate syllabus notes." });
  }
};

exports.postSyllabusNotesPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded." });
    }

    await User.updateOne({ name: req.user.name }, { $inc: { aiUsageCount: 1 } });

    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    const extractedText = pdfData.text;
    await parser.destroy();

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from the PDF. Please try pasting the syllabus text instead." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert academic tutor. Based on the following syllabus extracted from a PDF, generate comprehensive yet concise short notes that a student can use for exam revision.

Rules:
- Cover every topic mentioned in the syllabus
- Use clear headings (## for units/modules, ### for sub-topics)
- Write short, crisp definitions and key points using bullet points
- Highlight important formulas, theorems, or concepts in bold
- Keep the language simple and exam-oriented
- Add memory tips or mnemonics where helpful
- If the syllabus mentions "Introduction to AI", cover basic concepts like:
  - What is AI?
  - Types of AI (narrow, general, super)
  - History of AI
  - Applications of AI
  - Ethical considerations
  - Relation to Machine Learning
-Not more than 500 words

Syllabus:
${extractedText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ result: response.text() });
  } catch (error) {
    console.error("Syllabus PDF Notes Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate syllabus notes from PDF." });
  }
};

// I'll use the full prompts from server.js to ensure functionality is identical.
