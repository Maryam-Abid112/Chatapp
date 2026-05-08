const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        isGroup: {
            type: Boolean,
            default: false
        },

        chatName: {
            type: String,
            default: "private chat"
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        },

        unreadCounts: {
            type: Map,
            of: Number,
            default: {}
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);