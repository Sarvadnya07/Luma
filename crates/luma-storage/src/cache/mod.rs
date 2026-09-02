use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

// ============================================================================
// Constants – default cache sizes
// ============================================================================

/// Default maximum number of cover images to cache.
pub const DEFAULT_COVER_CACHE_SIZE: usize = 50;

/// Default maximum number of document metadata entries to cache.
pub const DEFAULT_METADATA_CACHE_SIZE: usize = 100;

/// Default maximum number of search query results to cache.
pub const DEFAULT_SEARCH_CACHE_SIZE: usize = 50;

/// Minimum allowed capacity for any cache (to avoid zero‑size).
pub const MIN_CACHE_CAPACITY: usize = 1;

// ============================================================================
// CacheEntry
// ============================================================================

#[derive(Clone)]
struct CacheEntry<V> {
    value: V,
    #[allow(dead_code)]
    created_at: Instant,
    last_accessed: Arc<AtomicU64>,
}

// ============================================================================
// CacheStats
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub item_count: usize,
}

// ============================================================================
// BoundedCache
// ============================================================================

#[derive(Clone)]
pub struct BoundedCache<K, V> {
    max_capacity: usize,
    entries: Arc<RwLock<HashMap<K, CacheEntry<V>>>>,
    hits: Arc<AtomicU64>,
    misses: Arc<AtomicU64>,
    access_counter: Arc<AtomicU64>,
}

impl<K: std::hash::Hash + Eq + Clone + Send + Sync + 'static, V: Clone + Send + Sync + 'static>
    BoundedCache<K, V>
{
    /// Creates a new bounded cache with the given maximum capacity.
    /// Panics if `max_capacity` is zero.
    pub fn new(max_capacity: usize) -> Self {
        assert!(
            max_capacity >= MIN_CACHE_CAPACITY,
            "Cache capacity must be at least {}",
            MIN_CACHE_CAPACITY
        );
        Self {
            max_capacity,
            entries: Arc::new(RwLock::new(HashMap::new())),
            hits: Arc::new(AtomicU64::new(0)),
            misses: Arc::new(AtomicU64::new(0)),
            access_counter: Arc::new(AtomicU64::new(1)),
        }
    }

    /// Retrieves a value from the cache, updating the last‑accessed sequence counter.
    pub async fn get(&self, key: &K) -> Option<V> {
        let lock = self.entries.read().await;
        if let Some(entry) = lock.get(key) {
            let next_seq = self.access_counter.fetch_add(1, Ordering::SeqCst);
            entry.last_accessed.store(next_seq, Ordering::SeqCst);
            self.hits.fetch_add(1, Ordering::Relaxed);
            Some(entry.value.clone())
        } else {
            self.misses.fetch_add(1, Ordering::Relaxed);
            None
        }
    }

    /// Inserts a key‑value pair, evicting the least‑recently‑accessed item if at capacity.
    pub async fn insert(&self, key: K, value: V) {
        let mut lock = self.entries.write().await;
        if lock.len() >= self.max_capacity && !lock.contains_key(&key) {
            // Evict the entry with the oldest last‑accessed sequence counter.
            if let Some(oldest_key) = lock
                .iter()
                .min_by_key(|(_, v)| v.last_accessed.load(Ordering::SeqCst))
                .map(|(k, _)| k.clone())
            {
                lock.remove(&oldest_key);
            }
        }

        let now = Instant::now();
        let next_seq = self.access_counter.fetch_add(1, Ordering::SeqCst);
        lock.insert(
            key,
            CacheEntry {
                value,
                created_at: now,
                last_accessed: Arc::new(AtomicU64::new(next_seq)),
            },
        );
    }

    /// Removes a key from the cache.
    pub async fn remove(&self, key: &K) {
        let mut lock = self.entries.write().await;
        lock.remove(key);
    }

    /// Clears all entries from the cache.
    pub async fn clear(&self) {
        let mut lock = self.entries.write().await;
        lock.clear();
    }

    /// Returns current cache statistics.
    pub async fn stats(&self) -> CacheStats {
        let lock = self.entries.read().await;
        CacheStats {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            item_count: lock.len(),
        }
    }
}

// ============================================================================
// CacheManagerConfig
// ============================================================================

/// Configuration for the global cache manager.
#[derive(Debug, Clone)]
pub struct CacheManagerConfig {
    pub cover_cache_size: usize,
    pub metadata_cache_size: usize,
    pub search_cache_size: usize,
}

impl Default for CacheManagerConfig {
    fn default() -> Self {
        Self {
            cover_cache_size: DEFAULT_COVER_CACHE_SIZE,
            metadata_cache_size: DEFAULT_METADATA_CACHE_SIZE,
            search_cache_size: DEFAULT_SEARCH_CACHE_SIZE,
        }
    }
}

// ============================================================================
// CacheManager
// ============================================================================

/// Centralised cache manager holding separate caches for covers, metadata, and search results.
#[derive(Clone)]
pub struct CacheManager {
    pub covers: BoundedCache<String, Vec<u8>>,
    pub document_metadata: BoundedCache<String, serde_json::Value>,
    pub search_queries: BoundedCache<String, serde_json::Value>,
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CacheManager {
    /// Creates a new cache manager with default capacities.
    pub fn new() -> Self {
        Self::with_config(&CacheManagerConfig::default())
    }

    /// Creates a cache manager with custom capacities.
    pub fn with_config(config: &CacheManagerConfig) -> Self {
        Self {
            covers: BoundedCache::new(config.cover_cache_size),
            document_metadata: BoundedCache::new(config.metadata_cache_size),
            search_queries: BoundedCache::new(config.search_cache_size),
        }
    }

    /// Invalidates all cached data associated with a specific book.
    pub async fn invalidate_book(&self, book_id: &str) {
        self.covers.remove(&book_id.to_string()).await;
        self.document_metadata.remove(&book_id.to_string()).await;
        self.search_queries.clear().await;
    }

    /// Clears all caches.
    pub async fn clear_all(&self) {
        self.covers.clear().await;
        self.document_metadata.clear().await;
        self.search_queries.clear().await;
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bounded_cache_eviction() {
        let cache = BoundedCache::<String, String>::new(3);
        cache.insert("a".to_string(), "1".to_string()).await;
        cache.insert("b".to_string(), "2".to_string()).await;
        cache.insert("c".to_string(), "3".to_string()).await;
        // Access "a" to update its last_accessed
        cache.get(&"a".to_string()).await;
        cache.insert("d".to_string(), "4".to_string()).await;
        // "b" should be evicted (oldest not accessed)
        assert!(cache.get(&"b".to_string()).await.is_none());
        assert!(cache.get(&"a".to_string()).await.is_some());
        assert!(cache.get(&"c".to_string()).await.is_some());
        assert!(cache.get(&"d".to_string()).await.is_some());
    }

    #[tokio::test]
    async fn test_cache_manager_config() {
        let config = CacheManagerConfig {
            cover_cache_size: 10,
            metadata_cache_size: 20,
            search_cache_size: 30,
        };
        let manager = CacheManager::with_config(&config);
        let stats = manager.covers.stats().await;
        assert_eq!(stats.item_count, 0);
        // Capacity not directly exposed, but we can test insertion up to limit.
        for i in 0..15 {
            manager
                .covers
                .insert(format!("key_{}", i), vec![i as u8])
                .await;
        }
        let stats_after = manager.covers.stats().await;
        // Should have at most 10 items (capacity)
        assert!(stats_after.item_count <= 10);
    }
}