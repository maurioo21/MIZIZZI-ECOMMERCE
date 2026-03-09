"""
Cache Management Routes
Admin endpoints for viewing and managing cache invalidation
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import logging
from sqlalchemy import desc, select
from datetime import datetime

# Import cache service and models
from app.services.cache_invalidation_service import (
    CacheInvalidationService,
    RateLimitError,
    InvalidPatternError,
    rate_limit_cache_operations,
)
from app.config.cache_groups import (
    CACHE_GROUPS,
    CACHE_PATTERNS,
    get_cache_group_patterns,
)

logger = logging.getLogger(__name__)

# Create blueprint
cache_management_bp = Blueprint(
    "cache_management",
    __name__
)


def admin_required(f):
    """Decorator to ensure admin access"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            from app.models.models import User
            
            admin_id = get_jwt_identity()
            if not admin_id:
                return jsonify({"error": "Unauthorized"}), 401

            user = User.query.get(admin_id)
            if not user or not hasattr(user, 'is_active') or not user.is_active:
                return jsonify({"error": "User not found or inactive"}), 404

            # Store admin info in g for logging
            g.admin_id = user.id
            g.admin_name = user.name if hasattr(user, 'name') else "Unknown"
            
            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Admin check failed: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401

    return decorated_function


def get_redis_connection():
    """Get Redis connection from app context"""
    try:
        # Try to get redis_client from app.utils.redis_cache
        from app.utils.redis_cache import redis_cache
        return redis_cache
    except:
        pass
    
    try:
        # Fallback: try to get redis client from cache module
        from app.cache.redis_client import redis_client
        return redis_client
    except:
        pass
    
    try:
        # Last resort: try configuration.extensions (though it may not have redis_cache)
        from app.configuration.extensions import redis_cache
        return redis_cache
    except:
        return None


def get_timestamp():
    """Get current timestamp as ISO format string"""
    return datetime.utcnow().isoformat() if hasattr(datetime, 'utcnow') else datetime.now().isoformat()


@cache_management_bp.route("/status", methods=["GET"])
@admin_required
def get_cache_status():
    """
    GET /api/admin/cache/status
    Get current cache status and metrics
    """
    try:
        redis_conn = get_redis_connection()
        service = CacheInvalidationService(redis_conn)
        
        status = service.get_status()
        status["last_updated"] = get_timestamp()

        return jsonify(status), 200

    except Exception as e:
        logger.error(f"Error getting cache status: {str(e)}")
        return jsonify({
            "error": "Failed to get cache status",
            "message": str(e)
        }), 500


@cache_management_bp.route("/invalidate", methods=["POST"])
@admin_required
@rate_limit_cache_operations
def invalidate_single_cache():
    """
    POST /api/admin/cache/invalidate
    Invalidate a single cache pattern
    
    Request body:
    {
        "pattern": "mizizzi:carousel:*"
    }
    """
    try:
        data = request.get_json()
        pattern = data.get("pattern")

        if not pattern:
            return jsonify({"error": "Pattern is required"}), 400

        redis_conn = get_redis_connection()
        service = CacheInvalidationService(redis_conn)

        success, deleted_count, message = service.invalidate_single_pattern(pattern)

        # Log the operation (after successful Redis operation)
        CacheInvalidationService.log_invalidation(
            admin_id=g.get("admin_id"),
            admin_name=g.get("admin_name"),
            action="invalidate_single",
            cache_groups=[pattern],
            redis_patterns=[pattern],
            keys_deleted=deleted_count,
            status="success" if success else "failed",
            error_message=message if not success else None,
        )

        if not success:
            return jsonify({
                "success": False,
                "message": message,
                "deleted_count": 0,
            }), 400

        return jsonify({
            "success": True,
            "message": message,
            "deleted_count": deleted_count,
            "affected_groups": [pattern],
            "timestamp": get_timestamp(),
        }), 200

    except RateLimitError as e:
        return jsonify({
            "error": "Rate limit exceeded",
            "message": str(e)
        }), 429

    except InvalidPatternError as e:
        return jsonify({
            "error": "Invalid pattern",
            "message": str(e)
        }), 400

    except Exception as e:
        logger.error(f"Error invalidating cache: {str(e)}")
        return jsonify({
            "error": "Failed to invalidate cache",
            "message": str(e)
        }), 500


@cache_management_bp.route("/invalidate-group", methods=["POST"])
@admin_required
@rate_limit_cache_operations
def invalidate_cache_group():
    """
    POST /api/admin/cache/invalidate-group
    Invalidate a cache group (critical, deferred, homepage, or all)
    
    Request body:
    {
        "group": "critical"
    }
    """
    try:
        data = request.get_json()
        group = data.get("group")

        if not group or group not in CACHE_GROUPS:
            valid_groups = list(CACHE_GROUPS.keys()) + ["all"]
            return jsonify({
                "error": "Invalid cache group",
                "valid_groups": valid_groups
            }), 400

        redis_conn = get_redis_connection()
        service = CacheInvalidationService(redis_conn)

        success, result = service.invalidate_group(group)

        # Log the operation
        from datetime import datetime
        CacheInvalidationService.log_invalidation(
            admin_id=g.get("admin_id"),
            admin_name=g.get("admin_name"),
            action="invalidate_group",
            cache_groups=[group],
            redis_patterns=result.get("patterns", []),
            keys_deleted=result.get("deleted_count", 0),
            status=result.get("status", "success"),
            error_message=result.get("error") if not success else None,
        )

        if not success:
            return jsonify({
                "success": False,
                "message": result.get("message"),
                "error": result.get("error"),
            }), 400

        return jsonify({
            "success": True,
            "message": result.get("message"),
            "deleted_count": result.get("deleted_count"),
            "affected_groups": [group],
            "timestamp": get_timestamp(),
        }), 200

    except RateLimitError as e:
        return jsonify({
            "error": "Rate limit exceeded",
            "message": str(e)
        }), 429

    except Exception as e:
        logger.error(f"Error invalidating cache group: {str(e)}")
        return jsonify({
            "error": "Failed to invalidate cache group",
            "message": str(e)
        }), 500


