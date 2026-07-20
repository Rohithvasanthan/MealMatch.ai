import { Router } from "express"
import { compareRouter } from "./compare.js"
import { foodsRouter } from "./foods.js"
import { locationRouter } from "./location.js"
import { platformsRouter } from "./platforms.js"

export const apiRouter = Router()

apiRouter.use("/location", locationRouter)
apiRouter.use("/platforms", platformsRouter)
apiRouter.use("/foods", foodsRouter)
apiRouter.use("/compare", compareRouter)
