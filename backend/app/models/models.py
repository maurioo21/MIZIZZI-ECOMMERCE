"""
Updated Model Classes for Mizizzi E-Commerce Backend with Guest Cart Support and AI Search
"""
from ..configuration.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.sql import func
from sqlalchemy import Enum as SQLEnum, Text, LargeBinary
import enum
from datetime import datetime, timezone, UTC
import datetime as dt  # Import datetime module as dt to avoid confusion
import json
import random
import string
import uuid  # Add this import

# ----------------------
# Enums for standardization
# ----------------------
class UserRole(enum.Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"

class OrderStatus(enum.Enum):
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    PROCESSING = 'processing'
    SHIPPED = 'shipped'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'
    REFUNDED = 'refunded'
    RETURNED = 'returned'

class PaymentStatus(enum.Enum):
    PENDING = 'pending'
    PAID = 'paid'
    COMPLETED = 'completed'
    FAILED = 'failed'
    REFUNDED = 'refunded'

class CouponType(enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class AddressType(enum.Enum):
    SHIPPING = "shipping"
    BILLING = "billing"
    BOTH = "both"

# ----------------------
# Security Models for Enhanced Features
# ----------------------
class TokenBlacklist(db.Model):
    """Model to store blacklisted JWT tokens."""
    __tablename__ = 'token_blacklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(10), nullable=False)  # 'access' or 'refresh'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    revoked_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    expires_at = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(100))  # 'logout', 'password_change', 'security'

    def __repr__(self):
        return f'<TokenBlacklist {self.jti}>'

class AdminActivityLog(db.Model):
    """Model to store admin activity logs for audit trail."""
    __tablename__ = 'admin_activity_logs'

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))  # IPv6 support
    user_agent = db.Column(db.Text)
    endpoint = db.Column(db.String(200))
    method = db.Column(db.String(10))
    status_code = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), index=True)

    # Relationship
    admin = db.relationship('User', backref=db.backref('activity_logs', lazy=True))

    def __repr__(self):
        return f'<AdminActivityLog {self.admin_id}: {self.action}>'

    def to_dict(self):
        return {
            'id': self.id,
            'admin_id': self.admin_id,
            'action': self.action,
            'details': self.details,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'endpoint': self.endpoint,
            'method': self.method,
            'status_code': self.status_code,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AdminMFA(db.Model):
    """Model to store admin MFA settings."""
    __tablename__ = 'admin_mfa'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    secret_key = db.Column(db.String(32), nullable=False)
    is_enabled = db.Column(db.Boolean, default=False)
    backup_codes = db.Column(db.JSON)  # List of backup codes
    last_used_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    # Relationship
    user = db.relationship('User', backref=db.backref('mfa_settings', uselist=False))

    def __repr__(self):
        return f'<AdminMFA {self.user_id}>'

    def generate_backup_codes(self, count=10):
        """Generate backup codes for MFA."""
        codes = []
        for _ in range(count):
            code = ''.join(random.choices(string.digits, k=8))
            codes.append(code)
        self.backup_codes = codes
        return codes

    def verify_backup_code(self, code):
        """Verify and consume a backup code."""
        if not self.backup_codes or code not in self.backup_codes:
            return False

        # Remove the used backup code
        self.backup_codes.remove(code)
        db.session.commit()
        return True

# ----------------------
# User Model
# ----------------------
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    phone = db.Column(db.String(20))
    address = db.Column(db.JSON)
    avatar_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    last_login = db.Column(db.DateTime)

    # Add verification fields
    email_verified = db.Column(db.Boolean, default=False)
    phone_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(10))
    verification_code_expires = db.Column(db.DateTime)
    last_verification_email_sent = db.Column(db.DateTime)  # Track when last verification email was sent
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime)
    is_google_user = db.Column(db.Boolean, default=False)

    # Relationships with cascade deletes
    orders = db.relationship('Order', backref='user', lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship('Review', backref='user', lazy=True, cascade="all, delete-orphan")
    cart_items = db.relationship('CartItem', backref='user', lazy=True, cascade="all, delete-orphan")
    wishlist_items = db.relationship('WishlistItem', backref='user', lazy=True, cascade="all, delete-orphan")
    carts = db.relationship('Cart', back_populates='user', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role.value,
            'phone': self.phone,
            'address': self.address,
            'avatar_url': self.avatar_url,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'email_verified': self.email_verified,
            'phone_verified': self.phone_verified,
        }

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password: str) -> bool:
        """Enhanced password verification with additional security checks."""
        if not self.password_hash:
            return False
        
        if not password or not isinstance(password, str) or len(password.strip()) == 0:
            return False
            
        try:
            # Use constant-time comparison to prevent timing attacks
            result = check_password_hash(self.password_hash, password)
            return result
        except Exception as e:
            # Log the error but don't reveal details
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Password verification error for user {self.id}: {str(e)}")
            return False

    def set_verification_code(self, code: str, is_phone: bool = False):
        """Set verification code and expiry time (10 minutes from now)"""
        self.verification_code = code
        # Use timezone-aware datetime
        self.verification_code_expires = datetime.now(timezone.utc) + dt.timedelta(minutes=10)

    def verify_verification_code(self, code: str, is_phone: bool = False) -> bool:
        """Verify the provided code against stored code and check if it's still valid"""
        if not self.verification_code or not self.verification_code_expires:
            return False

        # Check if code has expired using timezone-aware datetime
        if datetime.now(timezone.utc) > self.verification_code_expires:
            return False

        # Check if code matches
        return self.verification_code == code

# ----------------------
# VerificationCode Model
# ----------------------
class VerificationCode(db.Model):
    __tablename__ = 'verification_codes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    code_type = db.Column(db.String(20), nullable=False)  # 'email' or 'phone'
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=func.now())
    used_at = db.Column(db.DateTime)

    # Relationship
    user = db.relationship('User', backref=db.backref('verification_codes_rel', lazy=True, cascade="all, delete-orphan"))

    def __repr__(self):
        return f"<VerificationCode {self.code} for User {self.user_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'code': self.code,
            'code_type': self.code_type,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_used': self.is_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'used_at': self.used_at.isoformat() if self.used_at else None
        }

    def is_expired(self):
        """Check if the verification code has expired"""
        return datetime.now(timezone.utc) > self.expires_at

    def is_valid(self):
        """Check if the verification code is valid (not used and not expired)"""
        return not self.is_used and not self.is_expired()

    def mark_as_used(self):
        """Mark the verification code as used"""
        self.is_used = True
        self.used_at = datetime.now(timezone.utc)

