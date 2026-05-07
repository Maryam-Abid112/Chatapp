const express = require("express");
const router = express.Router();

const {getchats , getmessages, accessChat,createGroupChat}=require("../controller/chatController");
const protect =require("../middleauth/userauth");

router.get("/getchats", protect, getchats);
router.get("/getmessages/:chatid", protect, getmessages);
router.post("/accesschat", protect, accessChat);
router.post("/creategroup", protect, createGroupChat);
module.exports = router;
