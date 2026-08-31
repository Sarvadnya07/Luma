use luma_core::ids::{BookId, DeviceId};
use luma_core::models::reading::{Bookmark, ReadingProgress};
use luma_storage::repos::{BookmarkRepository, ReadingProgressRepository};
use luma_storage::Database;

#[test]
fn test_bookmark_repository_crud() {
    let db = Database::open_in_memory().expect("in-memory db");
    let repo = BookmarkRepository::new(db.clone());

    let book_id = BookId::new();
    let device_id = DeviceId::new();

    let mut bmk1 = Bookmark::new(book_id, "epubcfi(/6/2!/4/1:0)", device_id);
    bmk1.title = Some("Chapter 1 Bookmark".to_string());
    bmk1.chapter_title = Some("Chapter 1".to_string());
    bmk1.page_number = Some(1);

    repo.insert(&bmk1).expect("Insert bookmark failed");

    let list = repo
        .list_by_book_id(&book_id)
        .expect("List bookmarks failed");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, bmk1.id);
    assert_eq!(list[0].title.as_deref(), Some("Chapter 1 Bookmark"));

    repo.delete(&bmk1.id).expect("Delete bookmark failed");
    let after_delete = repo.list_by_book_id(&book_id).expect("List after delete");
    assert_eq!(after_delete.len(), 0);
}

#[test]
fn test_reading_progress_save_and_restore() {
    let db = Database::open_in_memory().expect("in-memory db");
    let repo = ReadingProgressRepository::new(db.clone());

    let book_id = BookId::new();
    let device_id = DeviceId::new();

    let mut progress = ReadingProgress::new(book_id, "epubcfi(/6/4[ch2]!/4/10)", device_id);
    progress.progress_percentage = 0.45;
    progress.current_chapter_title = Some("Chapter 2: State Machine Replication".to_string());
    progress.current_page_number = Some(2);
    progress.total_pages = Some(5);

    repo.save(&progress).expect("Save reading progress");

    let restored = repo
        .get(&book_id)
        .expect("Get reading progress")
        .expect("Progress exists");
    assert_eq!(restored.book_id, book_id);
    assert_eq!(restored.current_locator, "epubcfi(/6/4[ch2]!/4/10)");
    assert_eq!(restored.progress_percentage, 0.45);
    assert_eq!(restored.current_page_number, Some(2));
}