# ----------------------
# ADDRESS Model
# ----------------------
class Address(db.Model):
    __tablename__ = 'addresses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    address_line1 = db.Column(db.String(255), nullable=False)
    address_line2 = db.Column(db.String(255))
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    postal_code = db.Column(db.String(20), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    alternative_phone = db.Column(db.String(20))
    address_type = db.Column(db.Enum(AddressType), default=AddressType.BOTH, nullable=False)
    is_default = db.Column(db.Boolean, default=False)
    additional_info = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationship with User
    user = db.relationship('User', backref=db.backref('addresses', lazy=True, cascade="all, delete-orphan"))

    def __repr__(self):
        return f"<Address {self.id} for User {self.user_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'address_line1': self.address_line1,
            'address_line2': self.address_line2,
            'city': self.city,
            'state': self.state,
            'postal_code': self.postal_code,
            'country': self.country,
            'phone': self.phone,
            'alternative_phone': self.alternative_phone,
            'address_type': self.address_type.value,
            'is_default': self.is_default,
            'additional_info': self.additional_info,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# ----------------------
# Cart Model
# ----------------------
class Cart(db.Model):
    __tablename__ = 'carts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Nullable for guest carts
    guest_id = db.Column(db.String(36), nullable=True, index=True)  # UUID for guest carts
    is_active = db.Column(db.Boolean, default=True)
    subtotal = db.Column(db.Float, default=0.0)
    tax = db.Column(db.Float, default=0.0)
    shipping = db.Column(db.Float, default=0.0)
    discount = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, default=0.0)
    coupon_code = db.Column(db.String(50))
    shipping_method_id = db.Column(db.Integer, db.ForeignKey('shipping_methods.id'))
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'))
    shipping_address_id = db.Column(db.Integer, db.ForeignKey('addresses.id'))
    billing_address_id = db.Column(db.Integer, db.ForeignKey('addresses.id'))
    same_as_shipping = db.Column(db.Boolean, default=True)
    requires_shipping = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    last_activity = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    expires_at = db.Column(db.DateTime, nullable=True)  # Add this line for cart expiration

    # Relationships
    user = db.relationship('User', back_populates='carts', foreign_keys=[user_id])
    items = db.relationship('CartItem', backref='cart', lazy=True, cascade="all, delete-orphan")
    shipping_address = db.relationship('Address', foreign_keys=[shipping_address_id])
    billing_address = db.relationship('Address', foreign_keys=[billing_address_id])
    shipping_method = db.relationship('ShippingMethod')
    payment_method = db.relationship('PaymentMethod')

    def __repr__(self):
        if self.user_id:
            return f"<Cart {self.id} for User {self.user_id}>"
        else:
            return f"<Guest Cart {self.id} ({self.guest_id})>"

    def update_totals(self):
        """Update cart totals based on items, shipping, and discounts."""
        from sqlalchemy import func

        # Calculate subtotal from cart items
        result = db.session.query(func.sum(CartItem.price * CartItem.quantity)).filter(
            CartItem.cart_id == self.id
        ).first()

        self.subtotal = float(result[0] or 0.0)

        # Calculate tax (if applicable)
        tax_rate = 0.0  # This could be configurable or based on location
        self.tax = self.subtotal * tax_rate

        # Calculate shipping cost (if applicable)
        if self.shipping_method_id and self.requires_shipping:
            shipping_method = ShippingMethod.query.get(self.shipping_method_id)
            if shipping_method:
                self.shipping = float(shipping_method.cost)
        else:
            self.shipping = 0.0

        # Apply discount if coupon is applied
        if self.coupon_code:
            coupon = Coupon.query.filter_by(code=self.coupon_code, is_active=True).first()
            if coupon:
                if coupon.type == CouponType.PERCENTAGE:
                    self.discount = self.subtotal * (float(coupon.value) / 100)
                    if coupon.max_discount and self.discount > float(coupon.max_discount):
                        self.discount = float(coupon.max_discount)
                else:  # Fixed amount
                    self.discount = float(coupon.value)
        else:
            self.discount = 0.0

        # Calculate total
        self.total = self.subtotal + self.tax + self.shipping - self.discount

        # Ensure total is not negative
        if self.total < 0:
            self.total = 0.0

    def to_dict(self):
        """Convert cart to dictionary for API responses."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'guest_id': self.guest_id,
            'is_guest': self.guest_id is not None,
            'is_active': self.is_active,
            'subtotal': self.subtotal,
            'tax': self.tax,
            'shipping': self.shipping,
            'discount': self.discount,
            'total': self.total,
            'coupon_code': self.coupon_code,
            'shipping_method_id': self.shipping_method_id,
            'payment_method_id': self.payment_method_id,
            'shipping_address_id': self.shipping_address_id,
            'billing_address_id': self.billing_address_id,
            'same_as_shipping': self.same_as_shipping,
            'requires_shipping': self.requires_shipping,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }

    def get_item_count(self):
        """Get the total number of items in the cart."""
        from sqlalchemy import func

        result = db.session.query(func.sum(CartItem.quantity)).filter(
            CartItem.cart_id == self.id
        ).first()

        return result[0] or 0

    def has_digital_products(self):
        """Check if the cart contains any digital products."""
        for item in self.items:
            product = Product.query.get(item.product_id)
            if product and product.is_digital:
                return True
        return False

    def has_physical_products(self):
        """Check if the cart contains any physical products."""
        for item in self.items:
            product = Product.query.get(item.product_id)
            if product and not product.is_digital:
                return True
        return False

    def get_weight(self):
        """Calculate the total weight of the cart."""
        total_weight = 0.0
        for item in self.items:
            product = Product.query.get(item.product_id)
            if product and product.weight:
                total_weight += product.weight * item.quantity
        return total_weight

    def is_empty(self):
        """Check if the cart is empty."""
        return len(self.items) == 0

    def merge_with_user_cart(self, user_id):
        """
        Merge this guest cart with a user's cart.
        Used when a guest logs in and has items in their cart.

        Args:
            user_id: The ID of the user to merge with

        Returns:
            The user's cart with merged items
        """
        # Find user's active cart or create one
        user_cart = Cart.query.filter_by(user_id=user_id, is_active=True).first()

        if not user_cart:
            # Create new cart for user
            user_cart = Cart(user_id=user_id, is_active=True)
            db.session.add(user_cart)
            db.session.commit()

        # Get all items from guest cart
        guest_items = CartItem.query.filter_by(cart_id=self.id).all()

        # Transfer items to user cart
        for guest_item in guest_items:
            # Check if item already exists in user cart
            existing_item = CartItem.query.filter_by(
                cart_id=user_cart.id,
                product_id=guest_item.product_id,
                variant_id=guest_item.variant_id
            ).first()

            if existing_item:
                # Update quantity
                existing_item.quantity += guest_item.quantity
            else:
                # Create new cart item
                new_item = CartItem(
                    cart_id=user_cart.id,
                    user_id=user_id,
                    product_id=guest_item.product_id,
                    variant_id=guest_item.variant_id,
                    quantity=guest_item.quantity,
                    price=guest_item.price
                )
                db.session.add(new_item)

        # Transfer other cart properties
        if self.coupon_code and not user_cart.coupon_code:
            user_cart.coupon_code = self.coupon_code

        if self.shipping_method_id and not user_cart.shipping_method_id:
            user_cart.shipping_method_id = self.shipping_method_id

        if self.payment_method_id and not user_cart.payment_method_id:
            user_cart.payment_method_id = self.shipping_method_id

        if self.notes and not user_cart.notes:
            user_cart.notes = self.notes

        # Update cart totals
        user_cart.update_totals()

        # Mark guest cart as inactive
        self.is_active = False

        db.session.commit()

        return user_cart

# ----------------------
# CartItem Model
# ----------------------
class CartItem(db.Model):
    __tablename__ = 'cart_items'

    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey('carts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Nullable for guest cart items
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'))
    quantity = db.Column(db.Integer, nullable=False, default=1)
    price = db.Column(db.Float, nullable=False)  # Store the price at the time of adding to cart
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    product = db.relationship('Product')
    variant = db.relationship('ProductVariant')

    def __repr__(self):
        return f"<CartItem {self.id} for Cart {self.cart_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'cart_id': self.cart_id,
            'user_id': self.user_id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'quantity': self.quantity,
            'price': self.price,
            'subtotal': self.price * self.quantity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# ----------------------
# Category Model
# ----------------------
class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(255))  # Cloudinary secure_url for category image
    image_public_id = db.Column(db.String(255), nullable=True)  # Cloudinary public_id for image deletion/management
    banner_url = db.Column(db.String(255))  # Cloudinary secure_url for banner image
    banner_public_id = db.Column(db.String(255), nullable=True)  # Cloudinary public_id for banner deletion/management
    image_data = db.Column(db.LargeBinary, nullable=True)  # Store image as binary
    image_filename = db.Column(db.String(255), nullable=True)  # Original filename
    image_mimetype = db.Column(db.String(50), nullable=True)  # MIME type (image/jpeg, etc.)
    banner_data = db.Column(db.LargeBinary, nullable=True)  # Store banner as binary
    banner_filename = db.Column(db.String(255), nullable=True)  # Original banner filename
    banner_mimetype = db.Column(db.String(50), nullable=True)  # Banner MIME type
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), index=True)
    is_featured = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    subcategories = db.relationship(
        'Category',
        backref=db.backref('parent', remote_side=[id]),
        cascade="all, delete-orphan",
        lazy='select'
    )
    products = db.relationship('Product', back_populates='category', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Category {self.name}>"

    def __str__(self):
        return self.name

    def to_dict(self, include_subcategories=False):
        data = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            # PRIORITY: Use Cloudinary URL directly if available, fallback to backend endpoint
            'image_url': self.image_url if self.image_url else (f'/api/admin/shop-categories/categories/{self.id}/image' if self.image_data else None),
            'image_public_id': self.image_public_id,
            # PRIORITY: Use Cloudinary URL directly if available, fallback to backend endpoint
            'banner_url': self.banner_url if self.banner_url else (f'/api/admin/shop-categories/categories/{self.id}/banner' if self.banner_data else None),
            'banner_public_id': self.banner_public_id,
            'parent_id': self.parent_id,
            'is_featured': self.is_featured,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_subcategories:
            data['subcategories'] = [
                sub.to_dict(include_subcategories=True) for sub in self.subcategories
            ]

        return data

# ----------------------
# Product Model (Single model with flags for flash sales, luxury deals, or regular products)
# ----------------------
class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    sale_price = db.Column(db.Numeric(10, 2), nullable=True)
    stock = db.Column(db.Integer, default=0)
    stock_quantity = db.Column(db.Integer, default=0, nullable=False)  # Add this line
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=True)
    # Changed from ARRAY to TEXT for SQLite compatibility
    image_urls = db.Column(db.Text, nullable=True)  # JSON string of image URLs
    thumbnail_url = db.Column(db.String(255), nullable=True)
    is_featured = db.Column(db.Boolean, default=False)
    is_new = db.Column(db.Boolean, default=False)
    is_sale = db.Column(db.Boolean, default=False)
    is_flash_sale = db.Column(db.Boolean, default=False)
    is_luxury_deal = db.Column(db.Boolean, default=False)
    
    is_trending = db.Column(db.Boolean, default=False)
    is_top_pick = db.Column(db.Boolean, default=False)
    is_daily_find = db.Column(db.Boolean, default=False)
    is_new_arrival = db.Column(db.Boolean, default=False)
    
    is_active = db.Column(db.Boolean, default=True)
    sku = db.Column(db.String(100), unique=True, nullable=True)
    weight = db.Column(db.Float, nullable=True)
    dimensions = db.Column(db.JSON, nullable=True)
    meta_title = db.Column(db.String(255), nullable=True)
    meta_description = db.Column(db.Text, nullable=True)
    short_description = db.Column(db.Text, nullable=True)
    specifications = db.Column(db.JSON, nullable=True)
    warranty_info = db.Column(db.Text, nullable=True)
    shipping_info = db.Column(db.Text, nullable=True)
    availability_status = db.Column(db.String(50), nullable=True)
    min_order_quantity = db.Column(db.Integer, default=1)
    max_order_quantity = db.Column(db.Integer, nullable=True)
    # Changed from ARRAY to TEXT for SQLite compatibility
    related_products = db.Column(db.Text, nullable=True)  # JSON string of product IDs
    cross_sell_products = db.Column(db.Text, nullable=True)  # JSON string of product IDs
    up_sell_products = db.Column(db.Text, nullable=True)  # JSON string of product IDs
    discount_percentage = db.Column(db.Float, nullable=True)
    tax_rate = db.Column(db.Float, nullable=True)
    tax_class = db.Column(db.String(100), nullable=True)
    barcode = db.Column(db.String(100), nullable=True)
    manufacturer = db.Column(db.String(255), nullable=True)
    country_of_origin = db.Column(db.String(100), nullable=True)
    is_digital = db.Column(db.Boolean, default=False)
    download_link = db.Column(db.String(255), nullable=True)
    download_expiry_days = db.Column(db.Integer, nullable=True)
    is_taxable = db.Column(db.Boolean, default=True)
    is_shippable = db.Column(db.Boolean, default=True)
    requires_shipping = db.Column(db.Boolean, default=True)
    is_gift_card = db.Column(db.Boolean, default=False)
    gift_card_value = db.Column(db.Numeric(10, 2), nullable=True)
    is_customizable = db.Column(db.Boolean, default=False)
    customization_options = db.Column(db.JSON, nullable=True)
    #
    # Changed from ARRAY to TEXT for SQLite compatibility
    seo_keywords = db.Column(db.Text, nullable=True)  # JSON string of keywords
    canonical_url = db.Column(db.String(255), nullable=True)
    condition = db.Column(db.String(50), nullable=True)
    video_url = db.Column(db.String(255), nullable=True)
    is_visible = db.Column(db.Boolean, default=True)
    is_searchable = db.Column(db.Boolean, default=True)
    is_comparable = db.Column(db.Boolean, default=True)
    is_preorder = db.Column(db.Boolean, default=False)
    preorder_release_date = db.Column(db.DateTime, nullable=True)
    preorder_message = db.Column(db.Text, nullable=True)
    badge_text = db.Column(db.String(100), nullable=True)
    badge_color = db.Column(db.String(50), nullable=True)
    sort_order = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    category = db.relationship('Category', back_populates='products')
    brand = db.relationship('Brand', back_populates='products')
    variants = db.relationship('ProductVariant', backref='product', cascade='all, delete-orphan')
    reviews = db.relationship('Review', backref='product', cascade='all, delete-orphan')
    images = db.relationship('ProductImage', backref='product', cascade='all, delete-orphan')
    embeddings = db.relationship('ProductEmbedding', backref='product', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Product {self.name}>'

    # Helper methods for array-like fields
    def get_image_urls(self):
        """Get image URLs as a list"""
        if self.image_urls:
            try:
                return json.loads(self.image_urls)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_image_urls(self, urls):
        """Set image URLs from a list"""
        if urls:
            self.image_urls = json.dumps(urls)
        else:
            self.image_urls = None

    def get_related_products(self):
        """Get related product IDs as a list"""
        if self.related_products:
            try:
                return json.loads(self.related_products)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_related_products(self, product_ids):
        """Set related product IDs from a list"""
        if product_ids:
            self.related_products = json.dumps(product_ids)
        else:
            self.related_products = None

    def get_cross_sell_products(self):
        """Get cross-sell product IDs as a list"""
        if self.cross_sell_products:
            try:
                return json.loads(self.cross_sell_products)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_cross_sell_products(self, product_ids):
        """Set cross-sell product IDs from a list"""
        if product_ids:
            self.cross_sell_products = json.dumps(product_ids)
        else:
            self.cross_sell_products = None

    def get_up_sell_products(self):
        """Get up-sell product IDs as a list"""
        if self.up_sell_products:
            try:
                return json.loads(self.up_sell_products)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_up_sell_products(self, product_ids):
        """Set up-sell product IDs from a list"""
        if product_ids:
            self.up_sell_products = json.dumps(product_ids)
        else:
            self.up_sell_products = None

    def get_seo_keywords(self):
        """Get SEO keywords as a list"""
        if self.seo_keywords:
            try:
                return json.loads(self.seo_keywords)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_seo_keywords(self, keywords):
        """Set SEO keywords from a list"""
        if keywords:
            self.seo_keywords = json.dumps(keywords)
        else:
            self.seo_keywords = None

    def to_dict(self):
        """Convert product to dictionary for API responses"""
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'price': float(self.price) if self.price else None,
            'sale_price': float(self.sale_price) if self.sale_price else None,
            'stock': self.stock,
            'stock_quantity': self.stock_quantity,  # Add this line
            'category_id': self.category_id,
            'brand_id': self.brand_id,
            'image_urls': self.get_image_urls(),
            'thumbnail_url': self.thumbnail_url,
            'is_featured': self.is_featured,
            'is_new': self.is_new,
            'is_sale': self.is_sale,
            'is_flash_sale': self.is_flash_sale,
            'is_luxury_deal': self.is_luxury_deal,
            'is_trending': self.is_trending,
            'is_top_pick': self.is_top_pick,
            'is_daily_find': self.is_daily_find,
            'is_new_arrival': self.is_new_arrival,
            'is_active': self.is_active,
            'sku': self.sku,
            'weight': self.weight,
            'dimensions': self.dimensions,
            'meta_title': self.meta_title,
            'meta_description': self.meta_description,
            'short_description': self.short_description,
            'specifications': self.specifications,
            'warranty_info': self.warranty_info,
            'shipping_info': self.shipping_info,
            'availability_status': self.availability_status,
            'min_order_quantity': self.min_order_quantity,
            'max_order_quantity': self.max_order_quantity,
            'discount_percentage': self.discount_percentage,
            'tax_rate': self.tax_rate,
            'tax_class': self.tax_class,
            'barcode': self.barcode,
            'manufacturer': self.manufacturer,
            'country_of_origin': self.country_of_origin,
            'is_digital': self.is_digital,
            'download_link': self.download_link,
            'download_expiry_days': self.download_expiry_days,
            'is_taxable': self.is_taxable,
            'is_shippable': self.is_shippable,
            'requires_shipping': self.requires_shipping,
            'is_gift_card': self.is_gift_card,
            'gift_card_value': float(self.gift_card_value) if self.gift_card_value else None,
            'is_customizable': self.is_customizable,
            'customization_options': self.customization_options,
            'canonical_url': self.canonical_url,
            'condition': self.condition,
            'video_url': self.video_url,
            'is_visible': self.is_visible,
            'is_searchable': self.is_searchable,
            'is_comparable': self.is_comparable,
            'is_preorder': self.is_preorder,
            'preorder_release_date': self.preorder_release_date.isoformat() if self.preorder_release_date else None,
            'preorder_message': self.preorder_message,
            'badge_text': self.badge_text,
            'badge_color': self.badge_color,
            'sort_order': self.sort_order,
            'related_products': self.get_related_products(),
            'cross_sell_products': self.get_cross_sell_products(),
            'up_sell_products': self.get_up_sell_products(),
            'seo_keywords': self.get_seo_keywords(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# ----------------------
# ProductEmbedding Model (For AI Search)
# ----------------------
class ProductEmbedding(db.Model):
    """
    Model to store AI-generated embeddings for products.
    Used for semantic search functionality.
    """
    __tablename__ = 'product_embeddings'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    embedding_vector = db.Column(db.LargeBinary, nullable=False)  # Store the embedding as binary data
    text_content = db.Column(db.Text, nullable=False)  # The text that was used to generate the embedding
    model_name = db.Column(db.String(100), nullable=False, default='all-MiniLM-L6-v2')  # AI model used
    embedding_dimension = db.Column(db.Integer, nullable=False, default=384)  # Dimension of the embedding
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Unique constraint to ensure one embedding per product per model
    __table_args__ = (
        db.UniqueConstraint('product_id', 'model_name', name='uix_product_embedding_model'),
    )

    def __repr__(self):
        return f"<ProductEmbedding {self.id} for Product {self.product_id}>"

    def to_dict(self):
        """Convert embedding to dictionary for API responses"""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'text_content': self.text_content[:200] + '...' if len(self.text_content) > 200 else self.text_content,
            'model_name': self.model_name,
            'embedding_dimension': self.embedding_dimension,
            'embedding_size_bytes': len(self.embedding_vector) if self.embedding_vector else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def get_embedding_as_numpy(self):
        """Convert binary embedding back to numpy array"""
        import numpy as np
        if self.embedding_vector:
            return np.frombuffer(self.embedding_vector, dtype=np.float32)
        return None

    def set_embedding_from_numpy(self, embedding_array):
        """Store numpy array as binary data"""
        import numpy as np
        if embedding_array is not None:
            self.embedding_vector = embedding_array.astype(np.float32).tobytes()
            self.embedding_dimension = len(embedding_array)

# ----------------------
# ProductVariant Model
# ----------------------
class ProductVariant(db.Model):
    __tablename__ = 'product_variants'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    color = db.Column(db.String(100), nullable=True)
    size = db.Column(db.String(100), nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    sale_price = db.Column(db.Numeric(10, 2), nullable=True)
    stock = db.Column(db.Integer, default=0)
    sku = db.Column(db.String(100), nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f'<ProductVariant {self.id} of Product {self.product_id}>'

    def to_dict(self):
        """Convert variant to dictionary for API responses"""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'color': self.color,
            'size': self.size,
            'price': float(self.price) if self.price else None,
            'sale_price': float(self.sale_price) if self.sale_price else None,
            'stock': self.stock,
            'sku': self.sku,
            'image_url': self.image_url
        }

# ----------------------
# ProductImage Model
# ----------------------
class ProductImage(db.Model):
    __tablename__ = 'product_images'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=True)
    url = db.Column(db.String(255), nullable=False)
    size = db.Column(db.Integer, nullable=True)  # Size in bytes
    is_primary = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    alt_text = db.Column(db.String(255), nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f'<ProductImage {self.filename} for Product {self.product_id}>'

    def to_dict(self):
        """Convert image to dictionary for API responses"""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'filename': self.filename,
            'url': self.url,
            'is_primary': self.is_primary,
            'alt_text': self.alt_text,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# ----------------------
# Brand Model
# ----------------------
class Brand(db.Model):
    __tablename__ = 'brands'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    logo_url = db.Column(db.String(255))
    website = db.Column(db.String(255))
    is_featured = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)  # Add this line
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    products = db.relationship('Product', back_populates='brand', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Brand {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'logo_url': self.logo_url,
            'website': self.website,
            'is_featured': self.is_featured,
            'is_active': self.is_active,  # Add this line
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# ----------------------
# Order Model (Enhanced with archive support)
# ----------------------
class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    order_number = db.Column(db.String(50), unique=True, nullable=False)
    status = db.Column(db.String(50), default='pending', nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, default=0.0)
    tax_amount = db.Column(db.Float, default=0.0)
    shipping_address = db.Column(db.JSON, nullable=False)
    billing_address = db.Column(db.JSON, nullable=False)
    payment_method = db.Column(db.String(50))
    payment_status = db.Column(db.String(50), default='pending', nullable=False)
    shipping_method = db.Column(db.String(50))
    shipping_cost = db.Column(db.Float, default=0.0)
    tracking_number = db.Column(db.String(100))
    notes = db.Column(db.Text)
    is_archived = db.Column(db.Boolean, default=False)
    archived_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")
    payments = db.relationship('Payment', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Order {self.order_number} for User {self.user_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'order_number': self.order_number,
            'status': self.status if isinstance(self.status, str) else self.status.value if hasattr(self.status, 'value') else str(self.status),
            'total_amount': self.total_amount,
            'subtotal': self.subtotal,
            'tax_amount': self.tax_amount,
            'shipping_address': self.shipping_address,
            'billing_address': self.billing_address,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status if isinstance(self.payment_status, str) else self.payment_status.value if hasattr(self.payment_status, 'value') else str(self.payment_status),
            'shipping_method': self.shipping_method,
            'shipping_cost': self.shipping_cost,
            'tracking_number': self.tracking_number,
            'notes': self.notes,
            'is_archived': self.is_archived,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'items': [item.to_dict() for item in self.items],
            'payments': [payment.to_dict() for payment in self.payments]
        }

# ----------------------
# OrderItem Model
# ----------------------
class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'))
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)

    product = db.relationship('Product', backref='order_items')
    variant = db.relationship('ProductVariant', backref='order_items')

    def __repr__(self):
        return f"<OrderItem {self.id} for Order {self.order_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'quantity': self.quantity,
            'price': self.price,
            'total': self.total,
            'product_name': self.product.name if self.product else None
        }

# ----------------------
# OrderAttachment Model (New for file attachments)
# ----------------------
class OrderAttachment(db.Model):
    """Model to store order attachments like invoices, shipping labels, etc."""
    __tablename__ = 'order_attachments'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)  # Size in bytes
    mime_type = db.Column(db.String(100))
    attachment_type = db.Column(db.String(50))  # 'invoice', 'shipping_label', 'receipt', 'other'
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)  # Whether customer can see this
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=func.now())

    # Relationships
    order = db.relationship('Order', backref=db.backref('attachments', lazy=True, cascade="all, delete-orphan"))
    uploaded_by_user = db.relationship('User')

    def __repr__(self):
        return f"<OrderAttachment {self.filename} for Order {self.order_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'filename': self.filename,
            'original_name': self.original_name,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'attachment_type': self.attachment_type,
            'uploaded_by': self.uploaded_by,
            'is_public': self.is_public,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# ----------------------
# WishlistItem Model
# ----------------------
class WishlistItem(db.Model):
    __tablename__ = 'wishlist_items'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=func.now())

    # The backref is already defined in the User model relationship
    product = db.relationship('Product', backref='wishlist_items')

    def __repr__(self):
        return f"<WishlistItem {self.id} for User {self.user_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_id': self.product_id,
            'created_at': self.created_at.isoformat()
        }

# ----------------------
# Review Model
# ----------------------
class Review(db.Model):
    __tablename__ = 'reviews'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(200))
    comment = db.Column(db.Text)
    images = db.Column(db.JSON)  # List of image URLs
    is_verified_purchase = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Review {self.id} for Product {self.product_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_id': self.product_id,
            'rating': self.rating,
            'title': self.title,
            'comment': self.comment,
            'images': self.images,
            'is_verified_purchase': self.is_verified_purchase,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# ----------------------
# Coupon Model
# ----------------------
class Coupon(db.Model):
    __tablename__ = 'coupons'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    type = db.Column(SQLEnum(CouponType), nullable=False)  # percentage or fixed
    value = db.Column(db.Float, nullable=False)
    min_purchase = db.Column(db.Float)
    max_discount = db.Column(db.Float)
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)
    usage_limit = db.Column(db.Integer)
    used_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<Coupon {self.code}>"

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'type': self.type.value,
            'value': self.value,
            'min_purchase': self.min_purchase,
            'max_discount': self.max_discount,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'usage_limit': self.usage_limit,
            'used_count': self.used_count,
            'is_active': self.is_active
        }

# ----------------------
# Promotion Model
# ----------------------
class Promotion(db.Model):
    __tablename__ = 'promotions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    discount_type = db.Column(SQLEnum(CouponType), nullable=False)  # percentage or fixed
    discount_value = db.Column(db.Float, nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    min_order_value = db.Column(db.Float)
    max_discount = db.Column(db.Float)
    product_ids = db.Column(db.Text)  # Comma-separated list of product IDs
    category_ids = db.Column(db.Text)  # Comma-separated list of category IDs
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Promotion {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'discount_type': self.discount_type.value,
            'discount_value': self.discount_value,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_active': self.is_active,
            'min_order_value': self.min_order_value,
            'max_discount': self.max_discount,
            'product_ids': self.product_ids.split(',') if self.product_ids else [],
            'category_ids': self.category_ids.split(',') if self.category_ids else []
        }

# ----------------------
# Newsletter Model
# ----------------------
class Newsletter(db.Model):
    __tablename__ = 'newsletters'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    is_subscribed = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())

    def __repr__(self):
        return f"<Newsletter {self.email}>"

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'is_subscribed': self.is_subscribed,
            'created_at': self.created_at.isoformat()
        }

# ----------------------
# Payment Model
# ----------------------
class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)
    transaction_id = db.Column(db.String(100), unique=True)
    transaction_data = db.Column(db.JSON)
    status = db.Column(db.String(50), default='pending', nullable=False)
    created_at = db.Column(db.DateTime, default=func.now())
    completed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f"<Payment {self.id} for Order {self.order_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'amount': self.amount,
            'payment_method': self.payment_method,
            'transaction_id': self.transaction_id,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

# ----------------------
# PaymentTransaction Model
# ----------------------
class PaymentTransaction(db.Model):
    """
    Model for payment transactions.
    Stores all payment transaction data including status, amount, and metadata.
    """
    __tablename__ = 'payment_transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'))
    transaction_type = db.Column(db.String(50), nullable=False)
    reference_id = db.Column(db.String(100))
    transaction_id = db.Column(db.String(100), unique=True)
    provider_reference = db.Column(db.String(100))
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime)
    # FIXED: Changed from 'metadata' to 'transaction_metadata'
    transaction_metadata = db.Column(db.JSON)
    notes = db.Column(db.Text)

    # Relationships
    user = db.relationship('User', backref=db.backref('transactions', lazy=True))
    payment_method = db.relationship('PaymentMethod', backref=db.backref('transactions', lazy=True))

    def __repr__(self):
        return f'<PaymentTransaction {self.id}: {self.amount} ({self.status})>'

    def to_dict(self):
        """Convert transaction to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': float(self.amount),
            'payment_method': self.payment_method.name if self.payment_method else None,
            'transaction_type': self.transaction_type,
            'reference_id': self.reference_id,
            'transaction_id': self.transaction_id,
            'provider_reference': self.provider_reference,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            # FIXED: Changed from 'metadata' to 'transaction_metadata'
            'transaction_metadata': self.transaction_metadata,
            'notes': self.notes
        }

