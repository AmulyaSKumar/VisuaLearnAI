import { useState, useEffect, useCallback } from 'react';

const UNSPLASH_API_URL = 'https://api.unsplash.com';
const CACHE_KEY_PREFIX = 'unsplash_cache_';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCacheKey(keywords) {
  return CACHE_KEY_PREFIX + keywords.sort().join('_').toLowerCase().replace(/\s+/g, '_');
}

function getCachedImages(keywords) {
  try {
    const key = getCacheKey(keywords);
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const { images, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return images;
  } catch {
    return null;
  }
}

function setCachedImages(keywords, images) {
  try {
    const key = getCacheKey(keywords);
    sessionStorage.setItem(key, JSON.stringify({
      images,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore storage errors
  }
}

export function useUnsplashImages(keywords = []) {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchImages = useCallback(async () => {
    if (!keywords || keywords.length === 0) {
      setImages([]);
      return;
    }

    const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

    // If no API key, use placeholder URLs
    if (!accessKey) {
      const placeholderImages = keywords.map((keyword, index) => ({
        id: `placeholder_${index}`,
        title: keyword,
        description: `Image related to ${keyword}`,
        url: `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)}`,
        thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(keyword)}`,
        author: 'Unsplash',
        authorUrl: 'https://unsplash.com',
        keyword
      }));
      setImages(placeholderImages);
      return;
    }

    // Check cache first
    const cached = getCachedImages(keywords);
    if (cached) {
      setImages(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allImages = [];

      // Fetch images for each keyword
      for (const keyword of keywords.slice(0, 3)) { // Limit to 3 keywords
        const response = await fetch(
          `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(keyword)}&per_page=3&orientation=landscape`,
          {
            headers: {
              Authorization: `Client-ID ${accessKey}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Unsplash API error: ${response.status}`);
        }

        const data = await response.json();

        const keywordImages = data.results.map(photo => ({
          id: photo.id,
          title: photo.alt_description || keyword,
          description: photo.description || `Image related to ${keyword}`,
          url: photo.urls.regular,
          thumb: photo.urls.small,
          author: photo.user.name,
          authorUrl: photo.user.links.html,
          downloadUrl: photo.links.download,
          keyword
        }));

        allImages.push(...keywordImages);
      }

      // Cache the results
      setCachedImages(keywords, allImages);
      setImages(allImages);
    } catch (err) {
      console.error('Error fetching Unsplash images:', err);
      setError(err.message);

      // Fallback to placeholder images on error
      const placeholderImages = keywords.map((keyword, index) => ({
        id: `placeholder_${index}`,
        title: keyword,
        description: `Image related to ${keyword}`,
        url: `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)}`,
        thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(keyword)}`,
        author: 'Unsplash',
        authorUrl: 'https://unsplash.com',
        keyword
      }));
      setImages(placeholderImages);
    } finally {
      setIsLoading(false);
    }
  }, [keywords.join(',')]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return { images, isLoading, error, refetch: fetchImages };
}

export default useUnsplashImages;
