use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

#[derive(Clone)]
struct CacheEntry<V> {
    value: V,
    #[allow(dead_code)]
    created_at: Instant,
    last_accessed: Arc<AtomicU64>,
}

#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub item_count: usize,
}

#[derive(Clone)]
pub struct BoundedCache<K, V> {
    max_capacity: usize,
    entries: Arc<RwLock<HashMap<K, CacheEntry<V>>>>,
    hits: Arc<AtomicU64>,
    misses: Arc<AtomicU64>,
}

impl<K: std::hash::Hash + Eq + Clone + Send + Sync + 'static, V: Clone + Send + Sync + 'static>
    BoundedCache<K, V>
{
    pub fn new(max_capacity: usize) -> Self {
        Self {
            max_capacity,
            entries: Arc::new(RwLock::new(HashMap::new())),
            hits: Arc::new(AtomicU64::new(0)),
            misses: Arc::new(AtomicU64::new(0)),
        }
    }

    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    pub async fn get(&self, key: &K) -> Option<V> {
        let lock = self.entries.read().await;
        if let Some(entry) = lock.get(key) {
            entry.last_accessed.store(Self::current_timestamp_ms(), Ordering::Relaxed);
            self.hits.fetch_add(1, Ordering::Relaxed);
            Some(entry.value.clone())
        } else {
            self.misses.fetch_add(1, Ordering::Relaxed);
            None
        }
    }

    pub async fn insert(&self, key: K, value: V) {
        let mut lock = self.entries.write().await;
        if lock.len() >= self.max_capacity && !lock.contains_key(&key) {
            // Evict oldest accessed item
            if let Some(oldest_key) = lock
                .iter()
                .min_by_key(|(_, v)| v.last_accessed.load(Ordering::Relaxed))
                .map(|(k, _)| k.clone())
            {
                lock.remove(&oldest_key);
            }
        }

        let now = Instant::now();
        let now_ms = Self::current_timestamp_ms();
        lock.insert(
            key,
            CacheEntry {
                value,
                created_at: now,
                last_accessed: Arc::new(AtomicU64::new(now_ms)),
            },
        );
    }

    pub async fn remove(&self, key: &K) {
        let mut lock = self.entries.write().await;
        lock.remove(key);
    }

    pub async fn clear(&self) {
        let mut lock = self.entries.write().await;
        lock.clear();
    }

    pub async fn stats(&self) -> CacheStats {
        let lock = self.entries.read().await;
        CacheStats {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            item_count: lock.len(),
        }
    }
}

/// Centralized Cache Manager
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
    pub fn new() -> Self {
        Self {
            covers: BoundedCache::new(50),
            document_metadata: BoundedCache::new(100),
            search_queries: BoundedCache::new(50),
        }
    }

    pub async fn invalidate_book(&self, book_id: &str) {
        self.covers.remove(&book_id.to_string()).await;
        self.document_metadata.remove(&book_id.to_string()).await;
        self.search_queries.clear().await;
    }

    pub async fn clear_all(&self) {
        self.covers.clear().await;
        self.document_metadata.clear().await;
        self.search_queries.clear().await;
    }
}