@cache_management_bp.route("/invalidate-all", methods=["POST"])
@admin_required
@rate_limit_cache_operations
def invalidate_all_caches():
    """
    POST /api/admin/cache/invalidate-all
    Invalidate ALL caches (requires confirmation)
    
    Request body:
    {
        "confirmed": true
    }
    """
    try:
        data = request.get_json()
        confirmed = data.get("confirmed", False)

        if not confirmed:
            return jsonify({
                "error": "Confirmation required",
                "message": "This action requires explicit confirmation (confirmed: true)"
            }), 400

        redis_conn = get_redis_connection()
        service = CacheInvalidationService(redis_conn)

        success, result = service.invalidate_all()

        # Log the operation
        from datetime import datetime
        CacheInvalidationService.log_invalidation(
            admin_id=g.get("admin_id"),
            admin_name=g.get("admin_name"),
            action="invalidate_all",
            cache_groups=list(CACHE_GROUPS.keys()),
            redis_patterns=sum(
                [group_info["patterns"] for group_info in CACHE_GROUPS.values()],
                []
            ),
            keys_deleted=result.get("total_deleted", 0),
            status="success" if success else "failed",
            error_message=result.get("error") if not success else None,
        )

        if not success:
            return jsonify({
                "success": False,
                "message": result.get("message"),
                "error": result.get("error"),
            }), 500

        return jsonify({
            "success": True,
            "message": result.get("message"),
            "deleted_count": result.get("total_deleted"),
            "affected_groups": list(CACHE_GROUPS.keys()),
            "timestamp": get_timestamp(),
        }), 200

    except RateLimitError as e:
        return jsonify({
            "error": "Rate limit exceeded",
            "message": str(e)
        }), 429

    except Exception as e:
        logger.error(f"Error invalidating all caches: {str(e)}")
        return jsonify({
            "error": "Failed to invalidate all caches",
            "message": str(e)
        }), 500


@cache_management_bp.route("/rebuild", methods=["POST"])
@admin_required
def rebuild_caches():
    """
    POST /api/admin/cache/rebuild
    Rebuild cache data from database
    
    Request body:
    {
        "force": false
    }
    """
    try:
        data = request.get_json() or {}
        force = data.get("force", False)

        redis_conn = get_redis_connection()
        service = CacheInvalidationService(redis_conn)

        success, result = service.rebuild_caches()

        # Log the operation
        from datetime import datetime
        CacheInvalidationService.log_invalidation(
            admin_id=g.get("admin_id"),
            admin_name=g.get("admin_name"),
            action="rebuild",
            cache_groups=result.get("rebuilt_services", []),
            redis_patterns=[],
            keys_deleted=0,
            status="success" if success else "failed",
            error_message=result.get("error") if not success else None,
        )

        if not success:
            return jsonify({
                "success": False,
                "message": result.get("message"),
                "error": result.get("error"),
            }), 500

        return jsonify({
            "success": True,
            "message": result.get("message"),
            "rebuilt_services": result.get("rebuilt_services", []),
            "timestamp": get_timestamp(),
        }), 200

    except Exception as e:
        logger.error(f"Error rebuilding caches: {str(e)}")
        return jsonify({
            "error": "Failed to rebuild caches",
            "message": str(e)
        }), 500


@cache_management_bp.route("/history", methods=["GET"])
@admin_required
def get_invalidation_history():
    """
    GET /api/admin/cache/history?page=1&per_page=50
    Get cache invalidation history/audit log
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        # Ensure reasonable limits
        page = max(1, page)
        per_page = min(per_page, 100)

        from app.models.cache_invalidation_log import CacheInvalidationLog
        from app.configuration.extensions import db

        # Use SQLAlchemy 2.0+ session syntax
        stmt = select(CacheInvalidationLog).order_by(desc(CacheInvalidationLog.created_at))
        
        # Get total count
        total_stmt = select(db.func.count()).select_from(CacheInvalidationLog)
        total = db.session.execute(total_stmt).scalar()
        
        # Get paginated results
        offset = (page - 1) * per_page
        results = db.session.execute(stmt.offset(offset).limit(per_page)).scalars().all()

        return jsonify({
            "items": [log.to_dict() for log in results],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }), 200

    except ImportError:
        # Model not available, return empty history
        return jsonify({
            "items": [],
            "total": 0,
            "page": 1,
            "per_page": 50,
            "pages": 0,
        }), 200

    except Exception as e:
        logger.error(f"Error getting invalidation history: {str(e)}")
        return jsonify({
            "error": "Failed to get invalidation history",
            "message": str(e)
        }), 500


# Register blueprint with app
def init_cache_management_routes(app):
    """Initialize cache management routes with Flask app"""
    app.register_blueprint(cache_management_bp)
    logger.info("Cache management routes registered")
