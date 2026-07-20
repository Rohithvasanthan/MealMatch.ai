import { Schema, model } from "mongoose"

const SuggestedItemSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    restaurantName: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String },
  },
  { _id: false },
)

const PlatformSuggestedSchema = new Schema(
  {
    platform: { type: String, enum: ["swiggy", "zomato"], required: true },
    availability: { type: String, enum: ["available", "not_serviceable", "error"], required: true },
    items: { type: [SuggestedItemSchema], default: [] },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  { _id: false },
)

const SuggestedFoodsCacheSchema = new Schema({
  cacheKey: { type: String, required: true, unique: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  results: { type: [PlatformSuggestedSchema], default: [] },
  createdAt: { type: Date, default: Date.now, expires: "45m" },
})

export const SuggestedFoodsCache = model("SuggestedFoodsCache", SuggestedFoodsCacheSchema)
