const Message = require("../models/Messages");
const Chat = require("../models/Chats");


// object for the online users 
const onlineUsers = {};




const socketHandler = (io) => {


   io.on("connection", (socket) => {

        

      onlineUsers[socket.user] = socket.id;

      console.log("User connected");

      io.emit("online_users",onlineUsers);

      // used for showing the typing status of the user to the other users in the same chat
      socket.on("typing", (chatId) => {
         socket.to(chatId).emit("typing",{ chatId , userId: socket.user });});

      //used for showing the stop typing status of the user to the other users in the same chat
      socket.on("stop_typing", (chatId) => {
         socket.to(chatId).emit("stop_typing", { chatId, userId: socket.user });});

      // join chat room 
      socket.on("join_chat", async (chatId) => {
         socket.join(chatId);
         // Reset unread count for this user in this chat
         await Chat.findByIdAndUpdate(chatId, {
            $set: { [`unreadCounts.${socket.user}`]: 0 }
         });
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

        // Increment unread counts for other members
        const chat = await Chat.findById(chatId);
        const otherMembers = chat.members.filter(member => member.toString() !== socket.user.toString());
        const updateOps = {};
        otherMembers.forEach(member => {
          updateOps[`unreadCounts.${member}`] = (chat.unreadCounts.get(member.toString()) || 0) + 1;
        });
        await Chat.findByIdAndUpdate(chatId, { $set: updateOps });

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
       // for checking whether the user is online or not and sending the online users to the frontend
          io.emit("online_users",onlineUsers);
      console.log("User disconnected");
    });
  });





};

module.exports = socketHandler;