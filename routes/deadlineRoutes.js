const express = require("express");
const router = express.Router();
const deadlineController = require("../controllers/deadlineController");
const { requireAuth } = require("../middleware/auth");

router.get("/deadlines", requireAuth, deadlineController.getDeadlines);
router.post("/add-deadline", requireAuth, deadlineController.postAddDeadline);
router.post("/delete-deadline", requireAuth, deadlineController.postDeleteDeadline);

module.exports = router;
