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
    platformFee: { type: Number },
    packingFee: { type: Number },
    originalPrice: { type: Number },
    offerText: { type: String },
    distanceKm: { type: Number },
    imageUrl: { type: String },
    itemUrl: { type: String },
  },
  { _id: false },
)

const PLATFORMS = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]

const PlatformResultSchema = new Schema(
  {
    platform: { type: String, enum: PLATFORMS, required: true },
    availability: { type: String, enum: ["available", "not_serviceable", "error"], required: true },
    items: { type: [MenuItemSchema], default: [] },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  { _id: false },
)

const BestDealSchema = new Schema(
  {
    winner: { type: String, enum: PLATFORMS, required: true },
    reasoning: { type: String, required: true },
  },
  { _id: false },
)

const ComparisonCacheSchema = new Schema({
  cacheKey: { type: String, required: true, unique: true },
  query: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  results: { type: [PlatformResultSchema], default: [] },
  bestDeal: { type: BestDealSchema, default: null },
  createdAt: { type: Date, default: Date.now, expires: "10m" },
})

export const ComparisonCache = model("ComparisonCache", ComparisonCacheSchema)
