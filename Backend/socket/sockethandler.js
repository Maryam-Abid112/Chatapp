const Message = require("../models/Messages");
const Chat = require("../models/Chats");


// object for the online users 
const onlineUsers = {};




const socketHandler = (io) => {


   io.on("connection", (socket) => {

          io.emit("online_users",onlineUsers);

      onlineUsers[socket.user] = socket.id;

      console.log("User connected");

      // used for showing the typing status of the user to the other users in the same chat
      socket.on("typing", (chatId) => {
         socket.to(chatId).emit("typing",{ user: socket.user });});

      //used for showing the stop typing status of the user to the other users in the same chat
      socket.on("stop_typing", (chatId) => {
         socket.to(chatId).emit("stop_typing", { user: socket.user });});

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
       // for checking whether the user is online or not and sending the online users to the frontend
          io.emit("online_users",onlineUsers);
      delete onlineUsers[socket.user];
      console.log("User disconnected");
    });
  });





};

module.exports = socketHandler;