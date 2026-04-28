const mongoose = require("mongoose");

const deadlineSchema = new mongoose.Schema({
  user: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  dueDate: { type: Date, required: true }
});

module.exports = mongoose.model("Deadline", deadlineSchema);
