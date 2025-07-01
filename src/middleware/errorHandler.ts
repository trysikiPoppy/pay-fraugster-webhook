import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const globalErrorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";

  logger.error("Global error handler triggered", {
    event: "global_error",
    error_message: error.message,
    error_stack: error.stack,
    status_code: error.statusCode,
    request_url: req.url,
    request_method: req.method,
    request_ip: req.ip,
    request_headers: {
      user_agent: req.get("User-Agent"),
      content_type: req.get("Content-Type"),
      content_length: req.get("Content-Length"),
    },
    timestamp: new Date().toISOString(),
  });

  if (process.env.NODE_ENV === "production") {
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  } else {
    res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      stack: error.stack,
    });
  }
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.warn("Route not found", {
    event: "route_not_found",
    url: req.url,
    method: req.method,
    ip: req.ip,
    user_agent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  const error: CustomError = new Error(`Route ${req.url} not found`);
  error.statusCode = 404;
  error.status = "fail";
  error.isOperational = true;

  next(error);
};

export const asyncErrorCatcher = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
