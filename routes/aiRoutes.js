const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/analytics", requireAuth, aiController.getAnalytics);
router.post("/api/ai", requireAuth, aiController.postAiAction);
router.get("/syllabus", requireAuth, aiController.getSyllabus);
router.post("/api/syllabus-notes", requireAuth, aiController.postSyllabusNotes);
router.post("/api/syllabus-notes-pdf", requireAuth, upload.single("pdf"), aiController.postSyllabusNotesPdf);

module.exports = router;
