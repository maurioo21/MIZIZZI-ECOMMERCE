#!/usr/bin/env python3
"""
Main entry point for running the Mizizzi E-commerce Flask application.
Cleaned and simplified: minimal logging, dotenv support, import create_app from common locations,
and start either app.socketio.run(...) or app.run(...).
"""
import os
import sys
import logging
from pathlib import Path
import ast
import traceback

# Optional dotenv loader (no-op fallback)
try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(*args, **kwargs):
        return None

def import_create_app():
    """Try common locations for create_app and return the function or None."""
    backend_dir = Path(__file__).parent
    sys.path.insert(0, str(backend_dir))
    try:
        from app import create_app
        return create_app
    except Exception as e:
        # Print traceback to stderr to help debugging import-time failures (missing deps, syntax errors)
        print("Error importing 'app' (from top-level):", file=sys.stderr)
        traceback.print_exc()
        try:
            from .app import create_app
            return create_app
        except Exception as e2:
            print("Error importing 'app' (from package-relative):", file=sys.stderr)
            traceback.print_exc()
            return None

def _normalize_env_value(val: str):
	"""
	If val is a string representation of a 2-tuple like "('KEY','value')" or "('KEY', 'value')",
	return (key, value). Otherwise return None.
	"""
	try:
		if isinstance(val, str) and val.startswith("(") and val.endswith(")"):
			obj = ast.literal_eval(val)
			if isinstance(obj, tuple) and len(obj) == 2 and all(isinstance(x, str) for x in obj):
				return obj
	except Exception:
		return None
	return None

def normalize_env(logger=None):
	"""Detect and fix environment variables that were accidentally stored as tuple-like strings."""
	_fixed = []
	for k, v in list(os.environ.items()):
		res = _normalize_env_value(v)
		if res:
			key, value = res
			# Only apply if tuple indicates an env key/value pair
			if key and value:
				# set the intended key to the proper string value
				os.environ[key] = value
				_fixed.append((k, key))
				if logger:
					logger.info("Normalized env var from %r -> set %r", k, key)
	# return list of fixes for tests/logging
	return _fixed

def main():
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    logger = logging.getLogger("run")

    # Normalize environment early (fix tuple-like string encodings such as "('DATABASE_URL','...')")
    try:
        normalize_env(logger)
    except Exception:
        logger.debug("Environment normalization encountered an error, continuing", exc_info=True)

    create_app = import_create_app()
    if not create_app:
        logger.error("Could not find create_app in app or backend.app. Aborting.")
        sys.exit(1)

    try:
        app = create_app(config_name=os.environ.get('FLASK_CONFIG', 'development'), enable_socketio=True)
    except Exception as e:
        logger.exception("Error while creating Flask application: %s", e)
        sys.exit(1)

    if app is None:
        logger.error("create_app returned None. Aborting.")
        sys.exit(1)

    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    # Default to False unless FLASK_DEBUG explicitly set to 'true'
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'

    try:
        if hasattr(app, 'socketio') and getattr(app, 'socketio') is not None:
            logger.info("Starting app with SocketIO on %s:%s (debug=%s)", host, port, debug)
            app.socketio.run(app, host=host, port=port, debug=debug, use_reloader=debug, allow_unsafe_werkzeug=True)
        else:
            logger.info("Starting Flask app on %s:%s (debug=%s)", host, port, debug)
            app.run(host=host, port=port, debug=debug, use_reloader=debug)
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.exception("Unhandled error while running server: %s", e)
        sys.exit(1)

if __name__ == '__main__':
    main()
