const jwt = require("jsonwebtoken");

const socketAuth = (socket, next) => {
   const token = socket.handshake.auth.token;

   if (!token) {
      return next(new Error("Unauthorized"));
   }
   try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded.id;   // attach user id
      next();
   } catch (error) {
      next(new Error("Invalid Token"));
   }
};

module.exports = socketAuth;