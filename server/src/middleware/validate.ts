import type { NextFunction, Request, Response } from "express"
import type { ZodType } from "zod"

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body)
    next()
  }
}

// Express 5's req.query is a getter with no setter, so the parsed
// (coerced/typed) query is stashed on res.locals instead of reassigned.
export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.query = schema.parse(req.query)
    next()
  }
}
