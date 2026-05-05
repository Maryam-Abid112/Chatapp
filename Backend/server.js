const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB= require("./config/db");
const dotenv = require("dotenv");
const userroute=require("./routes/Userroutes");
const socketauth=require("./middleauth/socketauth");
const sockethadler =require("./socket/sockethandler");
const chatroute =require("./routes/chatroutes");


dotenv.config();
const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// defining routes for the api
app.use("/api/Users",userroute);
app.use("/api/Chats",chatroute);

app.get("/", (req, res) => {
  res.send("API Running...");
});

// creating http server
const server = http.createServer(app);

//creating  socket io server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",// to connect to the react frontend 
    methods: ["GET", "POST"]
  }
});

// checking that whether the token expired or not and assigning it the user id
io.use(socketauth);
// passing the connnection to socket handler to work on it 
sockethadler(io);




server.listen(5001, () => {
  console.log("Server running on port 5001");
});