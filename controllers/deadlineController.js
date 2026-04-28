const Deadline = require("../models/Deadline");

exports.getDeadlines = async (req, res) => {
  try {
    const userDeadlines = await Deadline.find({ user: req.user.name }).sort({ dueDate: 1 });
    res.render("deadlines", { user: req.user.name, deadlines: userDeadlines });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching deadlines");
  }
};

exports.postAddDeadline = async (req, res) => {
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
};

exports.postDeleteDeadline = async (req, res) => {
  try {
    const { id } = req.body;
    await Deadline.findByIdAndDelete(id);
    res.redirect("/deadlines");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting deadline");
  }
};
