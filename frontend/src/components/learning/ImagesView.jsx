import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnsplashImages } from '../../hooks/useUnsplashImages';

export default function ImagesView({ images = [], imageSearchKeywords = [] }) {
  const [selectedImage, setSelectedImage] = useState(null);

  // Use Unsplash API if keywords are provided
  const { images: unsplashImages, isLoading: isUnsplashLoading } = useUnsplashImages(imageSearchKeywords);

  // Use Unsplash images if available, fallback to passed images
  const displayImages = unsplashImages.length > 0 ? unsplashImages : images;

  if (isUnsplashLoading) {
    return (
      <div className="space-y-4">
        <div className="masonry-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="masonry-item bg-muted/30 rounded-xl animate-pulse"
              style={{ height: `${150 + Math.random() * 100}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!displayImages || displayImages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>No images available for this topic</p>
        <p className="text-sm mt-2">Try asking about a topic with visual elements</p>
      </div>
    );
  }

  const getImageUrl = (image) => {
    // If it's an Unsplash image, use the URL directly
    if (image.url) return image.url;
    if (image.thumb) return image.thumb;
    // Fallback to source.unsplash for old format
    const query = encodeURIComponent(image.searchQuery || image.title || 'learning');
    return `https://source.unsplash.com/800x600/?${query}`;
  };

  const getThumbUrl = (image) => {
    if (image.thumb) return image.thumb;
    return getImageUrl(image);
  };

  return (
    <div className="space-y-6">
      {/* Keyword Tags */}
      {imageSearchKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageSearchKeywords.map((keyword, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      {/* Masonry Grid */}
      <div className="masonry-grid">
        {displayImages.map((image, idx) => (
          <motion.div
            key={image.id || idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="masonry-item group relative bg-muted/20 rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            {/* Image */}
            <div className="relative overflow-hidden">
              <img
                src={getThumbUrl(image)}
                alt={image.title}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />

              {/* Keyword Tag Overlay */}
              {image.keyword && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-full text-xs text-foreground">
                  {image.keyword}
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <div className="text-white">
                  <p className="font-medium text-sm line-clamp-1">{image.title}</p>
                  {image.author && (
                    <p className="text-xs text-white/70">by {image.author}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-4xl w-full bg-card rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Image */}
              <div className="relative">
                <img
                  src={getImageUrl(selectedImage)}
                  alt={selectedImage.title}
                  className="w-full h-auto object-contain bg-black/50 max-h-[60vh]"
                />

                {/* Close button on mobile */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="sm:hidden absolute top-2 right-2 p-2 rounded-lg bg-background/80 backdrop-blur-sm text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Info */}
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">{selectedImage.title}</h3>
                    {selectedImage.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{selectedImage.description}</p>
                    )}
                    {selectedImage.author && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Photo by{' '}
                        <a
                          href={selectedImage.authorUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedImage.author}
                        </a>
                        {' on Unsplash'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="hidden sm:flex p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Keyword tag */}
                {selectedImage.keyword && (
                  <div className="mt-3">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {selectedImage.keyword}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2 flex-wrap">
                  {selectedImage.downloadUrl && (
                    <a
                      href={selectedImage.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(selectedImage.keyword || selectedImage.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Find More
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
