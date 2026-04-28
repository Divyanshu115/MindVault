const Note = require("../models/Note");
const { PDFParse } = require("pdf-parse");

exports.getDashboard = async (req, res) => {
  try {
    const userNotes = await Note.find({ user: req.user.name });
    res.render("dashboard", { user: req.user.name, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
};

exports.getAllNotes = async (req, res) => {
  try {
    const userNotes = await Note.find({ user: req.user.name });
    res.render("all-notes", { user: req.user.name, notes: userNotes });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching notes");
  }
};

exports.postAddNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    let existingNote = await Note.findOne({
      user: req.user.name,
      title: title
    });

    if (existingNote) {
      existingNote.content = content;
      await existingNote.save();
    } else {
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
};

exports.postDeleteNote = async (req, res) => {
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
};

exports.postUploadPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    const extractedText = pdfData.text;
    await parser.destroy();

    let title = req.body.title && req.body.title.trim() !== ""
      ? req.body.title
      : req.file.originalname;

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
};

exports.getSharedNote = async (req, res) => {
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
};

exports.getShareLink = async (req, res) => {
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
};
