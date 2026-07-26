import { Schema, model } from "mongoose"

const PlatformAvailabilitySchema = new Schema(
  {
    platform: {
      type: String,
      enum: ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"],
      required: true,
    },
    available: { type: Boolean, required: true },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  { _id: false },
)

const PlatformAvailabilityCacheSchema = new Schema({
  cacheKey: { type: String, required: true, unique: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  availability: { type: [PlatformAvailabilitySchema], default: [] },
  // Short TTL: this backs the "Live provider status" strip shown on every
  // page load, so it needs to stay reasonably fresh (unlike the 10m/45m
  // TTLs on comparison/suggested-foods results) while still absorbing the
  // repeat-load cost of a full live-scrape sweep across all 7 platforms.
  createdAt: { type: Date, default: Date.now, expires: "3m" },
})

export const PlatformAvailabilityCache = model("PlatformAvailabilityCache", PlatformAvailabilityCacheSchema)
