const mongoose = require("mongoose");
const Chat = require("../models/Chats");
const Message = require("../models/Messages");
const User = require("../models/User");

exports.getmessages = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);   // from JWT middleware
  const { chatid } = req.params;

  try {
    const chat = await Chat.findById(chatid);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // security check
    if (!chat.members.some((member) => member.equals(userId))) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const messages = await Message.find({ chatId: new mongoose.Types.ObjectId(chatid) }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getchats = async (req, res) => {
  const userId = req.user._id;

  try {
    const chats = await Chat.find({
      members: userId
    })
      .populate("members", "name email")
      .sort({ createdAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.accessChat = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id); // logged-in user
  const { userId: otherUserId } = req.body;
  const otherObjectId = new mongoose.Types.ObjectId(otherUserId);

  try {
    let chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [userId, otherObjectId] }
    }).populate("members", "name email");

    if (!chat) {
      const otherUser = await User.findById(otherObjectId).select("name");
      chat = await Chat.create({
        members: [userId, otherObjectId],
        chatName: otherUser?.name || "private chat",
      });

      chat = await Chat.findById(chat._id).populate("members", "name email");
    }

    res.json(chat);
  } catch (err) {
      res.status(500).json({ message: err.message });
    }
};


exports.createGroupChat = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const { name, users } = req.body; 
  // users = array of userIds (NOT including creator necessarily)

  try {
    if (!name || !users || users.length < 2) {
      return res.status(400).json({
        message: "Group must have a name and at least 2 users",
      });
    }

    // include creator in group automatically
    const members = [
      userId,
      ...users.map((id) => new mongoose.Types.ObjectId(id)),
    ];

    // optional: prevent duplicate group with same members + name
    let group = await Chat.findOne({
      isGroup: true,
      chatName: name,
      members: { $all: members },
    }).populate("members", "name email");

    if (!group) {
      group = await Chat.create({
        chatName: name,
        members,
        isGroup: true,
      });

      group = await Chat.findById(group._id).populate(
        "members",
        "name email"
      );
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
