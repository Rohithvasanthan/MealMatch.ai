import { Router } from "express"
import { z } from "zod"
import { asyncHandler } from "../lib/asyncHandler.js"
import { validateBody } from "../middleware/validate.js"
import { compare } from "../services/compareService.js"

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  query: z.string().trim().min(1).max(100),
})

export const compareRouter = Router()

compareRouter.post(
  "/",
  validateBody(bodySchema),
  asyncHandler(async (req, res) => {
    const { lat, lng, query } = req.body as z.infer<typeof bodySchema>
    const result = await compare(query, lat, lng)
    res.json(result)
  }),
)
