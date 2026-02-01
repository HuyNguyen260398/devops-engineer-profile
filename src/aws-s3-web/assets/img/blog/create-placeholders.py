"""
Script to create placeholder images for blog section.
Requires PIL/Pillow library.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create blog directory if it doesn't exist
blog_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(blog_dir, exist_ok=True)

# Define blog post placeholders with different accent colors
blog_posts = [
    {"name": "blog-1.jpg", "title": "Kubernetes Security", "color": "#0563bb"},
    {"name": "blog-2.jpg", "title": "CI/CD Optimization", "color": "#5f3dc4"},
    {"name": "blog-3.jpg", "title": "Terraform & IaC", "color": "#d0282f"},
    {"name": "blog-4.jpg", "title": "Observability", "color": "#16a34a"},
    {"name": "blog-5.jpg", "title": "Container Security", "color": "#ea580c"},
    {"name": "blog-6.jpg", "title": "GitOps Practices", "color": "#d81e64"},
]

for post in blog_posts:
    # Create a new image with gradient-like appearance
    img = Image.new("RGB", (400, 300), color="white")
    draw = ImageDraw.Draw(img, "RGBA")

    # Convert hex color to RGB
    color_hex = post["color"].lstrip("#")
    rgb_color = tuple(int(color_hex[i : i + 2], 16) for i in (0, 2, 4))

    # Draw gradient background
    for y in range(300):
        alpha = int(255 * (y / 300))
        draw.rectangle([(0, y), (400, y + 1)], fill=(*rgb_color, alpha))

    # Draw DevOps-related icons/patterns
    draw.rectangle([(20, 20), (380, 280)], outline=(*rgb_color, 200), width=3)
    draw.text((200, 120), "📊", fill=(255, 255, 255, 200), anchor="mm")
    draw.text((100, 80), "DevOps", fill=(255, 255, 255, 180), anchor="mm")

    # Save the image
    img_path = os.path.join(blog_dir, post["name"])
    img.save(img_path, quality=85)
    print(f"Created: {img_path}")

print("All placeholder images created successfully!")
