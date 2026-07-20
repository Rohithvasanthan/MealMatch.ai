import { Schema, model } from "mongoose"

const MenuItemSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    restaurantName: { type: String, required: true },
    restaurantId: { type: String, required: true },
    price: { type: Number, required: true },
    rating: { type: Number },
    etaMinutes: { type: Number },
    deliveryFee: { type: Number },
    imageUrl: { type: String },
  },
  { _id: false },
)

const PlatformResultSchema = new Schema(
  {
    platform: { type: String, enum: ["swiggy", "zomato"], required: true },
    availability: { type: String, enum: ["available", "not_serviceable", "error"], required: true },
    items: { type: [MenuItemSchema], default: [] },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  { _id: false },
)

const ComparisonCacheSchema = new Schema({
  cacheKey: { type: String, required: true, unique: true },
  query: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  results: { type: [PlatformResultSchema], default: [] },
  createdAt: { type: Date, default: Date.now, expires: "10m" },
})

export const ComparisonCache = model("ComparisonCache", ComparisonCacheSchema)
