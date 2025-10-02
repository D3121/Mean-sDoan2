const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const app = express();
const port = 3000;
const multer = require("multer");
const fs = require("fs");
require("./db.js");


const uploadDir = path.join(__dirname, "public/images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");
  },
  filename: (req, file, cb) => {
    const cleanFileName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + cleanFileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ được upload file hình ảnh!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, default: "New User" },
  avatar: { type: String, default: "" },
  highScore: { type: Number, default: 0 },
});
const User = mongoose.model("User", userSchema);

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  type: {
    type: String,
    enum: ["true_false", "multiple_choice"],
    required: true,
  },
  options: [{ type: String, required: true }],
  correctAnswer: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        if (this.type === "true_false") {
          return v === "true" || v === "false";
        }
        if (this.type === "multiple_choice") {
          return v === "A" || v === "B" || v === "C" || v === "D";
        }
        return false;
      },
      message: "Đáp án đúng không hợp lệ!",
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});
const Question = mongoose.model("Question", questionSchema);

async function checkAccount(username, password) {
  const user = await User.findOne({ username, password });
  if (user) {
    return { success: true, userId: user._id };
  } else {
    return { success: false, message: "Sai username hoặc password" };
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await checkAccount(username, password);
    if (result.success) {
      res.json({ message: "Đăng nhập thành công", userId: result.userId });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username đã tồn tại" });
    }
    const newUser = new User({ username, password });
    await newUser.save();
    res.json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Lỗi server khi đăng ký" });
  }
});

app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }
    res.json({
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      highScore: user.highScore,
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: "Lỗi server khi lấy profile" });
  }
});

app.put("/api/profile/:userId", upload.single("avatar"), async (req, res) => {
  const { userId } = req.params;
  const { displayName, highScore } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }
    if (displayName) user.displayName = displayName;
    if (highScore !== undefined) user.highScore = highScore;
    if (req.file) {
      user.avatar = "/images/" + req.file.filename;
    }
    await user.save();
    res.json({ message: "Cập nhật hồ sơ thành công", user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Lỗi server khi cập nhật profile" });
  }
});

app.get("/api/questions", async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    console.error("Error loading questions:", err);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách câu hỏi" });
  }
});

app.get("/api/questions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi" });
    }
    res.json(question);
  } catch (err) {
    console.error("Error loading question:", err);
    res.status(500).json({ error: "Lỗi server khi lấy câu hỏi" });
  }
});

app.post("/api/questions", async (req, res) => {
  const { questionText, type, options, correctAnswer, createdBy } = req.body;
  console.log("Received payload:", req.body);
  try {
    const newQuestion = new Question({
      questionText,
      type,
      options,
      correctAnswer,
      createdBy,
    });
    await newQuestion.save();
    res.json({ message: "Thêm câu hỏi thành công!", question: newQuestion });
  } catch (err) {
    console.error("Error adding question:", err);
    res.status(500).json({ error: "Lỗi server khi thêm câu hỏi" });
  }
});

app.put("/api/questions/:id", async (req, res) => {
  const { id } = req.params;
  const { questionText, type, options, correctAnswer } = req.body;
  console.log("Update payload:", req.body);
  try {
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi" });
    }
    question.questionText = questionText;
    question.type = type;
    question.options = options;
    question.correctAnswer = correctAnswer;
    await question.save();
    res.json({ message: "Cập nhật câu hỏi thành công!", question });
  } catch (err) {
    console.error("Error updating question:", err);
    res.status(500).json({ error: "Lỗi server khi cập nhật câu hỏi" });
  }
});

app.get("/api/questions/:id", async (req, res) => {
  const { id } = req.params;
  // Kiểm tra id có phải ObjectId hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }
  try {
    const q = await Question.findById(id);
    if (!q) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi" });
    }
    res.json(q);
  } catch (err) {
    console.error("Error get question:", err);
    res.status(500).json({ error: "Lỗi server khi lấy câu hỏi" });
  }
});



// Route xóa câu hỏi
app.delete("/api/questions/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid question ID: ${id}`);
    return res.status(400).json({ error: "ID không hợp lệ" });
  }

  try {
    const deletedQuestion = await Question.findByIdAndDelete(id);

    if (!deletedQuestion) {
      console.warn(`Question not found for deletion. ID: ${id}`);
      return res.status(404).json({ error: "Không tìm thấy câu hỏi để xóa" });
    }

    console.log(`Question deleted successfully. ID: ${id}, Text: ${deletedQuestion.questionText}`);
    res.json({ message: "Xóa câu hỏi thành công!" });
  } catch (err) {
    console.error("Error while deleting question:", err);
    res.status(500).json({ error: "Lỗi server khi xóa câu hỏi" });
  }
});



app.get("/", (req, res) => {
  res.redirect("/login.html");
});


app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
