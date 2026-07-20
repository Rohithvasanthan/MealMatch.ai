import { Schema, model } from "mongoose"

const SearchHistorySchema = new Schema({
  query: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
})

export const SearchHistory = model("SearchHistory", SearchHistorySchema)
