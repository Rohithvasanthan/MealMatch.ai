import { Router } from "express"
import { z } from "zod"
import { asyncHandler } from "../lib/asyncHandler.js"
import { validateQuery } from "../middleware/validate.js"
import { reverseGeocode } from "../services/geocodingService.js"

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export const locationRouter = Router()

locationRouter.get(
  "/resolve",
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const { lat, lng } = res.locals.query as z.infer<typeof querySchema>
    const location = await reverseGeocode(lat, lng)
    res.json(location)
  }),
)