# ----------------------
# ShippingZone Model
# ----------------------
class ShippingZone(db.Model):
    __tablename__ = 'shipping_zones'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    all_regions = db.Column(db.Boolean, default=False)
    available_regions = db.Column(db.Text)  # Comma-separated list of regions/states
    min_order_value = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    shipping_methods = db.relationship('ShippingMethod', backref='shipping_zone', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ShippingZone {self.name} for {self.country}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'country': self.country,
            'all_regions': self.all_regions,
            'available_regions': self.available_regions.split(',') if self.available_regions else [],
            'min_order_value': self.min_order_value,
            'is_active': self.is_active
        }

# ----------------------
# ShippingMethod Model
# ----------------------
class ShippingMethod(db.Model):
    __tablename__ = 'shipping_methods'

    id = db.Column(db.Integer, primary_key=True)
    shipping_zone_id = db.Column(db.Integer, db.ForeignKey('shipping_zones.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    cost = db.Column(db.Float, nullable=False)
    min_order_value = db.Column(db.Float)
    max_weight = db.Column(db.Float)
    estimated_days = db.Column(db.String(50))  # e.g., "3-5 days"
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<ShippingMethod {self.name} for Zone {self.shipping_zone_id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'shipping_zone_id': self.shipping_zone_id,
            'name': self.name,
            'description': self.description,
            'cost': self.cost,
            'min_order_value': self.min_order_value,
            'max_weight': self.max_weight,
            'estimated_days': self.estimated_days,
            'is_active': self.is_active
        }

# ----------------------
# PaymentMethod Model
# ----------------------
class PaymentMethod(db.Model):
    __tablename__ = 'payment_methods'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    min_amount = db.Column(db.Float)
    max_amount = db.Column(db.Float)
    countries = db.Column(db.Text)  # Comma-separated list of country codes
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<PaymentMethod {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'instructions': self.instructions,
            'min_amount': self.min_amount,
            'max_amount': self.max_amount,
            'countries': self.countries.split(',') if self.countries else [],
            'is_active': self.is_active
        }

    def is_available_in_country(self, country_code):
        """Check if payment method is available in the specified country."""
        if not self.countries:
            return True  # Available in all countries if not specified

        country_list = self.countries.split(',')
        return country_code in country_list

# ----------------------
# Inventory Model
# ----------------------
class Inventory(db.Model):
    __tablename__ = 'inventory'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True, index=True)
    stock_level = db.Column(db.Integer, default=0)
    reserved_quantity = db.Column(db.Integer, default=0)
    reorder_level = db.Column(db.Integer, default=5)
    low_stock_threshold = db.Column(db.Integer, default=5)
    sku = db.Column(db.String(100))
    location = db.Column(db.String(100))
    status = db.Column(db.String(20), default='active')  # 'active', 'out_of_stock', 'discontinued'
    last_updated = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    created_at = db.Column(db.DateTime, default=func.now())

    # Relationships
    product = db.relationship('Product')
    variant = db.relationship('ProductVariant')

    __table_args__ = (
        db.UniqueConstraint('product_id', 'variant_id', name='uix_inventory_product_variant'),
    )

    def __repr__(self):
        return f"<Inventory for Product {self.product_id} Variant {self.variant_id}>"

    def to_dict(self):
        available_quantity = max(0, self.stock_level - self.reserved_quantity)
        return {
            'id': self.id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'stock_level': self.stock_level,
            'reserved_quantity': self.reserved_quantity,
            'available_quantity': available_quantity,
            'reorder_level': self.reorder_level,
            'low_stock_threshold': self.low_stock_threshold,
            'sku': self.sku,
            'location': self.location,
            'status': self.status,
            'is_in_stock': available_quantity > 0,
            'is_low_stock': 0 < available_quantity <= self.low_stock_threshold,
            'needs_reorder': self.stock_level <= self.reorder_level,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @property
    def available_quantity(self):
        """Calculate the available quantity (stock_level minus reserved_quantity)"""
        return max(0, self.stock_level - self.reserved_quantity)

    def is_in_stock(self):
        """Check if the product is in stock"""
        return self.available_quantity > 0

    def is_low_stock(self):
        """Check if the product is low in stock"""
        return 0 < self.available_quantity <= self.low_stock_threshold

    def update_status(self):
        """Update the status based on stock level"""
        available_quantity = self.stock_level - self.reserved_quantity
        if available_quantity <= 0:
            self.status = 'out_of_stock'
        else:
            self.status = 'active'
        return self.status

    def reserve_stock(self, quantity):
        """Reserve stock for a pending order"""
        if quantity <= 0:
            return False

        if quantity > self.available_quantity:
            return False

        self.reserved_quantity += quantity
        self.update_status()
        return True

    def release_stock(self, quantity):
        """Release previously reserved stock"""
        if quantity <= 0:
            return False

        self.reserved_quantity = max(0, self.reserved_quantity - quantity)
        self.update_status()
        return True

    def reduce_stock(self, quantity):
        """Reduce stock level (e.g., after a completed order)"""
        if quantity <= 0:
            return False

        if quantity > self.stock_level:
            return False

        self.stock_level -= quantity
        self.update_status()
        return True

    def increase_stock(self, quantity):
        """Increase stock level (e.g., after restocking)"""
        if quantity <= 0:
            return False

        self.stock_level += quantity
        self.update_status()
        return True

# ----------------------
# ProductCompatibility Model
# ----------------------
class ProductCompatibility(db.Model):
    __tablename__ = 'product_compatibility'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    incompatible_product_id = db.Column(db.Integer, db.ForeignKey('products.id'))
    required_product_id = db.Column(db.Integer, db.ForeignKey('products.id'))
    is_incompatible = db.Column(db.Boolean, default=False)
    is_required = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)

    # Relationships
    product = db.relationship('Product', foreign_keys=[product_id])
    incompatible_product = db.relationship('Product', foreign_keys=[incompatible_product_id])
    required_product = db.relationship('Product', foreign_keys=[required_product_id])

    def __repr__(self):
        if self.is_incompatible:
            return f"<Product {self.product_id} is incompatible with {self.incompatible_product_id}>"
        elif self.is_required:
            return f"<Product {self.product_id} requires {self.required_product_id}>"
        else:
            return f"<ProductCompatibility {self.id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'incompatible_product_id': self.incompatible_product_id,
            'required_product_id': self.required_product_id,
            'is_incompatible': self.is_incompatible,
            'is_required': self.is_required,
            'notes': self.notes
        }

