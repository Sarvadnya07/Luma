use luma_core::ids::DeviceId;
use luma_core::models::book::Book;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::repos::{AuthorRepository, BookRepository, LibraryFilterOptions, LibrarySortOptions};
use luma_storage::services::SearchService;
use std::time::Instant;


#[tokio::test]
async fn test_benchmark_library_query_hot_path() {
    let db = Database::open_in_memory().expect("in-memory db");
    let book_repo = BookRepository::new(db.clone());
    let author_repo = AuthorRepository::new(db.clone());
    let device_id = DeviceId::new();

    // Insert authors
    let mut author_ids = Vec::new();
    for i in 0..10 {
        let auth = author_repo
            .get_or_create_by_name(&format!("Author {:02}", i), device_id)
            .expect("author");
        author_ids.push(auth.id);
    }


    // Insert 1,000 books with author relationships into the database
    let insert_start = Instant::now();
    for i in 0..1000 {
        let mut b = Book::new(format!("Benchmark Book Title {:04}", i), device_id);
        b.author_ids.push(author_ids[i % author_ids.len()]);
        book_repo.insert(&b).expect("insert");
    }
    let insert_duration = insert_start.elapsed();
    println!("Time to insert 1000 books with authors: {:?}", insert_duration);

    // Benchmark 20 consecutive list queries of page size 50 with batch author population
    let filter = LibraryFilterOptions::default();
    let sort = LibrarySortOptions::default();

    let list_start = Instant::now();
    for page in 0..20 {
        let page_results = book_repo.list(&filter, &sort, page, 50).expect("list");
        assert_eq!(page_results.len(), 50);
        assert!(!page_results[0].author_ids.is_empty());
    }
    let list_duration = list_start.elapsed();
    println!("Time for 20 pages of list queries (1000 items total with batch authors): {:?}", list_duration);
}

#[tokio::test]
async fn test_benchmark_search_hot_path() {
    let db = Database::open_in_memory().expect("in-memory db");
    let event_bus = EventBus::default();
    let cache = CacheManager::new();
    let search_service = SearchService::new(db.clone(), event_bus, cache);

    // Seed FTS records
    let _ = search_service.rebuild_index().await;

    let search_start = Instant::now();
    for _ in 0..50 {
        let res = search_service
            .search_library("Benchmark", None, 50)
            .await
            .expect("search");
        assert!(res.query_duration_ms >= 0.0);
    }
    let search_duration = search_start.elapsed();
    println!("Time for 50 FTS5 search operations: {:?}", search_duration);
}
