const mongoose = require("mongoose");

const trackingEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

trackingEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("TrackingEvent", trackingEventSchema);