class MpesaTransaction(db.Model):
    """
    Model for M-PESA transactions.
    Stores all M-PESA transaction data including STK push requests, callbacks, and queries.
    """
    __tablename__ = 'mpesa_transactions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))  # Changed to String for UUID
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Make nullable for guest transactions
    order_id = db.Column(db.String(100), nullable=True, index=True)  # Changed to String to match usage
    transaction_type = db.Column(db.String(50), nullable=False)  # stk_push, stk_query, callback
    checkout_request_id = db.Column(db.String(100), index=True)
    merchant_request_id = db.Column(db.String(100), index=True)
    mpesa_receipt_number = db.Column(db.String(50), index=True)
    transaction_id = db.Column(db.String(100), index=True)
    amount = db.Column(db.Numeric(10, 2))
    phone_number = db.Column(db.String(20))
    account_reference = db.Column(db.String(100), index=True)
    transaction_desc = db.Column(db.String(255))  # Add this field
    description = db.Column(db.String(255))  # Keep both for compatibility
    result_code = db.Column(db.String(10))
    result_desc = db.Column(db.String(255))
    status = db.Column(db.String(50), default='pending')  # pending, completed, failed
    request_data = db.Column(db.JSON)
    response_data = db.Column(db.JSON)
    processed_data = db.Column(db.JSON)
    transaction_metadata = db.Column(db.JSON)
    idempotency_key = db.Column(db.String(100), unique=True, index=True)  # Add this field
    retry_count = db.Column(db.Integer, default=0)  # Add this field
    error_message = db.Column(db.Text)  # Add this field
    mpesa_response = db.Column(db.JSON)  # Add this field
    callback_response = db.Column(db.JSON)  # Add this field
    transaction_date = db.Column(db.DateTime)  # Add this field
    callback_received_at = db.Column(db.DateTime)  # Add this field
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    user = db.relationship('User', backref=db.backref('mpesa_transactions', lazy=True))

    def __repr__(self):
        return f'<MpesaTransaction {self.id}: {self.transaction_type} ({self.status})>'

    def to_dict(self):
        """Convert transaction to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'order_id': self.order_id,
            'transaction_type': self.transaction_type,
            'checkout_request_id': self.checkout_request_id,
            'merchant_request_id': self.merchant_request_id,
            'mpesa_receipt_number': self.mpesa_receipt_number,
            'transaction_id': self.transaction_id,
            'amount': float(self.amount) if self.amount else None,
            'phone_number': self.phone_number,
            'account_reference': self.account_reference,
            'transaction_desc': self.transaction_desc,
            'description': self.description,
            'result_code': self.result_code,
            'result_desc': self.result_desc,
            'status': self.status,
            'idempotency_key': self.idempotency_key,
            'retry_count': self.retry_count,
            'error_message': self.error_message,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'callback_received_at': self.callback_received_at.isoformat() if self.callback_received_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class PesapalTransaction(db.Model):
    """Enhanced Pesapal transaction model with production features"""
    __tablename__ = 'pesapal_transactions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)

    # Transaction details
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default='KES')
    email = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(15))
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    description = db.Column(db.String(100))

    # Pesapal specific fields
    pesapal_tracking_id = db.Column(db.String(100), unique=True)
    merchant_reference = db.Column(db.String(100), unique=True)
    payment_url = db.Column(db.String(500))
    callback_url = db.Column(db.String(500))
    notification_id = db.Column(db.String(100))

    # Payment details
    payment_method = db.Column(db.String(50))
    card_type = db.Column(db.String(50))
    last_four_digits = db.Column(db.String(4))
    pesapal_receipt_number = db.Column(db.String(50))

    payment_status_description = db.Column(db.String(100))  # e.g., "Completed", "Pending", "Failed"
    status_code = db.Column(db.Integer)  # Pesapal status code (1 = success, etc.)
    completed_at = db.Column(db.DateTime)  # When payment was completed

    # Status and results
    status = db.Column(db.String(20), nullable=False, default='initiated')

    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    transaction_date = db.Column(db.DateTime)
    callback_received_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)
    last_status_check = db.Column(db.DateTime)

    # Security and reliability
    idempotency_key = db.Column(db.String(64), unique=True)
    retry_count = db.Column(db.Integer, default=0)
    error_message = db.Column(db.String(500))

    # Response storage
    pesapal_response = db.Column(db.Text)
    callback_response = db.Column(db.Text)
    status_response = db.Column(db.Text)

    # Relationships
    user = db.relationship('User', backref='pesapal_transactions')
    order = db.relationship('Order', backref='pesapal_transactions')

    # Indexes for performance
    __table_args__ = (
        db.Index('idx_pesapal_user_status', 'user_id', 'status'),
        db.Index('idx_pesapal_order_status', 'order_id', 'status'),
        db.Index('idx_pesapal_tracking_id', 'pesapal_tracking_id'),
        db.Index('idx_pesapal_merchant_ref', 'merchant_reference'),
        db.Index('idx_pesapal_created_at', 'created_at'),
        db.Index('idx_pesapal_email', 'email'),
    )

    def __repr__(self):
        return f'<PesapalTransaction {self.id}: {self.status}>'

    def to_dict(self):
        """Convert transaction to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'order_id': self.order_id,
            'amount': float(self.amount),
            'currency': self.currency,
            'email': self.email,
            'phone_number': self.phone_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'description': self.description,
            'pesapal_tracking_id': self.pesapal_tracking_id,
            'merchant_reference': self.merchant_reference,
            'payment_url': self.payment_url,
            'payment_method': self.payment_method,
            'pesapal_receipt_number': self.pesapal_receipt_number,
            'status': self.status,
            'payment_status_description': self.payment_status_description,
            'status_code': self.status_code,
            'created_at': self.created_at.isoformat(),
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message
        }

    def update_payment_status(self, pesapal_response):
        """
        Update transaction status based on Pesapal API response.
        Handles payment status updates from Pesapal.
        """
        if not pesapal_response:
            return False

        # Extract payment status from Pesapal response
        payment_status = pesapal_response.get('payment_status') or pesapal_response.get('payment_status_description', '')
        status_code = pesapal_response.get('status_code')

        # Store Pesapal response data
        self.payment_status_description = payment_status
        self.status_code = status_code
        self.last_status_check = datetime.now(timezone.utc)

        # Normalize payment status to uppercase for comparison
        payment_status_upper = payment_status.upper().strip() if payment_status else ''

        # Update transaction status based on Pesapal response
        if payment_status_upper in ['COMPLETED', 'COMPLETE', 'SUCCESS'] or status_code == 1:
            self.mark_as_completed()
            return True
        elif payment_status_upper in ['PENDING', 'PROCESSING']:
            self.status = 'pending'
            return True
        elif payment_status_upper in ['FAILED', 'CANCELLED', 'DECLINED']:
            self.mark_as_failed(f"Payment {payment_status_upper}")
            return True

        return False

    def mark_as_completed(self):
        """Mark transaction as completed"""
        self.status = 'completed'
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = None

    def mark_as_failed(self, error_msg=None):
        """Mark transaction as failed"""
        self.status = 'failed'
        self.error_message = error_msg or 'Payment failed'

    def mark_as_pending(self):
        """Mark transaction as pending"""
        self.status = 'pending'

    def mark_as_cancelled(self):
        """Mark transaction as cancelled"""
        self.status = 'cancelled'
        self.cancelled_at = datetime.now(timezone.utc)

    def is_completed(self):
        """Check if payment is completed"""
        return self.status == 'completed'

    def is_pending(self):
        """Check if payment is pending"""
        return self.status == 'pending'

    def is_failed(self):
        """Check if payment failed"""
        return self.status == 'failed'

    def is_cancelled(self):
        """Check if payment was cancelled"""
        return self.status == 'cancelled'

    def get_transaction_status(self):
        """Get formatted transaction status for frontend"""
        return {
            'transaction_id': self.id,
            'pesapal_tracking_id': self.pesapal_tracking_id,
            'transaction_status': self.status,
            'payment_status_description': self.payment_status_description,
            'status_code': self.status_code,
            'amount': float(self.amount),
            'currency': self.currency,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message
        }
