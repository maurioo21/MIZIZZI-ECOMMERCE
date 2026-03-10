"""
Carousel Banner Model
"""

from datetime import datetime, timezone
from ..configuration.extensions import db

class CarouselBanner(db.Model):
    """Carousel banner model for managing carousel items."""
    
    __tablename__ = 'carousel_banners'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    position = db.Column(
        db.String(50),
        nullable=False,
        default='homepage',
        index=True
    )  # homepage, category_page, flash_sales, luxury_deals
    image_url = db.Column(db.String(500), nullable=False)
    image_public_id = db.Column(db.String(255), nullable=True)  # Cloudinary public_id for deletion
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    badge_text = db.Column(db.String(100))
    discount = db.Column(db.String(50))
    button_text = db.Column(db.String(100), default='VIEW COLLECTION')
    link_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, index=True)
    sort_order = db.Column(db.Integer, default=0, index=True)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    def __repr__(self):
        return f'<CarouselBanner {self.id}: {self.name}>'
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'position': self.position,
            'image_url': self.image_url,  # Direct Cloudinary URL
            'image_public_id': self.image_public_id,  # For Cloudinary deletion
            'title': self.title,
            'description': self.description,
            'badge_text': self.badge_text,
            'discount': self.discount,
            'button_text': self.button_text,
            'link_url': self.link_url,
            'is_active': self.is_active,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
