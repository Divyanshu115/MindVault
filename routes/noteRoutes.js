const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/dashboard", requireAuth, noteController.getDashboard);
router.get("/all-notes", requireAuth, noteController.getAllNotes);
router.post("/add-note", requireAuth, noteController.postAddNote);
router.post("/delete-note", requireAuth, noteController.postDeleteNote);
router.post("/upload-pdf", requireAuth, upload.single("pdf"), noteController.postUploadPdf);
router.get("/shared/:id", noteController.getSharedNote);
router.get("/api/share-link/:id", requireAuth, noteController.getShareLink);

module.exports = router;
