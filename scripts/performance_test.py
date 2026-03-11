#!/usr/bin/env python3
"""
Performance monitoring script for Mizizzi Backend.
Tests real-world scenarios and measures response times with caching.
"""
import requests
import time
import json
from typing import Dict, List

BACKEND_URL = "http://localhost:5000"
SLUG = "7pieces-automatic-buckle-belt-business-casual-for-men"


class PerformanceMetrics:
    def __init__(self):
        self.measurements: List[Dict] = []
    
    def add_measurement(self, name: str, duration: float, cache_status: str = None, size: int = None):
        self.measurements.append({
            'name': name,
            'duration_ms': round(duration * 1000, 2),
            'cache_status': cache_status,
            'size_bytes': size
        })
        print(f"  ✓ {name}: {round(duration * 1000, 1)}ms (Cache: {cache_status}, Size: {size} bytes)")
    
    def summary(self):
        if not self.measurements:
            print("\nNo measurements recorded")
            return
        
        print("\n" + "=" * 70)
        print("PERFORMANCE SUMMARY")
        print("=" * 70)
        
        cache_hits = [m for m in self.measurements if m['cache_status'] == 'HIT']
        cache_misses = [m for m in self.measurements if m['cache_status'] == 'MISS']
        
        if cache_hits:
            avg_hit_time = sum(m['duration_ms'] for m in cache_hits) / len(cache_hits)
            print(f"\nCache HIT Average: {avg_hit_time:.1f}ms ({len(cache_hits)} requests)")
        
        if cache_misses:
            avg_miss_time = sum(m['duration_ms'] for m in cache_misses) / len(cache_misses)
            print(f"Cache MISS Average: {avg_miss_time:.1f}ms ({len(cache_misses)} requests)")
        
        if cache_hits and cache_misses:
            speedup = (sum(m['duration_ms'] for m in cache_misses) / len(cache_misses)) / \
                      (sum(m['duration_ms'] for m in cache_hits) / len(cache_hits))
            print(f"\nCache Speedup: {speedup:.1f}x faster with Redis")
        
        total_size = sum(m['size_bytes'] for m in self.measurements if m['size_bytes'])
        if total_size:
            avg_size = total_size / len([m for m in self.measurements if m['size_bytes']])
            print(f"Average Response Size: {avg_size / 1024:.1f} KB")
        
        # Check for compression
        if self.measurements:
            first = self.measurements[0]
            print(f"\nFirst request took: {first['duration_ms']}ms (MISS - database fetch)")


def test_slug_endpoint(metrics: PerformanceMetrics, iterations: int = 3):
    """Test the slug-based endpoint with multiple requests to measure caching."""
    print(f"\n{'=' * 70}")
    print(f"Testing Slug Endpoint ({iterations} iterations)")
    print(f"Endpoint: /api/product-details/by-slug/{SLUG}")
    print(f"{'=' * 70}")
    
    endpoint = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    
    for i in range(iterations):
        try:
            start = time.time()
            response = requests.get(endpoint, timeout=10)
            duration = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                cache_status = data.get('_cache', {}).get('status', 'UNKNOWN')
                size = len(response.content)
                
                print(f"\nIteration {i + 1}:")
                metrics.add_measurement(
                    f"Slug request #{i + 1}",
                    duration,
                    cache_status=cache_status,
                    size=size
                )
            else:
                print(f"  ✗ Error: HTTP {response.status_code}")
        
        except requests.exceptions.RequestException as e:
            print(f"  ✗ Request failed: {e}")
        
        # Wait between requests to avoid overwhelming server
        if i < iterations - 1:
            time.sleep(0.5)


def test_id_endpoint(metrics: PerformanceMetrics, product_id: int = 1, iterations: int = 3):
    """Test the numeric ID endpoint."""
    print(f"\n{'=' * 70}")
    print(f"Testing ID Endpoint ({iterations} iterations)")
    print(f"Endpoint: /api/product-details/{product_id}")
    print(f"{'=' * 70}")
    
    endpoint = f"{BACKEND_URL}/api/product-details/{product_id}"
    
    for i in range(iterations):
        try:
            start = time.time()
            response = requests.get(endpoint, timeout=10)
            duration = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                cache_status = data.get('_cache', {}).get('status', 'UNKNOWN')
                size = len(response.content)
                
                print(f"\nIteration {i + 1}:")
                metrics.add_measurement(
                    f"ID request #{i + 1}",
                    duration,
                    cache_status=cache_status,
                    size=size
                )
            else:
                print(f"  ✗ Error: HTTP {response.status_code}")
        
        except requests.exceptions.RequestException as e:
            print(f"  ✗ Request failed: {e}")
        
        if i < iterations - 1:
            time.sleep(0.5)


def test_compression(metrics: PerformanceMetrics):
    """Test response compression with gzip."""
    print(f"\n{'=' * 70}")
    print("Testing Compression (Gzip)")
    print(f"{'=' * 70}")
    
    endpoint = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    
    try:
        # Request without compression
        response_plain = requests.get(endpoint, timeout=10)
        size_plain = len(response_plain.content)
        
        # Request with gzip (standard)
        response_gzip = requests.get(
            endpoint,
            headers={'Accept-Encoding': 'gzip'},
            timeout=10
        )
        size_gzip = len(response_gzip.content)
        
        print(f"\nUncompressed size: {size_plain} bytes")
        print(f"Compressed size: {size_gzip} bytes")
        
        if size_plain > size_gzip:
            ratio = (1 - size_gzip / size_plain) * 100
            print(f"Compression ratio: {ratio:.1f}%")
        
        # Check headers
        encoding = response_gzip.headers.get('Content-Encoding', 'none')
        print(f"Content-Encoding header: {encoding}")
    
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Compression test failed: {e}")


def main():
    print("\n" + "=" * 70)
    print("MIZIZZI E-COMMERCE BACKEND - PERFORMANCE TEST")
    print("=" * 70)
    print(f"Backend URL: {BACKEND_URL}")
    
    # Check connectivity
    try:
        response = requests.head(f"{BACKEND_URL}/", timeout=5)
        print("✓ Backend is reachable")
    except requests.exceptions.RequestException:
        print("✗ Cannot connect to backend. Make sure it's running on port 5000.")
        return
    
    metrics = PerformanceMetrics()
    
    # Run tests
    test_slug_endpoint(metrics, iterations=3)
    test_compression(metrics)
    test_id_endpoint(metrics, product_id=1, iterations=2)
    
    # Print summary
    metrics.summary()
    
    print(f"\n{'=' * 70}")
    print("RECOMMENDATIONS:")
    print("=" * 70)
    print("1. First request (MISS) should take 80-150ms")
    print("2. Subsequent requests (HIT) should take 5-10ms")
    print("3. Compression should reduce size by 70-80%")
    print("4. Redis cache hit rate should reach 70-90% after warm-up")
    print(f"{'=' * 70}\n")


if __name__ == '__main__':
    main()
