import { Router } from "express"
import { z } from "zod"
import { asyncHandler } from "../lib/asyncHandler.js"
import { validateQuery } from "../middleware/validate.js"
import { getPlatformAvailability } from "../services/platformsService.js"

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export const platformsRouter = Router()

platformsRouter.get(
  "/availability",
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const { lat, lng } = res.locals.query as z.infer<typeof querySchema>
    const availability = await getPlatformAvailability(lat, lng)
    res.json({ availability })
  }),
)
