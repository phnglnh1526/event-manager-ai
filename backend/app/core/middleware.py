import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("api.performance")


class PerformanceTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        
        response = await call_next(request)
        
        process_time_ms = (time.perf_counter() - start_time) * 1000
        path = request.url.path
        method = request.method
        status_code = response.status_code

        # Add header for frontend/debugging visibility
        response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"

        # Log format: METHOD PATH → {ms}ms [status]
        # Only log API endpoints to keep logs clean
        if path.startswith("/api"):
            if process_time_ms > 3000:
                logger.error(
                    "CRITICAL: %s %s → %.0fms [%d]",
                    method,
                    path,
                    process_time_ms,
                    status_code,
                )
            elif process_time_ms > 1000:
                logger.warning(
                    "VERY SLOW: %s %s → %.0fms [%d]",
                    method,
                    path,
                    process_time_ms,
                    status_code,
                )
            elif process_time_ms > 500:
                logger.warning(
                    "SLOW: %s %s → %.0fms [%d]",
                    method,
                    path,
                    process_time_ms,
                    status_code,
                )
            else:
                logger.info(
                    "%s %s → %.0fms [%d]",
                    method,
                    path,
                    process_time_ms,
                    status_code,
                )

        return response
