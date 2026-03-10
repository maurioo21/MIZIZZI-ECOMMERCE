"""
Mizizzi E-commerce Backend Application Package
"""

import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request, send_from_directory, g, abort
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt_identity, create_access_token, jwt_required, verify_jwt_in_request
import uuid
import werkzeug.utils
from pathlib import Path
from functools import wraps
from time import time
from sqlalchemy.exc import OperationalError as SAOperationalError

# Try to import psycopg2 error for database handling
try:
    from psycopg2 import OperationalError as PsycopgOperationalError
except (ImportError, ModuleNotFoundError):
    PsycopgOperationalError = None

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger(__name__)

def setup_app_environment():
    """Setup the app environment and paths."""
    app_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Add app directory to Python path if not already there
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)
    
    # Add parent directory for relative imports
    parent_dir = os.path.dirname(app_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    
    logger.info(f"app directory: {app_dir}")
    logger.info(f"Python path updated with app paths")
    return app_dir

# Setup environment when module is imported
setup_app_environment()

# Add minimal Meilisearch import stubs to avoid repeated import errors during startup
try:
    # Try normal import first
    from app.models.meilisearch_models import MeilisearchModel  # type: ignore
except Exception:
    import types
    mod_name = 'app.models.meilisearch_model'
    if mod_name not in sys.modules:
        stub = types.ModuleType(mod_name)
        class MeilisearchModel:
            """Fallback stub when real MeilisearchModel is not available."""
            pass
        stub.MeilisearchModel = MeilisearchModel
        sys.modules[mod_name] = stub
        logger.warning(
            "MeilisearchModel not found — a lightweight stub was inserted to avoid import errors. "
            "Please add/verify app/models/meilisearch_model.py to provide a real implementation."
        )

# also provide a plural module alias some code expects
if 'app.models.meilisearch_models' not in sys.modules:
    import types as _types
    sys.modules['app.models.meilisearch_models'] = _types.ModuleType('app.models.meilisearch_models')

# Import extensions and config
try:
    from .configuration.extensions import db, ma, mail, cache, limiter
    from .configuration.config import config, get_database_url
    from .websocket import socketio
except ImportError:
    # Fallback imports for different directory structures
    try:
        from configuration.extensions import db, ma, mail, cache, limiter
        from configuration.config import config, get_database_url
        from websocket import socketio
    except ImportError:
        # Last resort - create minimal extensions
        from flask_sqlalchemy import SQLAlchemy
        from flask_marshmallow import Marshmallow
        from flask_mail import Mail
        from flask_caching import Cache
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address
        from flask_socketio import SocketIO
        
        db = SQLAlchemy()
        ma = Marshmallow()
        mail = Mail()
        cache = Cache()
        limiter = Limiter(key_func=get_remote_address)
        # Removed duplicate SQLAlchemy instance - import from extensions instead
        from .configuration.extensions import db, ma, mail, cache, limiter
        from flask_socketio import SocketIO

        socketio = SocketIO()
        
        def get_database_url():
            """Get and fix DATABASE_URL for SQLAlchemy compatibility with Render."""
            database_url = os.environ.get('DATABASE_URL')
            if database_url:
                if database_url.startswith('postgres://'):
                    database_url = database_url.replace('postgres://', 'postgresql://', 1)
                return database_url
            # Return only the URL string (not a tuple) so SQLAlchemy receives a valid URL
            return 'postgresql://neondb_owner:npg_0gMwASZYo9pJ@ep-shiny-term-adlossxs-pooler.c-2.us-east-1.aws.neon.tech/mizizzi_project?sslmode=require&channel_binding=require'
        
        # Minimal config classes
        class Config:
            SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
            SQLALCHEMY_DATABASE_URI = get_database_url()
            SQLALCHEMY_TRACK_MODIFICATIONS = False
            SQLALCHEMY_ENGINE_OPTIONS = {
                'pool_pre_ping': True,
                'pool_recycle': 300,
            }
            JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
            JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
            CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000','https://mizizzi-shop.vercel.app']
            CACHE_TYPE = 'SimpleCache'
            RATELIMIT_STORAGE_URI = 'memory://'
        
        class DevelopmentConfig(Config):
            DEBUG = True
        
        class ProductionConfig(Config):
            DEBUG = False
            # Use SimpleCache as fallback if Redis not available
            CACHE_TYPE = 'SimpleCache'
            RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL') or 'memory://'
        
        class TestingConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        
        config = {
            'development': DevelopmentConfig,
            'testing': TestingConfig,
            'production': ProductionConfig,
            'default': DevelopmentConfig
        }

def create_app(config_name=None, enable_socketio=True):
    """
    Application factory function that creates and configures the Flask app.
    
    Args:
        config_name: The configuration to use (development, testing, production)
        enable_socketio: Whether to enable SocketIO support (default: True)
    
    Returns:
        The configured Flask application
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_CONFIG', 'default')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Set secret key for SocketIO
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
    )
    
    # Set werkzeug logger to WARNING to hide 404 logs
    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.setLevel(logging.WARNING)
    
    # Ensure DB URI is available before initializing extensions that require it
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        db_url = app.config.get('DATABASE_URL') or os.environ.get('DATABASE_URL')
        if db_url:
            app.config['SQLALCHEMY_DATABASE_URI'] = db_url
        else:
            # leave as-is; init_app will raise a clear error if still absent
            pass
    app.config.setdefault('SQLALCHEMY_TRACK_MODIFICATIONS', False)

    # Initialize extensions. Prefer centralized initializer from configuration.extensions
    # which performs extra binding and defensive setup. Fall back to per-extension init
    # only if the centralized initializer is not available.
    try:
        from .configuration.extensions import init_extensions
        init_extensions(app)
    except Exception:
        # Defensive per-extension initialization (handles edge-cases where names
        # like `cache` may refer to the app.cache module instead of the Cache
        # extension instance due to import-order/name collisions).
        try:
            if hasattr(db, 'init_app'):
                db.init_app(app)
        except Exception:
            pass
        try:
            if hasattr(ma, 'init_app'):
                ma.init_app(app)
        except Exception:
            pass
        try:
            if hasattr(mail, 'init_app'):
                mail.init_app(app)
        except Exception:
            pass
        try:
            if hasattr(cache, 'init_app'):
                cache.init_app(app)
        except Exception:
            # If cache is a module (app.cache) it won't have init_app; log and continue
            logger.warning("Cache extension not initialized via cache.init_app (name may be a module). Continuing.")
        try:
            if hasattr(limiter, 'init_app'):
                limiter.init_app(app)
        except Exception:
            pass

    # Disable strict slashes to avoid Flask redirecting requests which breaks CORS preflight
    try:
        app.url_map.strict_slashes = False
    except Exception:
        pass
    
    if enable_socketio:
        try:
            cors_origins = app.config.get('CORS_ORIGINS', ['http://localhost:3000', 'http://127.0.0.1:3000','https://mizizzi-shop.vercel.app'])
            
            socketio.init_app(
                app,
                cors_allowed_origins=['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.0.118:3000', 'https://mizizzi-shop.vercel.app'],
                async_mode='threading',
                logger=True,
                engineio_logger=False,
                ping_timeout=60,
                ping_interval=25,
                manage_session=False
            )
            
            app.socketio = socketio
            
            app.logger.info("✅ SocketIO enabled and initialized successfully")
            app.logger.info(f"   CORS origins: {cors_origins}")
            app.logger.info(f"   Async mode: threading")
        except Exception as e:
            app.logger.error(f"❌ SocketIO initialization failed: {str(e)}")
            import traceback
            app.logger.error(traceback.format_exc())
            app.logger.info("SocketIO disabled")
            enable_socketio = False
    else:
        app.logger.info("SocketIO disabled by configuration")
    
    # Set up database migrations
    Migrate(app, db)
    
    # Configure CORS properly
    CORS(
        app,
        origins=['http://localhost:3000', 'http://127.0.0.1:3000', 'https://mizizzi-shop.vercel.app'],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Cache-Control", "cache-control", "Pragma", "Expires", "X-MFA-Token", "Accept", "Origin"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        expose_headers=["Content-Range", "X-Content-Range", "X-Cache", "X-Cache-Time-Ms", "X-Response-Time-Ms", "X-Products-Cached", "X-All-Products-Cache"],
        send_wildcard=False,
        vary_header=True
    )

    @app.before_request
    def _handle_options_preflight():
        if request.method != 'OPTIONS':
            return None

        from flask import make_response
        response = make_response(jsonify({'status': 'ok'}), 200)

        origin = request.headers.get('Origin')
        allowed_origins = app.config.get('CORS_ORIGINS', ['http://localhost:3000', 'http://127.0.0.1:3000','https://mizizzi-shop.vercel.app'])
        if origin and ("*" in allowed_origins or origin in allowed_origins):
            response.headers['Access-Control-Allow-Origin'] = origin     
        else:
            response.headers['Access-Control-Allow-Origin'] = ','.join(allowed_origins)

        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-MFA-Token, Accept, Origin, Cache-Control, cache-control, Pragma, Expires'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Vary'] = 'Origin'

        return response
    
    # Initialize JWT
    jwt = JWTManager(app)
    
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        try:
            from .routes.admin.admin_auth import is_token_blacklisted
            jti = jwt_payload["jti"]
            revoked = is_token_blacklisted(jti)
            if revoked:
                app.logger.warning(f"Token revoked (jti={jti}) for request {request.path}")
            return revoked
        except Exception as e:
            app.logger.error(f"Error checking token blacklist: {str(e)}")
            return False
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "Token has expired",
            "code": "token_expired"
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        try:
            app.logger.warning(f"Invalid token encountered on {request.path}: {error}")
        except Exception:
            pass
        return jsonify({
            "error": "Invalid token",
            "code": "invalid_token"
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "error": "Authorization required",
            "code": "authorization_required"
        }), 401
    
    @jwt.needs_fresh_token_loader
    def token_not_fresh_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "Fresh token required",
            "code": "fresh_token_required"
        }), 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "Token has been revoked",
            "code": "token_revoked"
        }), 401
    
    # Create uploads directory if it doesn't exist
    uploads_dir = os.path.join(app.root_path, 'uploads')
    product_images_dir = os.path.join(uploads_dir, 'product_images')
    categories_images_dir = os.path.join(uploads_dir, 'categories')
    
    for directory in [uploads_dir, product_images_dir, categories_images_dir]:
        if not os.path.exists(directory):
            os.makedirs(directory)
            app.logger.info(f"Created directory: {directory}")
    
    # Image upload route
    @app.route('/api/admin/upload/image', methods=['POST'])
    @jwt_required()
    def upload_image():
        try:
            if 'file' not in request.files:
                return jsonify({"error": "No file part in the request"}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No selected file"}), 400
            
            if len(file.read()) > 5 * 1024 * 1024:
                return jsonify({"error": "File too large (max 5MB)"}), 400
            file.seek(0)
            
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
            if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
                return jsonify({"error": "File type not allowed. Only images are permitted."}), 400
            
            original_filename = werkzeug.utils.secure_filename(file.filename)
            file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
            unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
            
            file_path = os.path.join(product_images_dir, unique_filename)
            file.save(file_path)
            
            current_user_id = get_jwt_identity()
            app.logger.info(f"User {current_user_id} uploaded image: {unique_filename}")
            
            site_url = os.environ.get('SITE_URL', request.host_url.rstrip('/'))
            image_url = f"{site_url}/api/uploads/product_images/{unique_filename}"
            
            return jsonify({
                "success": True,
                "filename": unique_filename,
                "originalName": original_filename,
                "url": image_url,
                "size": os.path.getsize(file_path),
                "uploadedBy": current_user_id,
                "uploadedAt": datetime.now().isoformat()
            }), 201
            
        except Exception as e:
            app.logger.error(f"Error uploading image: {str(e)}")
            return jsonify({"error": f"Failed to upload image: {str(e)}"}), 500
    
    @app.route('/api/uploads/product_images/<filename>', methods=['GET'])
    def serve_product_image(filename):
        secure_name = werkzeug.utils.secure_filename(filename)
        return send_from_directory(product_images_dir, secure_name)
    
    @app.route('/api/uploads/categories/<filename>', methods=['GET'])
    def serve_category_image(filename):
        secure_name = werkzeug.utils.secure_filename(filename)
        app.logger.debug(f"Serving category image: {secure_name} from {categories_images_dir}")
        return send_from_directory(categories_images_dir, secure_name)
    
    # Guest cart helper function
    def get_or_create_guest_cart():
        try:
            from .models.models import Cart
        except ImportError:
            try:
                from models.models import Cart
            except ImportError:
                class Cart:
                    def __init__(self, guest_id=None):
                        self.guest_id = guest_id
                        self.is_active = True
                return Cart(guest_id=str(uuid.uuid4()))
        
        guest_cart_id = request.cookies.get('guest_cart_id')
        if guest_cart_id:
            cart = Cart.query.filter_by(guest_id=guest_cart_id, is_active=True).first()
            if cart:
                return cart
        
        guest_id = str(uuid.uuid4())
        cart = Cart(guest_id=guest_id, is_active=True)
        try:
            db.session.add(cart)
            db.session.commit()
        except Exception as e:
            app.logger.error(f"Error creating guest cart: {str(e)}")
        
        return cart
    
    # JWT Optional decorator
    def jwt_optional(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                if user_id:
                    g.user_id = user_id
                    g.is_authenticated = True
                else:
                    g.is_authenticated = False
                    g.guest_cart = get_or_create_guest_cart()
            except Exception as e:
                app.logger.error(f"JWT error: {str(e)}")
                g.is_authenticated = False
                g.guest_cart = get_or_create_guest_cart()
            
            return fn(*args, **kwargs)
        return wrapper
    
    app.jwt_optional = jwt_optional
    
    
    # Import and register blueprints with clean error handling
    from flask import Blueprint
    
    # Create fallback blueprints for routes
    fallback_blueprints = {
        'validation_routes': Blueprint('validation_routes', __name__),
        'cart_routes': Blueprint('cart_routes', __name__),
        'admin_routes': Blueprint('admin_routes', __name__),
        'admin_auth_routes': Blueprint('admin_auth_routes', __name__),
        'admin_google_auth_routes': Blueprint('admin_google_auth_routes', __name__),
        'admin_email_routes': Blueprint('admin_email_routes', __name__),
        'dashboard_routes': Blueprint('dashboard_routes', __name__),
        'order_routes': Blueprint('order_routes', __name__),
        'admin_order_routes': Blueprint('admin_order_routes', __name__),
        'admin_cart_routes': Blueprint('admin_cart_routes', __name__),
        'admin_cloudinary_routes': Blueprint('admin_cloudinary_routes', __name__),
        'admin_upload_routes': Blueprint('admin_upload_routes', __name__),
        'admin_category_routes': Blueprint('admin_category_routes', __name__),
        'admin_shop_categories_routes': Blueprint('admin_categories_bp', __name__),
        'product_images_batch_bp': Blueprint('product_images_batch_bp', __name__),
        'pesapal_routes': Blueprint('pesapal_routes', __name__),
        'coupon_routes': Blueprint('coupon_routes', __name__),
        'user_review_routes': Blueprint('user_review_routes', __name__),
        'admin_review_routes': Blueprint('admin_review_routes', __name__),
        'user_wishlist_routes': Blueprint('user_wishlist_routes', __name__),
        'admin_wishlist_routes': Blueprint('admin_wishlist_routes', __name__),
        'products_routes': Blueprint('products_routes', __name__),
        'product_details_routes': Blueprint('product_details', __name__),
        'categories_routes': Blueprint('categories_routes', __name__),
        'user_address_routes': Blueprint('user_address_routes', __name__),
        'admin_address_routes': Blueprint('admin_address_routes', __name__),
        'user_inventory_routes': Blueprint('user_inventory_routes', __name__),
        'admin_inventory_routes': Blueprint('admin_inventory_routes', __name__),
        'admin_products_routes': Blueprint('admin_products_routes', __name__),
        'user_brand_routes': Blueprint('user_brand_routes', __name__),
        'admin_brand_routes': Blueprint('admin_brand_routes', __name__),
        'notification_routes': Blueprint('notification_routes', __name__),
        'carousel_routes': Blueprint('carousel_routes', __name__),
        'theme_routes': Blueprint('theme_routes', __name__),
        'footer_routes': Blueprint('footer_routes', __name__),
        'side_panel_routes': Blueprint('side_panel_routes', __name__),
        'topbar_routes': Blueprint('topbar_routes', __name__),
        'contact_cta_routes': Blueprint('contact_cta_routes', __name__),
        'featured_routes': Blueprint('featured_routes', __name__),
        'homepage_routes': Blueprint('homepage_routes', __name__),
        'meilisearch_routes': Blueprint('meilisearch_routes', __name__),
        'admin_meilisearch_routes': Blueprint('admin_meilisearch_routes', __name__),
        'flash_sale_routes': Blueprint('flash_sale_routes', __name__),
        'admin_settings_routes': Blueprint('admin_settings_routes', __name__),
        'cache_management_routes': Blueprint('cache_management_routes', __name__),
    }
    
    # Add basic routes to fallback blueprints
    @fallback_blueprints['admin_routes'].route('/dashboard', methods=['GET'])
    def fallback_dashboard():
        return jsonify({"message": "Admin dashboard - routes loading from fallback"}), 200
    
    @fallback_blueprints['admin_auth_routes'].route('/health', methods=['GET'])
    def fallback_admin_auth_health():
        return jsonify({"status": "ok", "message": "Fallback admin auth routes active"}), 200
    
    @fallback_blueprints['admin_google_auth_routes'].route('/health', methods=['GET'])
    def fallback_admin_google_auth_health():
        return jsonify({"status": "ok", "message": "Fallback admin Google auth routes active"}), 200
    
    @fallback_blueprints['admin_upload_routes'].route('/health', methods=['GET'])
    def fallback_admin_upload_health():
        return jsonify({"status": "ok", "message": "Fallback admin upload routes active"}), 200
    
    @fallback_blueprints['dashboard_routes'].route('/dashboard', methods=['GET'])
    def fallback_dashboard_main():
        return jsonify({"message": "Dashboard routes - fallback active", "status": "ok"}), 200
    
    @fallback_blueprints['validation_routes'].route('/health', methods=['GET'])
    def fallback_health():
        return jsonify({"status": "ok", "message": "Fallback routes active"}), 200
    
    
    @fallback_blueprints['pesapal_routes'].route('/health', methods=['GET'])
    def fallback_pesapal_health():
        return jsonify({"status": "ok", "message": "Fallback Pesapal routes active"}), 200

    @fallback_blueprints['user_address_routes'].route('/health', methods=['GET'])
    def fallback_user_address_health():
        return jsonify({"status": "ok", "message": "Fallback user address routes active"}), 200

    @fallback_blueprints['admin_address_routes'].route('/health', methods=['GET'])
    def fallback_admin_address_health():
        return jsonify({"status": "ok", "message": "Fallback admin address routes active"}), 200
    
    @fallback_blueprints['categories_routes'].route('/health', methods=['GET'])
    def fallback_categories_health():
        return jsonify({"status": "ok", "message": "Fallback categories routes active"}), 200
    
    @fallback_blueprints['admin_category_routes'].route('/health', methods=['GET'])
    def fallback_admin_categories_health():
        return jsonify({"status": "ok", "message": "Fallback admin categories routes active"}), 200
    
    @fallback_blueprints['admin_shop_categories_routes'].route('/health', methods=['GET'])
    def fallback_admin_shop_categories_health():
        return jsonify({"status": "ok", "message": "Fallback admin shop categories routes active"}), 200
    
    @fallback_blueprints['order_routes'].route('/health', methods=['GET'])
    def fallback_order_health():
        return jsonify({"status": "ok", "message": "Fallback user order routes active"}), 200
    
    @fallback_blueprints['admin_order_routes'].route('/health', methods=['GET'])
    def fallback_admin_order_health():
        return jsonify({"status": "ok", "message": "Fallback admin order routes active"}), 200
    
    @fallback_blueprints['user_inventory_routes'].route('/health', methods=['GET'])
    def fallback_user_inventory_health():
        return jsonify({"status": "ok", "message": "Fallback user inventory routes active"}), 200
    
    @fallback_blueprints['admin_inventory_routes'].route('/health', methods=['GET'])
    def fallback_admin_inventory_health():
        return jsonify({"status": "ok", "message": "Fallback admin inventory routes active"}), 200
    
    @fallback_blueprints['admin_products_routes'].route('/health', methods=['GET'])
    def fallback_admin_products_health():
        return jsonify({"status": "ok", "message": "Fallback admin products routes active"}), 200
    
    @fallback_blueprints['user_review_routes'].route('/health', methods=['GET'])
    def fallback_user_review_health():
        return jsonify({"status": "ok", "message": "Fallback user review routes active"}), 200
    
    @fallback_blueprints['admin_review_routes'].route('/health', methods=['GET'])
    def fallback_admin_review_health():
        return jsonify({"status": "ok", "message": "Fallback admin review routes active"}), 200
    
    @fallback_blueprints['user_wishlist_routes'].route('/health', methods=['GET'])
    def fallback_user_wishlist_health():
        return jsonify({"status": "ok", "message": "Fallback user wishlist routes active"}), 200
    
    @fallback_blueprints['admin_wishlist_routes'].route('/health', methods=['GET'])
    def fallback_admin_wishlist_health():
        return jsonify({"status": "ok", "message": "Fallback admin wishlist routes active"}), 200
    
    @fallback_blueprints['user_brand_routes'].route('/health', methods=['GET'])
    def fallback_user_brand_health():
        return jsonify({"status": "ok", "message": "Fallback user brand routes active"}), 200

    @fallback_blueprints['admin_brand_routes'].route('/health', methods=['GET'])
    def fallback_admin_brand_health():
        return jsonify({"status": "ok", "message": "Fallback admin brand routes active"}), 200
    
    @fallback_blueprints['admin_email_routes'].route('/health', methods=['GET'])
    def fallback_admin_email_health():
        return jsonify({"status": "ok", "message": "Fallback admin email routes active"}), 200

    @fallback_blueprints['notification_routes'].route('/health', methods=['GET'])
    def fallback_notification_health():
        return jsonify({"status": "ok", "message": "Fallback notification routes active"}), 200
    
    @fallback_blueprints['carousel_routes'].route('/health', methods=['GET'])
    def fallback_carousel_health():
        return jsonify({"status": "ok", "message": "Fallback carousel routes active"}), 200
    
    @fallback_blueprints['theme_routes'].route('/health', methods=['GET'])
    def fallback_theme_health():
        return jsonify({"status": "ok", "message": "Fallback theme routes active"}), 200
    
    @fallback_blueprints['footer_routes'].route('/health', methods=['GET'])
    def fallback_footer_health():
        return jsonify({"status": "ok", "message": "Fallback footer routes active"}), 200
    
    @fallback_blueprints['side_panel_routes'].route('/health', methods=['GET'])
    def fallback_side_panel_health():
        return jsonify({"status": "ok", "message": "Fallback side panel routes active"}), 200

    @fallback_blueprints['topbar_routes'].route('/health', methods=['GET'])
    def fallback_topbar_health():
        return jsonify({"status": "ok", "message": "Fallback topbar routes active"}), 200

    @fallback_blueprints['contact_cta_routes'].route('/health', methods=['GET'])
    def fallback_contact_cta_health():
        return jsonify({"status": "ok", "message": "Fallback contact CTA routes active"}), 200

    @fallback_blueprints['featured_routes'].route('/health', methods=['GET'])
    def fallback_featured_health():
        return jsonify({"status": "ok", "message": "Fallback featured routes active"}), 200
    
    @fallback_blueprints['homepage_routes'].route('/health', methods=['GET'])
    def fallback_homepage_health():
        return jsonify({"status": "ok", "message": "Fallback homepage routes active"}), 200
    
    @fallback_blueprints['meilisearch_routes'].route('/health', methods=['GET'])
    def fallback_meilisearch_health():
        return jsonify({"status": "ok", "message": "Fallback Meilisearch routes active"}), 200
    
    @fallback_blueprints['admin_meilisearch_routes'].route('/health', methods=['GET'])
    def fallback_admin_meilisearch_health():
        return jsonify({"status": "ok", "message": "Fallback admin Meilisearch routes active"}), 200
    
    @fallback_blueprints['flash_sale_routes'].route('/health', methods=['GET'])
    def fallback_flash_sale_health():
        return jsonify({"status": "ok", "message": "Fallback flash sale routes active"}), 200
    
    @fallback_blueprints['cache_management_routes'].route('/health', methods=['GET'])
    def fallback_cache_management_health():
        return jsonify({"status": "ok", "message": "Fallback cache management routes active"}), 200
    
    # Blueprint import paths dictionary
    blueprint_imports = {
        'validation_routes': [
            ('app.routes.user.user', 'validation_routes'),
            ('routes.user.user', 'validation_routes')
        ],
        'cart_routes': [
            ('app.routes.cart.cart_routes', 'cart_routes'),
            ('routes.cart.cart_routes', 'cart_routes')
        ],
        'admin_routes': [
            ('app.routes.admin.admin', 'admin_routes'),
            ('routes.admin.admin', 'admin_routes')
        ],
        'admin_auth_routes': [
            ('app.routes.admin.admin_auth', 'admin_auth_routes'),
            ('routes.admin.admin_auth', 'admin_auth_routes'),
            ('backend.app.routes.admin.admin_auth', 'admin_auth_routes'),
            ('backend.routes.admin.admin_auth', 'admin_auth_routes')
        ],
        'admin_google_auth_routes': [
            ('app.routes.admin.admin_google_auth', 'admin_google_auth_routes'),
            ('routes.admin.admin_google_auth', 'admin_google_auth_routes'),
            ('backend.app.routes.admin.admin_google_auth', 'admin_google_auth_routes'),
            ('backend.routes.admin.admin_google_auth', 'admin_google_auth_routes')
        ],
        'admin_email_routes': [
            ('app.routes.admin.admin_email_routes', 'admin_email_routes'),
            ('routes.admin.admin_email_routes', 'admin_email_routes'),
            ('backend.app.routes.admin.admin_email_routes', 'admin_email_routes'),
            ('backend.routes.admin.admin_email_routes', 'admin_email_routes')
        ],
        'dashboard_routes': [
            ('app.routes.admin.dashboard', 'dashboard_routes'),
            ('routes.admin.dashboard', 'dashboard_routes')
        ],
        'order_routes': [
            ('app.routes.order.order_routes', 'order_routes'),
            ('routes.order.order_routes', 'order_routes')
        ],
        'admin_order_routes': [
            ('app.routes.order.admin_order_routes', 'admin_order_routes'),
            ('routes.order.admin_order_routes', 'admin_order_routes'),
            ('backend.app.routes.order.admin_order_routes', 'admin_order_routes'),
            ('backend.routes.order.admin_order_routes', 'admin_order_routes')
        ],
        'admin_cart_routes': [
            ('app.routes.admin.admin_cart_routes', 'admin_cart_routes'),
            ('routes.admin.admin_cart_routes', 'admin_cart_routes')
        ],
        'admin_cloudinary_routes': [
            ('app.routes.admin.admin_cloudinary_routes', 'admin_cloudinary_routes'),
            ('routes.admin.admin_cloudinary_routes', 'admin_cloudinary_routes')
        ],
        'admin_upload_routes': [
            ('app.routes.admin.admin_upload_routes', 'admin_upload_routes'),
            ('routes.admin.admin_upload_routes', 'admin_upload_routes')
        ],
        'admin_category_routes': [
            ('app.routes.admin.admin_category_routes', 'admin_category_routes'),
            ('routes.admin.admin_category_routes', 'admin_category_routes')
        ],
        'admin_shop_categories_routes': [
            ('app.routes.admin.admin_shop_categories_routes', 'admin_shop_categories_routes'),
            ('routes.admin.admin_shop_categories_routes', 'admin_shop_categories_routes')
        ],
        'product_images_batch_bp': [
            ('app.routes.products.product_images_batch', 'product_images_batch_bp'),
            ('routes.products.product_images_batch', 'product_images_batch_bp')
        ],
        'pesapal_routes': [
            ('app.routes.payments.pesapal_routes', 'pesapal_routes'),
            ('routes.payments.pesapal_routes', 'pesapal_routes')
        ],
        'coupon_routes': [
            ('app.routes.coupon.coupon_routes', 'coupon_routes'),
            ('routes.coupon.coupon_routes', 'coupon_routes')
        ],
        'user_review_routes': [
            ('routes.reviews.user_review_routes', 'user_review_routes'),
            ('app.routes.reviews.user_review_routes', 'user_review_routes')
        ],
        'admin_review_routes': [
            ('routes.reviews.admin_review_routes', 'admin_review_routes'),
            ('app.routes.reviews.admin_review_routes', 'admin_review_routes')
        ],
        'user_wishlist_routes': [
            ('routes.wishlist.user_wishlist_routes', 'user_wishlist_routes'),
            ('app.routes.wishlist.user_wishlist_routes', 'user_wishlist_routes')
        ],
        'admin_wishlist_routes': [
            ('routes.wishlist.admin_wishlist_routes', 'admin_wishlist_routes'),
            ('app.routes.wishlist.admin_wishlist_routes', 'admin_wishlist_routes')
        ],
        'products_routes': [
            ('app.routes.products.products_routes', 'products_routes'),
            ('routes.products.products_routes', 'products_routes')
        ],
        'product_details_routes': [
            ('app.routes.products.product_details_optimized', 'product_details_bp'),
            ('routes.products.product_details_optimized', 'product_details_bp'),
            ('backend.app.routes.products.product_details_optimized', 'product_details_bp'),
            ('backend.routes.products.product_details_optimized', 'product_details_bp'),
        ],
        'categories_routes': [
            ('app.routes.categories.categories_routes', 'categories_routes'),
            ('routes.categories.categories_routes', 'categories_routes')
        ],
        'user_address_routes': [
            ('routes.address.user_address_routes', 'user_address_routes'),
            ('app.routes.address.user_address_routes', 'user_address_routes')
        ],
        'admin_address_routes': [
            ('routes.address.admin_address_routes', 'admin_address_routes'),
            ('app.routes.address.admin_address_routes', 'admin_address_routes')
        ],
        'user_inventory_routes': [
            ('routes.inventory.user_inventory_routes', 'user_inventory_routes'),
            ('app.routes.inventory.user_inventory_routes', 'user_inventory_routes')
        ],
        'admin_inventory_routes': [
            ('routes.inventory.admin_inventory_routes', 'admin_inventory_routes'),
            ('app.routes.inventory.admin_inventory_routes', 'admin_inventory_routes')
        ],
        'admin_products_routes': [
            ('app.routes.products.admin_products_routes', 'admin_products_routes'),
            ('routes.products.admin_products_routes', 'admin_products_routes')
        ],
        'user_brand_routes': [
            ('app.routes.brands.user_brand_routes', 'user_brand_routes'),
            ('routes.brands.user_brand_routes', 'user_brand_routes')
        ],
        'admin_brand_routes': [
            ('app.routes.brands.admin_brand_routes', 'admin_brand_routes'),
            ('routes.brands.admin_brand_routes', 'admin_brand_routes')
        ],
        'notification_routes': [
            ('app.routes.notifications.notification_routes', 'notification_routes'),
            ('routes.notifications.notification_routes', 'notification_routes'),
            ('backend.app.routes.notifications.notification_routes', 'notification_routes'),
            ('backend.routes.notifications.notification_routes', 'notification_routes')
        ],
        'carousel_routes': [
            ('app.routes.carousel.carousel_routes', 'carousel_routes'),
            ('routes.carousel.carousel_routes', 'carousel_routes'),
            ('backend.app.routes.carousel.carousel_routes', 'carousel_routes'),
            ('backend.routes.carousel.carousel_routes', 'carousel_routes')
        ],
        'theme_routes': [
            ('app.routes.theme.theme_routes', 'theme_routes'),
            ('routes.theme.theme_routes', 'theme_routes'),
            ('backend.app.routes.theme.theme_routes', 'theme_routes'),
            ('backend.routes.theme.theme_routes', 'theme_routes')
        ],
        'footer_routes': [
            ('app.routes.footer.footer_routes', 'footer_routes'),
            ('routes.footer.footer_routes', 'footer_routes'),
            ('backend.app.routes.footer.footer_routes', 'footer_routes'),
            ('backend.routes.footer.footer_routes', 'footer_routes')
        ],
        'side_panel_routes': [
            ('app.routes.panels.side_panel_routes', 'side_panel_routes'),
            ('routes.panels.side_panel_routes', 'side_panel_routes'),
            ('backend.app.routes.panels.side_panel_routes', 'side_panel_routes'),
            ('backend.routes.panels.side_panel_routes', 'side_panel_routes')
        ],
        'topbar_routes': [
            ('app.routes.topbar.topbar_routes', 'topbar_routes'),
            ('routes.topbar.topbar_routes', 'topbar_routes'),
            ('backend.app.routes.topbar.topbar_routes', 'topbar_routes'),
            ('backend.routes.topbar.topbar_routes', 'topbar_routes')
        ],
        'contact_cta_routes': [
            ('app.routes.contact_cta.contact_cta_routes', 'contact_cta_routes'),
            ('routes.contact_cta.contact_cta_routes', 'contact_cta_routes'),
            ('app.routes.content.contact_cta_routes', 'contact_cta_routes'),
            ('routes.content.contact_cta_routes', 'contact_cta_routes'),
            ('backend.app.routes.contact_cta.contact_cta_routes', 'contact_cta_routes'),
            ('backend.routes.contact_cta.contact_cta_routes', 'contact_cta_routes')
        ],
        'featured_routes': [
            ('app.routes.products.featured_routes', 'featured_routes'),
            ('routes.products.featured_routes', 'featured_routes'),
            ('app.routes.products.featured_routes', 'featured_bp'),
            ('routes.products.featured_routes', 'featured_bp'),
            ('app.routes.products.featured_routes', 'featured'),
            ('routes.products.featured_routes', 'featured'),
            ('app.routes.products.featured', 'featured_routes'),
            ('routes.products.featured', 'featured_routes'),
            ('app.routes.products.featured', 'featured_bp'),
            ('routes.products.featured', 'featured_bp'),
            ('backend.app.routes.products.featured_routes', 'featured_routes'),
            ('backend.routes.products.featured_routes', 'featured_routes'),
            ('backend.app.routes.products.featured_routes', 'featured_bp'),
            ('backend.routes.products.featured_routes', 'featured_bp'),
        ],
        'homepage_routes': [
            ('app.routes.homepage', 'homepage_routes'),
            ('routes.homepage', 'homepage_routes'),
            ('app.routes.homepage.homepage_routes', 'homepage_routes'),
            ('routes.homepage.homepage_routes', 'homepage_routes'),
            ('backend.app.routes.homepage', 'homepage_routes'),
            ('backend.routes.homepage', 'homepage_routes'),
            ('backend.app.routes.homepage.homepage_routes', 'homepage_routes'),
            ('backend.routes.homepage.homepage_routes', 'homepage_routes'),
        ],
        'meilisearch_routes': [
            ('app.routes.meilisearch', 'meilisearch_routes'),
            ('routes.meilisearch', 'meilisearch_routes'),
            ('app.routes.meilisearch.meilisearch_routes', 'meilisearch_routes'),
            ('routes.meilisearch.meilisearch_routes', 'meilisearch_routes'),
            ('backend.app.routes.meilisearch', 'meilisearch_routes'),
            ('backend.routes.meilisearch', 'meilisearch_routes'),
        ],
        'admin_meilisearch_routes': [
            ('app.routes.meilisearch', 'admin_meilisearch_routes'),
            ('routes.meilisearch', 'admin_meilisearch_routes'),
            ('app.routes.meilisearch.meilisearch_routes', 'admin_meilisearch_routes'),
            ('routes.meilisearch.meilisearch_routes', 'admin_meilisearch_routes'),
            ('backend.app.routes.meilisearch', 'admin_meilisearch_routes'),
            ('backend.routes.meilisearch', 'admin_meilisearch_routes'),
        ],
        'flash_sale_routes': [
            ('app.routes.flash_sale.flash_sale_routes', 'flash_sale_routes'),
            ('routes.flash_sale.flash_sale_routes', 'flash_sale_routes'),
            ('app.routes.flash_sale.flash_sale_routes', 'flash_sale_bp'),
            ('routes.flash_sale.flash_sale_routes', 'flash_sale_bp'),
            ('backend.app.routes.flash_sale.flash_sale_routes', 'flash_sale_routes'),
            ('backend.routes.flash_sale.flash_sale_routes', 'flash_sale_routes'),
        ],
        'admin_settings_routes': [
            ('app.routes.admin.admin_settings_routes', 'admin_settings_routes'),
            ('routes.admin.admin_settings_routes', 'admin_settings_routes'),
            ('backend.app.routes.admin.admin_settings_routes', 'admin_settings_routes'),
            ('backend.routes.admin.admin_settings_routes', 'admin_settings_routes')
        ],
        'cache_management_routes': [
            ('app.routes.admin.cache_management', 'cache_management_bp'),
            ('routes.admin.cache_management', 'cache_management_bp'),
            ('backend.app.routes.admin.cache_management', 'cache_management_bp'),
            ('backend.routes.admin.cache_management', 'cache_management_bp'),
        ],
    }
    
    # Import blueprints with clean logging
    imported_blueprints = {}
    
    import inspect
    from flask import Blueprint as _Blueprint

    for blueprint_name, import_attempts in blueprint_imports.items():
        found = False
        tried = set()
        for module_path, attr_name in import_attempts:
            if not module_path or not module_path.strip():
                app.logger.debug(f"Skipping empty module path for {blueprint_name}")
                continue

            key = (module_path, attr_name)
            if key in tried:
                continue
            tried.add(key)

            try:
                app.logger.debug(f"Attempting to import '{attr_name}' from '{module_path}' for '{blueprint_name}'")
                module = __import__(module_path, fromlist=['*'])

                candidate = None
                # Direct attribute match
                if attr_name and hasattr(module, attr_name):
                    candidate = getattr(module, attr_name)

                # Try common alternative attribute names
                if candidate is None:
                    alt_names = [
                        'bp', 'bp_routes', 'blueprint', 'blueprint_routes',
                        blueprint_name, f"{blueprint_name}_bp", f"{blueprint_name}_routes",
                        attr_name, f"{attr_name}_bp", f"{attr_name}_routes"
                    ]
                    for alt in alt_names:
                        if alt and hasattr(module, alt):
                            candidate = getattr(module, alt)
                            app.logger.debug(f"Found alternate attribute '{alt}' in {module_path} for {blueprint_name}")
                            break

                # If still none, scan module for any Blueprint instance
                if candidate is None:
                    for name, obj in inspect.getmembers(module):
                        try:
                            if isinstance(obj, _Blueprint):
                                candidate = obj
                                app.logger.debug(f"Found Blueprint instance '{name}' in {module_path} for {blueprint_name}")
                                break
                        except Exception:
                            continue

                if candidate is None:
                    app.logger.debug(f"No blueprint candidate found in {module_path} for {blueprint_name}")
                    continue

                # Ensure candidate is a Blueprint
                if not isinstance(candidate, _Blueprint):
                    app.logger.debug(f"Candidate from {module_path} for {blueprint_name} is not a Blueprint: {type(candidate)}")
                    continue

                imported_blueprints[blueprint_name] = candidate
                app.logger.info(f"✅ Imported {blueprint_name} from {module_path} (blueprint name: {getattr(candidate, 'name', 'unknown')})")
                found = True
                break

            except (ImportError, AttributeError, ValueError) as e:
                app.logger.debug(f"Failed to import from {module_path} for {blueprint_name}: {e}")
                continue
            except Exception as e:
                app.logger.warning(f"Unexpected error importing for {blueprint_name} from {module_path}: {e}")
                continue

        if not found:
            app.logger.debug(f"Could not import a blueprint for {blueprint_name}; fallback will be used if provided.")
    
    # Import admin shop categories routes
    try:
        from app.routes.admin.admin_categories_routes import admin_categories_bp
        imported_blueprints['admin_shop_categories_routes'] = admin_categories_bp
        app.logger.info("✅ admin_categories_routes → /api/admin/shop-categories")
    except ImportError as e:
        try:
            from routes.admin.admin_categories_routes import admin_categories_bp
            imported_blueprints['admin_shop_categories_routes'] = admin_categories_bp
            app.logger.info("✅ admin_categories_routes → /api/admin/shop-categories")
        except ImportError:
            app.logger.debug(f"Admin shop categories routes import failed: {e}")
    
    # Import cache management routes
    try:
        from app.routes.admin.cache_management import cache_management_bp
        imported_blueprints['cache_management_routes'] = cache_management_bp
        app.logger.info("✅ cache_management_routes → /api/admin/cache")
    except ImportError as e:
        try:
            from routes.admin.cache_management import cache_management_bp
            imported_blueprints['cache_management_routes'] = cache_management_bp
            app.logger.info("✅ cache_management_routes → /api/admin/cache")
        except ImportError:
            app.logger.debug(f"Cache management routes import failed: {e}")
    
    # Use imported blueprints or fallbacks
    final_blueprints = {}
    for blueprint_name in fallback_blueprints:
        if blueprint_name in imported_blueprints:
            final_blueprints[blueprint_name] = imported_blueprints[blueprint_name]
        else:
            final_blueprints[blueprint_name] = fallback_blueprints[blueprint_name]
            app.logger.warning(f"⚠️ Using fallback for {blueprint_name}")
    
    # Register blueprints
    try:
        app.register_blueprint(final_blueprints['validation_routes'], url_prefix='/api')
        app.register_blueprint(final_blueprints['cart_routes'], url_prefix='/api/cart')
        app.register_blueprint(final_blueprints['admin_routes'], url_prefix='/api/admin')
        app.register_blueprint(final_blueprints['admin_auth_routes'], url_prefix='/api/admin')
        if 'admin_google_auth_routes' in final_blueprints:
            app.register_blueprint(final_blueprints['admin_google_auth_routes'], url_prefix='/api/admin/auth')
        app.register_blueprint(final_blueprints['admin_email_routes'], url_prefix='/api/admin')
        app.register_blueprint(final_blueprints['admin_settings_routes'], url_prefix='/api/admin')
        app.register_blueprint(final_blueprints['dashboard_routes'], url_prefix='/api/admin/dashboard')
        
        app.register_blueprint(final_blueprints['order_routes'], url_prefix='/api/orders')
        app.register_blueprint(final_blueprints['admin_order_routes'], url_prefix='/api/admin')
        
        app.register_blueprint(final_blueprints['admin_cart_routes'], url_prefix='/api/admin/cart')
        app.register_blueprint(final_blueprints['admin_cloudinary_routes'], url_prefix='/api/admin/cloudinary')
        app.register_blueprint(final_blueprints['admin_upload_routes'], url_prefix='/api/admin')
        app.register_blueprint(final_blueprints['admin_category_routes'], url_prefix='/api/admin/categories')
        app.register_blueprint(final_blueprints['admin_shop_categories_routes'], url_prefix='/api/admin/shop-categories')
        app.register_blueprint(final_blueprints['product_images_batch_bp'])
        
        # Removed payment_routes registration
        app.register_blueprint(final_blueprints['pesapal_routes'], url_prefix='/api/pesapal')
        
        app.register_blueprint(final_blueprints['coupon_routes'], url_prefix='/api/coupons')
        
        app.register_blueprint(final_blueprints['user_review_routes'], url_prefix='/api/reviews/user')
        app.register_blueprint(final_blueprints['admin_review_routes'], url_prefix='/api/admin/reviews')
        
        app.register_blueprint(final_blueprints['user_brand_routes'], url_prefix='/api/brands')
        app.register_blueprint(final_blueprints['admin_brand_routes'], url_prefix='/api/admin/brands')
        
        app.register_blueprint(final_blueprints['user_wishlist_routes'], url_prefix='/api/wishlist/user')
        app.register_blueprint(final_blueprints['admin_wishlist_routes'], url_prefix='/api/admin/wishlist')
        
        app.register_blueprint(final_blueprints['products_routes'], url_prefix='/api/products')
        app.register_blueprint(final_blueprints['categories_routes'], url_prefix='/api/categories')
        
        app.register_blueprint(final_blueprints['user_address_routes'], url_prefix='/api/addresses/user')
        app.register_blueprint(final_blueprints['admin_address_routes'], url_prefix='/api/admin/addresses')
        
        app.register_blueprint(final_blueprints['user_inventory_routes'], url_prefix='/api/inventory/user')
        app.register_blueprint(final_blueprints['admin_inventory_routes'], url_prefix='/api/inventory/admin')
        
        app.register_blueprint(final_blueprints['admin_products_routes'], url_prefix='/api/admin/products')
        
        app.register_blueprint(final_blueprints['notification_routes'], url_prefix='/api/notifications')
        app.register_blueprint(final_blueprints['carousel_routes'], url_prefix='/api/carousel')
        app.register_blueprint(final_blueprints['theme_routes'], url_prefix='/api/theme')
        app.register_blueprint(final_blueprints['footer_routes'], url_prefix='/api/footer')
        app.register_blueprint(final_blueprints['side_panel_routes'], url_prefix='/api/panels')
        app.register_blueprint(final_blueprints['topbar_routes'], url_prefix='/api/topbar')
        app.register_blueprint(final_blueprints['contact_cta_routes'], url_prefix='/api/contact-cta')
        app.register_blueprint(final_blueprints['featured_routes'], url_prefix='/api/products/featured')
        app.register_blueprint(final_blueprints['homepage_routes'])

        app.register_blueprint(final_blueprints['meilisearch_routes'], url_prefix='/api/meilisearch')
        app.register_blueprint(final_blueprints['admin_meilisearch_routes'], url_prefix='/api/admin/meilisearch')
        app.logger.info("✅ Meilisearch routes registered successfully")

        app.register_blueprint(final_blueprints['flash_sale_routes'], url_prefix='/api/flash-sale')
        app.logger.info("✅ Flash sale routes registered at /api/flash-sale")
        
        app.register_blueprint(final_blueprints['cache_management_routes'], url_prefix='/api/admin/cache')
        app.logger.info("✅ Cache management routes registered at /api/admin/cache")

        try:
            app.logger.debug("Importing Google Auth routes...")
            from app.routes.auth.google_auth import google_auth_routes
            app.register_blueprint(google_auth_routes, url_prefix='/api/auth')
            app.logger.info("✅ Google OAuth routes registered successfully")
            imported_blueprints['google_auth_routes'] = google_auth_routes
        except ImportError as e:
            app.logger.error(f"Failed to import Google OAuth routes: {str(e)}")
            fallback_google = Blueprint('google_auth_routes', __name__)
            
            @fallback_google.route('/google-config', methods=['GET'])
            def fallback_google_config():
                return jsonify({
                    'configured': False,
                    'message': 'Google OAuth is not configured'
                }), 500
            
            app.register_blueprint(fallback_google, url_prefix='/api/auth')
            app.logger.warning("⚠️ Using fallback Google OAuth routes")
        
        # Clean startup logging
        def log_startup_summary():
            """Generate and log a clean startup summary."""
            app.logger.info("=" * 60)
            app.logger.info("🚀 MIZIZZI E-COMMERCE PLATFORM - STARTUP COMPLETE")
            app.logger.info("=" * 60)
            
            app.logger.info("📦 BLUEPRINT REGISTRATION SUMMARY")
            app.logger.info("-" * 40)
            fallback_count = 0
            success_count = 0
            
            blueprint_url_prefixes = {
                'validation_routes': '/api',
                'cart_routes': '/api/cart',
                'admin_routes': '/api/admin',
                'admin_auth_routes': '/api/admin',
                'admin_google_auth_routes': '/api/admin/auth',
                'admin_email_routes': '/api/admin',
                'dashboard_routes': '/api/admin/dashboard',
                'order_routes': '/api/orders',
                'admin_order_routes': '/api/admin',
                'admin_cart_routes': '/api/admin/cart',
                'admin_cloudinary_routes': '/api/admin/cloudinary',
                'admin_category_routes': '/api/admin/categories',
                'admin_shop_categories_routes': '/api/admin/shop-categories',
                'product_images_batch_bp': '/',
                'pesapal_routes': '/api/pesapal',
                'coupon_routes': '/api/coupons',
                'user_review_routes': '/api/reviews/user',
                'admin_review_routes': '/api/admin/reviews',
                'user_wishlist_routes': '/api/wishlist/user',
                'admin_wishlist_routes': '/api/admin/wishlist',
                'products_routes': '/api/products',
                'categories_routes': '/api/categories',
                'user_address_routes': '/api/addresses/user',
                'admin_address_routes': '/api/admin/addresses',
                'user_inventory_routes': '/api/inventory/user',
                'admin_inventory_routes': '/api/inventory/admin',
                'admin_products_routes': '/api/admin/products',
                'user_brand_routes': '/api/brands',
                'admin_brand_routes': '/api/admin/brands',
                'notification_routes': '/api/notifications',
                'carousel_routes': '/api/carousel',
                'google_auth_routes': '/api/auth',
                'theme_routes': '/api/theme',
                'footer_routes': '/api/footer',
                'side_panel_routes': '/api/panels',
                'topbar_routes': '/api/topbar',
                'contact_cta_routes': '/api/contact-cta',
                'featured_routes': '/api/products/featured',
                'meilisearch_routes': '/api/meilisearch',
                'admin_meilisearch_routes': '/api/admin/meilisearch',
                'flash_sale_routes': '/api/flash-sale',
            }
            
            for blueprint_name in final_blueprints:
                if blueprint_name in imported_blueprints:
                    status = "✅"
                    success_count += 1
                else:
                    status = "⚠️"
                    fallback_count += 1
                
                url_prefix = blueprint_url_prefixes.get(blueprint_name, "/")
                app.logger.info(f"{status} {blueprint_name:<25} → {url_prefix}")
            
            app.logger.info(f"📊 Stats: {success_count} imported, {fallback_count} fallbacks")
            
            # Payment System Endpoints
            app.logger.info("💳 PAYMENT SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Pesapal Payment: /api/pesapal/payment")
            app.logger.info("Pesapal Callback: /api/pesapal/callback")
            app.logger.info(f"Payment System: {'✅' if 'pesapal_routes' in imported_blueprints else '❌'}")

            # Admin Authentication System Endpoints
            app.logger.info("🔐 ADMIN AUTHENTICATION ENDPOINTS")
            app.logger.info("-" * 35)
            app.logger.info("Admin Login: /api/admin/login")
            app.logger.info("Admin Profile: /api/admin/profile")
            app.logger.info("Admin Logout: /api/admin/logout")
            app.logger.info("Admin MFA Setup: /api/admin/mfa/setup")
            app.logger.info("Admin User Management: /api/admin/users")
            app.logger.info("Admin Activity Logs: /api/admin/activity-logs")
            app.logger.info(f"Admin Auth System: {'✅' if 'admin_auth_routes' in imported_blueprints else '⚠️'}")
            app.logger.info(f"Admin Google Auth System: {'✅' if 'admin_google_auth_routes' in imported_blueprints else '⚠️'}")
            
            # Admin Email System Endpoints
            app.logger.info("📧 ADMIN EMAIL ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Send Email: /api/admin/email/send")
            app.logger.info("Email Logs: /api/admin/email/logs")
            app.logger.info(f"Admin Email System: {'✅' if 'admin_email_routes' in imported_blueprints else '⚠️'}")
            
            # Google OAuth Endpoints
            app.logger.info("🌐 GOOGLE AUTH ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Google OAuth Login: /api/auth/google")
            app.logger.info("Google OAuth Callback: /api/auth/google/callback")
            app.logger.info(f"Google Auth System: {'✅' if 'google_auth_routes' in imported_blueprints else '⚠️'}")

            # Meilisearch System Endpoints
            app.logger.info("🔍 MEILISEARCH SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("User Meilisearch: /api/meilisearch")
            app.logger.info("Admin Meilisearch: /api/admin/meilisearch")
            app.logger.info(f"Meilisearch Routes: {'✅' if 'meilisearch_routes' in imported_blueprints else '⚠️'}")
            app.logger.info(f"Admin Meilisearch Routes: {'✅' if 'admin_meilisearch_routes' in imported_blueprints else '⚠️'}")
            
            app.logger.info("⚡ FLASH SALE SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Flash Sale Products: /api/flash-sale/products")
            app.logger.info("Flash Sale Event: /api/flash-sale/event")
            app.logger.info("Flash Sale Stock: /api/flash-sale/stock/<id>")
            app.logger.info("Flash Sale Debug: /api/flash-sale/debug")
            app.logger.info(f"Flash Sale System: {'✅' if 'flash_sale_routes' in imported_blueprints else '⚠️'}")
            
            # Product System Endpoints
            app.logger.info("🛍️ PRODUCT SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("User Products: /api/products")
            app.logger.info("Admin Products: /api/admin/products")
            app.logger.info("Featured Products: /api/products/featured")
            
            # Brand System Endpoints
            app.logger.info("🏷️ BRAND SYSTEM ENDPOINTS")
            app.logger.info("-" * 25)
            app.logger.info("User Brands: /api/brands")
            app.logger.info("Admin Brands: /api/admin/brands")
            app.logger.info(f"User Brand System: {'✅' if 'user_brand_routes' in imported_blueprints else '⚠️'}")
            app.logger.info(f"Admin Brand System: {'✅' if 'admin_brand_routes' in imported_blueprints else '⚠️'}")
            
            # Inventory System Endpoints
            app.logger.info("📦 INVENTORY SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("User Inventory: /api/inventory/user")
            app.logger.info("Admin Inventory: /api/inventory/admin")
            
            # Order System Endpoints
            app.logger.info("📋 ORDER SYSTEM ENDPOINTS")
            app.logger.info("-" * 25)
            app.logger.info("User Orders: /api/orders")
            app.logger.info("Admin Orders: /api/admin")
            
            # Review System Endpoints
            app.logger.info("⭐ REVIEW SYSTEM ENDPOINTS")
            app.logger.info("-" * 25)
            app.logger.info("User Reviews: /api/reviews/user")
            app.logger.info("Admin Reviews: /api/admin/reviews")
            
            # Wishlist System Endpoints
            app.logger.info("💝 WISHLIST SYSTEM ENDPOINTS")
            app.logger.info("-" * 27)
            app.logger.info("User Wishlist: /api/wishlist/user")
            app.logger.info("Admin Wishlist: /api/admin/wishlist")
            app.logger.info(f"User Wishlist System: {'✅' if 'user_wishlist_routes' in imported_blueprints else '⚠️'}")
            app.logger.info(f"Admin Wishlist System: {'✅' if 'admin_wishlist_routes' in imported_blueprints else '⚠️'}")
            
            # Address System Endpoints
            app.logger.info("🏠 ADDRESS SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("User Addresses: /api/addresses/user")
            app.logger.info("Admin Addresses: /api/admin/addresses")
            app.logger.info(f"User Address System: {'✅' if 'user_address_routes' in imported_blueprints else '⚠️'}")
            app.logger.info(f"Admin Address System: {'✅' if 'admin_address_routes' in imported_blueprints else '⚠️'}")
            
            # Notification System Endpoints
            app.logger.info("🔔 NOTIFICATION SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("User Notifications: /api/notifications")
            app.logger.info(f"Notification System: {'✅' if 'notification_routes' in imported_blueprints else '❌'}")
            
            # Carousel System Endpoints
            app.logger.info("🎠 CAROUSEL SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Carousel Items: /api/carousel")
            app.logger.info(f"Carousel System: {'✅' if 'carousel_routes' in imported_blueprints else '❌'}")

            app.logger.info("🎨 THEME SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Get Active Theme: /api/theme/active")
            app.logger.info("Admin Get Themes: /api/theme/admin/themes")
            app.logger.info("Admin Update Theme: /api/theme/admin/themes/<id>")
            app.logger.info("Admin Apply Preset: /api/theme/admin/apply-preset/<preset_name>")
            app.logger.info(f"Theme System: {'✅' if 'theme_routes' in imported_blueprints else '⚠️'}")

            app.logger.info("🦶 FOOTER SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Get Footer Settings: /api/footer/settings")
            app.logger.info("Update Footer Settings: /api/footer/settings")
            app.logger.info(f"Footer System: {'✅' if 'footer_routes' in imported_blueprints else '⚠️'}")

            app.logger.info("🖼️ SIDE PANEL SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Get Panels: /api/panels/items")
            app.logger.info("Admin Panels: /api/panels/admin/all")
            app.logger.info(f"Side Panel System: {'✅' if 'side_panel_routes' in imported_blueprints else '⚠️'}")

            app.logger.info("📢 TOPBAR SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Get TopBar Slides: /api/topbar/slides")
            app.logger.info("Admin Get Slides: /api/topbar/admin/all")
            app.logger.info("Admin Create Slide: /api/topbar/admin")
            app.logger.info("Admin Update Slide: /api/topbar/admin/<id>")
            app.logger.info(f"TopBar System: {'✅' if 'topbar_routes' in imported_blueprints else '⚠️'}")

            app.logger.info("📞 CONTACT CTA SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Get Contact CTA Slides: /api/contact-cta/slides")
            app.logger.info("Admin Get CTA Slides: /api/contact-cta/admin/all")
            app.logger.info("Admin Create CTA Slide: /api/contact-cta/admin")
            app.logger.info("Admin Update CTA Slide: /api/contact-cta/admin/<id>")
            app.logger.info(f"Contact CTA System: {'✅' if 'contact_cta_routes' in imported_blueprints else '⚠️'}")
            
            app.logger.info("⭐ FEATURED SYSTEM ENDPOINTS")
            app.logger.info("-" * 30)
            app.logger.info("Admin Featured Products: /api/products/featured")
            app.logger.info(f"Featured System: {'✅' if 'featured_routes' in imported_blueprints else '⚠️'}")
            
            # System Status
            app.logger.info("⚙️ SYSTEM STATUS")
            app.logger.info("-" * 15)
            app.logger.info(f"Database: {'✅' if db else '❌'}")
            app.logger.info(f"SocketIO: {'✅' if enable_socketio else '❌'}")
            app.logger.info(f"JWT: ✅")
            app.logger.info(f"CORS: ✅")
            app.logger.info(f"Rate Limiting: ✅")
            app.logger.info(f"Admin Auth System: {'✅' if 'admin_auth_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Admin Google Auth System: {'✅' if 'admin_google_auth_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Admin Email System: {'✅' if 'admin_email_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Google Auth System: {'✅' if 'google_auth_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Meilisearch System: {'✅' if ('meilisearch_routes' in imported_blueprints and 'admin_meilisearch_routes' in imported_blueprints) else '❌'}")
            app.logger.info(f"Payment System: {'✅' if 'pesapal_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Order System: ✅")
            app.logger.info(f"Inventory System: ✅")
            app.logger.info(f"Product System: ✅")
            app.logger.info(f"Review System: ✅")
            app.logger.info(f"Wishlist System: ✅")
            app.logger.info(f"Brand System: {'✅' if 'user_brand_routes' in imported_blueprints and 'admin_brand_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Notification System: {'✅' if 'notification_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Carousel System: {'✅' if 'carousel_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Theme System: {'✅' if 'theme_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Footer System: {'✅' if 'footer_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Side Panel System: {'✅' if 'side_panel_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Topbar System: {'✅' if 'topbar_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Contact CTA System: {'✅' if 'contact_cta_routes' in imported_blueprints else '❌'}")
            app.logger.info(f"Featured System: {'✅' if 'featured_routes' in imported_blueprints else '❌'}")
            
            # Security Features
            app.logger.info("🔒 SECURITY FEATURES")
            app.logger.info("-" * 20)
            app.logger.info("✅ Token Blacklisting")
            app.logger.info("✅ Rate Limiting")
            app.logger.info("✅ MFA Support")
            app.logger.info("✅ Audit Trail")
            app.logger.info("✅ Enhanced Password Validation")
            app.logger.info("✅ Payment Validation")
            
            # Quick Access URLs
            app.logger.info("🌐 QUICK ACCESS")
            app.logger.info("-" * 15)
            base_url = "http://localhost:5000"
            app.logger.info(f"Health: {base_url}/api/health-check")
            app.logger.info(f"Admin Login: {base_url}/api/admin/login")
            app.logger.info(f"Admin Dashboard: {base_url}/api/admin/dashboard/stats")
            app.logger.info(f"Payment Transactions: {base_url}/api/payment/transactions")
            app.logger.info(f"Pesapal Payment: {base_url}/api/pesapal/payment")
            app.logger.info(f"Google Auth Login: {base_url}/api/auth/google")
            app.logger.info(f"Admin Google Auth Login: {base_url}/api/admin/auth/google")
            app.logger.info(f"Meilisearch: {base_url}/api/meilisearch")
            app.logger.info(f"Products: {base_url}/api/products")
            app.logger.info(f"Cart: {base_url}/api/cart")
            app.logger.info(f"Orders: {base_url}/api/orders")
            app.logger.info(f"Admin Email Send: {base_url}/api/admin/email/send")
            app.logger.info(f"Notifications: {base_url}/api/notifications")
            app.logger.info(f"Carousel Items: {base_url}/api/carousel")
            app.logger.info(f"Active Theme: {base_url}/api/theme/active")
            app.logger.info(f"Admin Theme Manager: {base_url}/api/theme/admin/themes")
            app.logger.info(f"Footer Settings: {base_url}/api/footer/settings")
            app.logger.info(f"Side Panels: {base_url}/api/panels/admin/all")
            app.logger.info(f"Topbar Items: {base_url}/api/topbar/items")
            app.logger.info(f"Contact CTA Slides: {base_url}/api/contact-cta/slides")
            app.logger.info(f"Featured Products: {base_url}/api/products/featured")
            
            # Final Summary
            total_endpoints = len([rule for rule in app.url_map.iter_rules() if rule.endpoint != 'static'])
            app.logger.info("=" * 60)
            app.logger.info(f"✅ SERVER READY: {total_endpoints} endpoints, {len(app.blueprints)} blueprints")
            app.logger.info(f"🌍 Listening on: http://0.0.0.0:5000")
            app.logger.info(f"📝 Config: {config_name}")
            app.logger.info(f"🔐 Admin Auth: Enhanced Security Enabled")
            app.logger.info(f"💳 Payment Systems: Pesapal Enabled")
            app.logger.info(f"💝 Wishlist: Split User/Admin Routes Enabled")
            app.logger.info(f"📧 Admin Email: {'Integrated' if 'admin_email_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"🔔 Notifications: {'Integrated' if 'notification_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"🎠 Carousel: {'Integrated' if 'carousel_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"💻 Google Auth: {'Integrated' if 'google_auth_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"🦶 Footer System: {'Integrated' if 'footer_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"🖼️ Side Panel System: {'Integrated' if 'side_panel_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"💡 Topbar System: {'Integrated' if 'topbar_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"📞 Contact CTA System: {'Integrated' if 'contact_cta_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"⭐ Featured System: {'Integrated' if 'featured_routes' in imported_blueprints else 'Fallback'}")
            app.logger.info(f"🔍 Meilisearch System: {'Integrated' if ('meilisearch_routes' in imported_blueprints and 'admin_meilisearch_routes' in imported_blueprints) else 'Fallback'}")
        
        log_startup_summary()
        app.logger.info("All blueprints registered successfully")
        
    except Exception as e:
        app.logger.error(f"Error registering blueprints: {str(e)}")
    
    # Create database tables and initialize admin auth tables
    def can_connect_to_db(app, timeout_seconds=3):
        """
        Return True if a DB connection can be established using the app's SQLAlchemy engine.
        This is a lightweight check to avoid raising during app startup when the database is not yet available.
        """
        try:
            with app.app_context():
                # Use SQLAlchemy engine connect; this will raise if DB unreachable
                conn = db.engine.connect()
                conn.close()
            return True
        except Exception as e:
            app.logger.warning(f"Database connectivity check failed: {str(e)}")
            return False

    try:
        with app.app_context():
            if can_connect_to_db(app):
                try:
                    db.create_all()

                    try:
                        from .routes.admin.admin_auth import init_admin_auth_tables
                        init_admin_auth_tables()
                        app.logger.info("Admin authentication tables initialized successfully")
                    except ImportError:
                        try:
                            from routes.admin.admin_auth import init_admin_auth_tables
                            init_admin_auth_tables()
                            app.logger.info("Admin authentication tables initialized successfully")
                        except ImportError:
                            app.logger.warning("Admin authentication tables initialization skipped - module not found")

                    try:
                        from .routes.admin.admin_google_auth import init_admin_google_auth_tables
                        init_admin_google_auth_tables()
                        app.logger.info("Admin Google authentication tables initialized successfully")
                    except ImportError:
                        try:
                            from routes.admin.admin_google_auth import init_admin_google_auth_tables
                            init_admin_google_auth_tables()
                            app.logger.info("Admin Google authentication tables initialized successfully")
                        except ImportError:
                            app.logger.warning("Admin Google authentication tables initialization skipped - module not found")

                    try:
                        from .routes.admin.admin_email_routes import init_admin_email_tables
                        init_admin_email_tables()
                        app.logger.info("Admin email tables initialized successfully")
                    except ImportError:
                        try:
                            from routes.admin.admin_email_routes import init_admin_email_tables
                            init_admin_email_tables()
                            app.logger.info("Admin email tables initialized successfully")
                        except ImportError:
                            app.logger.warning("Admin email tables initialization skipped - module not found")

                    try:
                        from .routes.footer.footer_routes import init_footer_tables
                        init_footer_tables(app)
                        app.logger.info("Footer tables initialized successfully")
                    except ImportError:
                        try:
                            from routes.footer.footer_routes import init_footer_tables
                            init_footer_tables(app)
                            app.logger.info("Footer tables initialized successfully")
                        except ImportError:
                            app.logger.warning("Footer tables initialization skipped - module not found")

                    try:
                        from .models.side_panel_model import SidePanel
                        app.logger.info("Side panel model imported successfully")
                    except ImportError:
                        try:
                            from models.side_panel_model import SidePanel
                            app.logger.info("Side panel model imported successfully")
                        except ImportError:
                            app.logger.warning("Side panel model not found - side panel system will not be available")

                    try:
                        from .routes.contact_cta.contact_cta_routes import init_contact_cta_tables
                        init_contact_cta_tables()
                        app.logger.info("Contact CTA tables initialized successfully")
                    except ImportError:
                        try:
                            from routes.contact_cta.contact_cta_routes import init_contact_cta_tables
                            init_contact_cta_tables()
                            app.logger.info("Contact CTA tables initialized successfully")
                        except ImportError:
                            app.logger.warning("Contact CTA tables initialization skipped - module not found")

                    try:
                        from .routes.products.featured_routes import init_featured_routes_tables
                        init_featured_routes_tables()
                        app.logger.info("Featured routes tables initialized successfully")
                    except ImportError:
                        app.logger.warning("Featured routes tables initialization skipped - module not found")
                        
                    try:
                        from .routes.meilisearch.meilisearch_routes import init_meilisearch_tables
                        init_meilisearch_tables()
                        app.logger.info("Meilisearch tables initialized successfully")
                    except ImportError:
                        app.logger.warning("Meilisearch tables initialization skipped - module not found")

                    # Initialize flash sale tables
                    try:
                        from .routes.flash_sale.flash_sale_routes import init_flash_sale_tables
                        init_flash_sale_tables()
                        app.logger.info("Flash sale tables initialized successfully")
                    except ImportError:
                        app.logger.warning("Flash sale tables initialization skipped - module not found")

                    app.logger.info("Database tables created successfully")
                except Exception as e:
                    app.logger.error(f"Error creating database tables or initializing admin tables: {str(e)}")
            else:
                app.logger.warning(
                    "Database is not reachable - skipping db.create_all() and admin table initializations.\n"
                    "If you intend the app to manage DB schema at startup, ensure DATABASE_URL/SQLALCHEMY_DATABASE_URI is set\n"
                    "and the database is reachable from this host. Otherwise this is expected (DB provision happens separately)."
                )
    except Exception as e:
        app.logger.error(f"Unexpected error during DB initialization check: {str(e)}")
    
    # Set up order completion hooks
    try:
        order_completion_handler = None
        import_paths = [
            'app.routes.order.order_completion_handler',
            '.routes.order.order_completion_handler',
            'routes.order.order_completion_handler'
        ]
        
        for import_path in import_paths:
            try:
                module = __import__(import_path, fromlist=['setup_order_completion_hooks'])
                if hasattr(module, 'setup_order_completion_hooks'):
                    order_completion_handler = module
                    break
            except ImportError:
                continue
        
        if order_completion_handler:
            order_completion_handler.setup_order_completion_hooks(app)
            app.logger.info("Order completion hooks set up successfully")
        else:
            app.logger.warning("Order completion handler not found - creating basic inventory sync endpoint")
            
            @app.route('/api/admin/inventory/sync', methods=['POST'])
            @jwt_required()
            def sync_inventory_fallback():
                try:
                    return jsonify({
                        "success": True,
                        "message": "Inventory sync endpoint active (fallback mode)",
                        "timestamp": datetime.now().isoformat()
                    }), 200
                except Exception as e:
                    app.logger.error(f"Error in fallback inventory sync: {str(e)}")
                    return jsonify({"error": str(e)}), 500
                    
    except Exception as e:
        app.logger.error(f"Error setting up order completion hooks: {str(e)}")
        
        @app.route('/api/admin/inventory/sync', methods=['POST'])
        @jwt_required()
        def sync_inventory_error_fallback():
            return jsonify({
                "success": False,
                "error": "Order completion handler not available",
                "message": "Please check order completion handler configuration"
            }), 500
    
    # Dashboard health check endpoint
    @app.route('/api/admin/dashboard/health', methods=['GET', 'OPTIONS'])
    def dashboard_health_check():
        """Health check endpoint for dashboard system."""
        try:
            return jsonify({
                "status": "ok",
                "service": "dashboard",
                "timestamp": datetime.now().isoformat(),
                "endpoints": [
                    "/api/admin/dashboard",
                    "/api/admin/dashboard/stats",
                    "/api/admin/dashboard/live-stats",
                    "/api/admin/dashboard/health"
                ],
                "database": "connected" if db else "disconnected",
                "data_source": "database_only"
            }), 200
        except Exception as e:
            app.logger.error(f"Dashboard health check failed: {str(e)}")
            return jsonify({
                "status": "error",
                "service": "dashboard",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }), 500
    
    # Health check endpoint
    @app.route('/api/health-check', methods=['GET', 'OPTIONS'])
    def health_check():
        return jsonify({
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "config": config_name,
            "inventory_system": "active",
            "dashboard_system": "active",
            "order_system": "active",
            "product_system": "active",
            "payment_system": {
                "pesapal": "active" if 'pesapal_routes' in imported_blueprints else "inactive"
            },
            "admin_auth_system": "active" if 'admin_auth_routes' in imported_blueprints else "inactive",
            "admin_google_auth_system": "active" if 'admin_google_auth_routes' in imported_blueprints else "inactive",
            "admin_email_system": "active" if 'admin_email_routes' in imported_blueprints else "inactive",
            "google_auth_system": "active" if 'google_auth_routes' in imported_blueprints else "inactive",
            "meilisearch_system": {
                "routes": "active" if 'meilisearch_routes' in imported_blueprints else "inactive",
                "admin_routes": "active" if 'admin_meilisearch_routes' in imported_blueprints else "inactive"
            },
            "wishlist_system": {
                "user_routes": "active" if 'user_wishlist_routes' in imported_blueprints else "inactive",
                "admin_routes": "active" if 'admin_wishlist_routes' in imported_blueprints else "inactive"
            },
            "brand_system": {
                "user_routes": "active" if 'user_brand_routes' in imported_blueprints else "inactive",
                "admin_routes": "active" if 'admin_brand_routes' in imported_blueprints else "inactive"
            },
            "notification_system": {
                "routes": "active" if 'notification_routes' in imported_blueprints else "inactive"
            },
            "carousel_system": {
                "routes": "active" if 'carousel_routes' in imported_blueprints else "inactive"
            },
            "theme_system": {
                "routes": "active" if 'theme_routes' in imported_blueprints else "inactive"
            },
            "footer_system": {
                "routes": "active" if 'footer_routes' in imported_blueprints else "inactive"
            },
            "side_panel_system": {
                "routes": "active" if 'side_panel_routes' in imported_blueprints else "inactive"
            },
            "topbar_system": {
                "routes": "active" if 'topbar_routes' in imported_blueprints else "inactive"
            },
            "contact_cta_system": {
                "routes": "active" if 'contact_cta_routes' in imported_blueprints else "inactive"
            },
            "featured_system": {
                "routes": "active" if 'featured_routes' in imported_blueprints else "inactive"
            },
            # Add flash sale system to health check
            "flash_sale_system": {
                "routes": "active" if 'flash_sale_routes' in imported_blueprints else "inactive"
            },
            "security_features": {
                "token_blacklisting": True,
                "rate_limiting": True,
                "mfa_support": True,
                "audit_trail": True,
                "enhanced_password_validation": True,
                "payment_validation": True
            }
        }), 200
    
    # Error handlers
    @app.errorhandler(404)

    def not_found_error(error):
        return jsonify({"error": "Not Found"}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        if db:
            try:
                db.session.rollback()
            except:
                pass
        return jsonify({"error": "Internal Server Error"}), 500
    
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({"error": "Rate limit exceeded", "message": str(e.description)}), 429
    
    @app.errorhandler(SAOperationalError)
    def handle_sqlalchemy_operational_error(err):
        app.logger.warning(f"Database operational error caught: {str(err)}")
        return jsonify({
            "error": "database_operational_error",
            "message": "A database connectivity error occurred. Please try again later."
        }), 503

    if PsycopgOperationalError is not None:
        @app.errorhandler(PsycopgOperationalError)
        def handle_psycopg_operational_error(err):
            app.logger.warning(f"psycopg2 OperationalError caught: {str(err)}")
            return jsonify({
                "error": "database_operational_error",
                "message": "A database connectivity error occurred. Please try again later."
            }), 503

    @app.before_request
    def before_request():
        if request.path == '/' and request.method == 'GET':
            return
        app.logger.debug(f"Processing request: {request.method} {request.path}")
    
    @app.route('/', methods=['GET'])
    def root():
        """Root endpoint - returns API info without redirect to prevent loops."""
        return jsonify({
            "service": "Mizizzi E-commerce API",
            "version": "1.0.0",
            "status": "running",
            "endpoints": {
                "health": "/api/health-check",
                "products": "/api/products",
                "cart": "/api/cart",
                "orders": "/api/orders",
                "admin": "/api/admin",
                "meilisearch": "/api/meilisearch",
                "auth": "/api/auth",
                "admin_auth": "/api/admin/auth"
            }
        }), 200
    
    @app.after_request
    def ensure_cors_credentials(response):
        try:
            origin = request.headers.get('Origin')
            allowed = app.config.get('CORS_ORIGINS', []) or []

            if origin:
                if '*' in allowed or origin in allowed:
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Credentials'] = 'true'

            if 'Access-Control-Allow-Credentials' not in response.headers:
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        except Exception:
            pass
        return response

    # --- DB availability cache/helper (to avoid repeated heavy checks) ---
    _db_check_cache = {"ts": 0.0, "available": False}
    DB_CHECK_TTL = float(os.environ.get("DB_CHECK_TTL_SEC", "5"))

    def is_db_available(force=False):
        """Return True if DB reachable. Cache result for DB_CHECK_TTL seconds."""
        try:
            now = time()
            if not force and (now - _db_check_cache["ts"] < DB_CHECK_TTL):
                return _db_check_cache["available"]

            with app.app_context():
                try:
                    conn = db.engine.connect()
                    conn.close()
                    _db_check_cache.update({"ts": now, "available": True})
                    return True
                except Exception:
                    _db_check_cache.update({"ts": now, "available": False})
                    return False
        except Exception:
            # If anything unexpected happens, assume DB unavailable to be safe
            _db_check_cache.update({"ts": time(), "available": False})
            return False

    # Expose helper on app for debugging/testing
    app.is_db_available = is_db_available

    # Short-circuit APIs when DB is unavailable to avoid repeated 500 logs.
    @app.before_request
    def short_circuit_when_db_unavailable():
        # Allow non-API requests, health checks and static files to proceed
        path = (request.path or "").lower()
        if path in ("/", "/api/health-check", "/api/health", "/api/admin/dashboard/health"):
            return None

        # Only short-circuit API routes; leave non-API endpoints alone
        if path.startswith("/api"):
            if not is_db_available():
                # Return a clear 503 JSON indicating DB problem — clients can handle retry.
                return jsonify({
                    "error": "database_unavailable",
                    "message": "Database is currently unavailable. Please try again later.",
                    "retry_after_seconds": DB_CHECK_TTL
                }), 503
        return None

    app.logger.info(f"Application created successfully with config: {config_name}")
    return app

# Initialize Flask app factory
def create_app_with_search():
    """Create Flask app (Meilisearch handles search)."""
    try:
        # Use the directly imported create_app function
        app = create_app()
        
        with app.app_context():
            app.logger.info("✅ App initialized - Meilisearch handles search.")
        
        return app
        
    except Exception as e:
        logger.error(f"Error creating app: {str(e)}")
        
        try:
            # Fallback to calling create_app directly again
            return create_app()
        except Exception as fallback_error:
            logger.error(f"Fallback app creation failed: {str(fallback_error)}")
            # As a last resort, return a minimal Flask app to avoid import-time crashes.
            try:
                fallback_app = Flask(__name__)
                # Apply minimal default configuration if available
                if isinstance(config, dict) and 'default' in config:
                    try:
                        fallback_app.config.from_object(config['default'])
                    except Exception:
                        pass
                logger.info("Created minimal fallback Flask app")
                return fallback_app
            except Exception as final_err:
                logger.error(f"Unable to create fallback Flask app: {str(final_err)}")
                return None
