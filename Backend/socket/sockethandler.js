const Message = require("../models/Messages");
const Chat = require("../models/Chats");


// object for the online users 
const onlineUsers = {};




const socketHandler = (io) => {


   io.on("connection", (socket) => {

      onlineUsers[socket.user] = socket.id;

      console.log("User connected");
     
      // join chat room 
      socket.on("join_chat", (chatId) => {
      socket.join(chatId);
    });


      // now sending the messages
      socket.on("send_messages", async ({ chatId, text }) => {
      try {
        // save message
        const newMessage = await Message.create({
          sender: socket.user,
          chatId: chatId,
          text: text
        });

        // update last message
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: newMessage._id
        });

        // populate sender
        const fullMessage = await Message.findById(newMessage._id)
          .populate("sender", "name email");

        // 🔥 emit to room
        io.to(chatId).emit("receive_message", fullMessage);

      } catch (err) {
        console.log("Socket error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      delete onlineUsers[socket.user];
      console.log("User disconnected");
    });
  });





};

module.exports = socketHandler;