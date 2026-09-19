use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use luma_core::ids::{AnnotationId, BookId, BookmarkId, DeviceId};
use luma_core::models::annotation::Annotation;
use luma_core::models::reading::{ReadingProgress, ReadingSession};
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{
    JobRepository, LibraryFilterOptions, LibrarySortOptions, ReadingSessionRepository,
};
use luma_storage::services::{
    AnnotationService, BookmarkService, CollectionService, ImportService, LibraryService,
    ReaderService, ReadingProgressService,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::runtime::Runtime;

#[derive(Clone)]
struct BridgeState {
    library: LibraryService,
    reader: ReaderService,
    import: ImportService,
    annotations: AnnotationService,
    bookmarks: BookmarkService,
    progress: ReadingProgressService,
    collections: CollectionService,
    db: Database,
    library_dir: PathBuf,
    book_id: BookId,
    fixture: PathBuf,
    evidence_path: PathBuf,
}

#[derive(Deserialize)]
struct RequestEnvelope {
    command: String,
    #[serde(default)]
    args: Value,
}

#[derive(Serialize)]
struct ResponseEnvelope<T: Serialize> {
    result: Option<T>,
    error: Option<String>,
}

fn response<T: Serialize>(value: T) -> String {
    serde_json::to_string(&ResponseEnvelope {
        result: Some(value),
        error: None::<String>,
    })
    .expect("serialize bridge response")
}

fn error_response(message: impl Into<String>) -> String {
    serde_json::to_string(&ResponseEnvelope::<Value> {
        result: None,
        error: Some(message.into()),
    })
    .expect("serialize bridge error")
}

fn json_arg<T: for<'de> Deserialize<'de>>(args: &Value, key: &str) -> Result<T, String> {
    serde_json::from_value(args.get(key).cloned().unwrap_or(Value::Null))
        .map_err(|e| format!("invalid argument {key}: {e}"))
}

fn handle_command(
    state: &BridgeState,
    request: RequestEnvelope,
    runtime: &Runtime,
) -> Result<Value, String> {
    match request.command.as_str() {
        "list_books" => {
            let books = state
                .library
                .list_books(
                    &LibraryFilterOptions::default(),
                    &LibrarySortOptions::default(),
                    0,
                    100,
                )
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(books).map_err(|e| e.to_string())?)
        }
        "get_book_cover_data_url" => Ok(Value::Null),
        "get_book_details" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let details = state
                .library
                .get_book_details(&id)
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(details).map_err(|e| e.to_string())?)
        }
        "open_reader_document" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let document = runtime
                .block_on(state.reader.open_document(&id, None))
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(document).map_err(|e| e.to_string())?)
        }
        "get_reader_chapter" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let spine_index: usize = json_arg(&request.args, "spineIndex")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let chapter = runtime
                .block_on(state.reader.get_chapter(&id, spine_index))
                .map_err(|e| e.to_string())?;
            let chapter_id = chapter.id.clone();
            let evidence = json!({
                "readerService": { "openDocument": true, "getChapter": true },
                "epubDocument": { "loaded": true },
                "fixture": state.fixture,
                "bookId": book_id,
                "chapterId": chapter_id,
            });
            fs::write(
                &state.evidence_path,
                serde_json::to_vec_pretty(&evidence).unwrap(),
            )
            .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(chapter).map_err(|e| e.to_string())?)
        }
        "import_file_bytes" => {
            // Browser drag-and-drop / file-picker import: the WebView cannot
            // pass physical paths, so the UI sends (filename, bytes). Mirror
            // the desktop command's staging flow: write a unique temp file
            // into the bridge's staging dir, then run the real ImportService
            // on it so the import path (duplicate detection, hashing,
            // transactional persistence) is exercised, not a mock.
            let filename: String = json_arg(&request.args, "filename")?;
            let data: Vec<u8> = json_arg(&request.args, "data")?;
            if data.is_empty() {
                return Err("import_file_bytes: empty payload".to_string());
            }

            // Reuse the staging dir inside the bridge's isolated data root.
            let staging_dir = state
                .library_dir
                .parent()
                .map(|root| root.join("staging"))
                .ok_or_else(|| "bridge library dir has no parent".to_string())?;
            fs::create_dir_all(&staging_dir).map_err(|e| e.to_string())?;
            let temp_filename = format!("bridge_{}", filename.replace(['\\', '/'], "_"));
            let temp_path = staging_dir.join(&temp_filename);
            fs::write(&temp_path, &data).map_err(|e| e.to_string())?;

            let device = DeviceId::new();
            let job = runtime
                .block_on(
                    state
                        .import
                        .import_files(std::slice::from_ref(&temp_path), device),
                )
                .map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&temp_path);
            Ok(serde_json::to_value(job).map_err(|e| e.to_string())?)
        }
        "get_reader_pdf_page" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let page_number: u32 = json_arg(&request.args, "pageNumber")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let page = runtime
                .block_on(state.reader.get_pdf_page(&id, page_number))
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(page).map_err(|e| e.to_string())?)
        }
        "get_book_file_bytes" => {
            // Raw bytes for the PDF.js/pdf worker path. Same wire contract as
            // the desktop Tauri command: Vec<u8> serializes as a JSON number
            // array, which the frontend feeds to `new Uint8Array(...)`.
            let book_id: String = json_arg(&request.args, "bookId")?;
            let file_id: Option<String> = json_arg(&request.args, "fileId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let fid = match &file_id {
                Some(s) => Some(
                    s.parse::<luma_core::ids::FileId>()
                        .map_err(|e| e.to_string())?,
                ),
                None => None,
            };
            let bytes = state
                .reader
                .get_file_bytes(&id, fid.as_ref())
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(bytes).map_err(|e| e.to_string())?)
        }
        "search_document" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let query: String = json_arg(&request.args, "query")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let matches = runtime
                .block_on(state.reader.search_document(&id, &query))
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(matches).map_err(|e| e.to_string())?)
        }
        "list_annotations" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let annotations = state
                .annotations
                .list_by_book(&id)
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(annotations).map_err(|e| e.to_string())?)
        }
        "list_all_annotations" => {
            let annotations = state.annotations.list_all().map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(annotations).map_err(|e| e.to_string())?)
        }
        "save_annotation" => {
            let annotation: Annotation = json_arg(&request.args, "annotation")?;
            runtime
                .block_on(state.annotations.save_annotation(&annotation))
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "update_annotation_note" => {
            let annotation_id: String = json_arg(&request.args, "annotationId")?;
            let note: Option<String> = json_arg(&request.args, "note")?;
            let id = annotation_id
                .parse::<AnnotationId>()
                .map_err(|e| e.to_string())?;
            runtime
                .block_on(state.annotations.update_note(&id, note.as_deref(), None))
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "delete_annotation" => {
            let annotation_id: String = json_arg(&request.args, "annotationId")?;
            let id = annotation_id
                .parse::<AnnotationId>()
                .map_err(|e| e.to_string())?;
            runtime
                .block_on(state.annotations.delete_annotation(&id, None))
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "list_bookmarks" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let bookmarks = state
                .bookmarks
                .list_by_book(&id)
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(bookmarks).map_err(|e| e.to_string())?)
        }
        "create_bookmark" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let locator: String = json_arg(&request.args, "locator")?;
            let title: Option<String> = json_arg(&request.args, "title")?;
            let chapter_title: Option<String> = json_arg(&request.args, "chapterTitle")?;
            let page_number: Option<u32> = json_arg(&request.args, "pageNumber")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let bookmark = state
                .bookmarks
                .create_bookmark(
                    id,
                    locator,
                    title,
                    chapter_title,
                    page_number,
                    DeviceId::new(),
                )
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(bookmark).map_err(|e| e.to_string())?)
        }
        "delete_bookmark" => {
            let bookmark_id: String = json_arg(&request.args, "bookmarkId")?;
            let id = bookmark_id
                .parse::<BookmarkId>()
                .map_err(|e| e.to_string())?;
            state
                .bookmarks
                .delete_bookmark(&id, None)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "get_reading_progress" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let progress = state
                .progress
                .get_progress(&id)
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(progress).map_err(|e| e.to_string())?)
        }
        "save_reading_progress" => {
            let progress: ReadingProgress = json_arg(&request.args, "progress")?;
            state
                .progress
                .save_progress(&progress)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "start_reading_session" => {
            let book_id: String = json_arg(&request.args, "bookId")?;
            let start_progress: f32 = json_arg(&request.args, "startProgress")?;
            let id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
            let session = ReadingSession::start(id, DeviceId::new(), start_progress);
            let repo = ReadingSessionRepository::new(state.db.clone());
            repo.insert(&session).map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(session).map_err(|e| e.to_string())?)
        }
        "complete_reading_session" => {
            let session_id: String = json_arg(&request.args, "sessionId")?;
            let end_progress: f32 = json_arg(&request.args, "endProgress")?;
            let duration_seconds: u32 = json_arg(&request.args, "durationSeconds")?;
            let sid = session_id
                .parse::<luma_core::ids::SessionId>()
                .map_err(|e| e.to_string())?;
            let repo = ReadingSessionRepository::new(state.db.clone());
            repo.complete_session(&sid, end_progress, duration_seconds)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "list_collections" => {
            let items = state
                .collections
                .list_collections()
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(items).map_err(|e| e.to_string())?)
        }
        "list_tags" => {
            let items = state.collections.list_tags().map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(items).map_err(|e| e.to_string())?)
        }
        "list_authors" => {
            let items = state
                .collections
                .list_authors()
                .map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(items).map_err(|e| e.to_string())?)
        }
        "list_series" => {
            let items = state.collections.list_series().map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(items).map_err(|e| e.to_string())?)
        }
        "get_reading_analytics" => {
            let repo = ReadingSessionRepository::new(state.db.clone());
            let analytics = repo.get_analytics().map_err(|e| e.to_string())?;
            Ok(serde_json::to_value(analytics).map_err(|e| e.to_string())?)
        }
        _ => Err(format!(
            "unsupported browser bridge command: {}",
            request.command
        )),
    }
}

fn handle_connection(mut stream: TcpStream, state: BridgeState, runtime: Arc<Runtime>) {
    let mut bytes = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                bytes.extend_from_slice(&chunk[..n]);
                if bytes.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            Err(_) => return,
        }
    }

    let request_text = String::from_utf8_lossy(&bytes);
    let content_length = request_text
        .lines()
        .find_map(|line| {
            line.strip_prefix("Content-Length:")
                .or_else(|| line.strip_prefix("content-length:"))
        })
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0);
    let header_end = request_text.find("\r\n\r\n").unwrap_or(request_text.len()) + 4;
    while bytes.len() < header_end + content_length {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => bytes.extend_from_slice(&chunk[..n]),
            Err(_) => return,
        }
    }

    let request_text = String::from_utf8_lossy(&bytes);
    let path = request_text
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let body = &request_text[header_end.min(request_text.len())..];

    let method = request_text
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().next())
        .unwrap_or("GET");

    let (status, payload) = if method == "OPTIONS" {
        // The bridge is driven from a browser page on another origin, so the
        // preflight must be answered or every command fails at CORS before it
        // reaches the real services.
        ("204 No Content", String::new())
    } else if path == "/health" {
        ("200 OK", response(json!({ "status": "ok" })))
    } else if path == "/api/invoke" {
        match serde_json::from_str::<RequestEnvelope>(body)
            .map_err(|e| e.to_string())
            .and_then(|request| handle_command(&state, request, &runtime))
        {
            Ok(value) => ("200 OK", response(value)),
            Err(message) => ("500 Internal Server Error", error_response(message)),
        }
    } else {
        ("404 Not Found", error_response("unknown bridge path"))
    };

    let response_text = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nConnection: close\r\n\r\n{}",
        payload.len(), payload
    );
    let _ = stream.write_all(response_text.as_bytes());
}

fn fixture_path() -> PathBuf {
    env::var_os("LUMA_BROWSER_EPUB_FIXTURE")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../tests/fixtures/sample_book.epub")
        })
}

fn main() {
    let runtime = Runtime::new().expect("create tokio runtime");
    let fixture = fixture_path();
    assert!(
        fixture.exists(),
        "EPUB fixture does not exist: {}",
        fixture.display()
    );

    let temp_root = env::temp_dir().join(format!("luma-browser-reader-{}", std::process::id()));
    if temp_root.exists() {
        fs::remove_dir_all(&temp_root).expect("remove stale bridge temp directory");
    }
    fs::create_dir_all(&temp_root).expect("create isolated bridge temp directory");
    let data_dir = temp_root.join("data");
    fs::create_dir_all(&data_dir).expect("create bridge data directory");
    let db = Database::open(data_dir.join("luma.db")).expect("open bridge database");
    let event_bus = EventBus::default();
    let file_service = FileService::new(&data_dir);
    let cache = CacheManager::new();
    let jobs = JobManager::new(JobRepository::new(db.clone()), event_bus.clone());
    let import = ImportService::new(
        db.clone(),
        file_service,
        event_bus.clone(),
        jobs,
        cache.clone(),
    );
    let device = DeviceId::new();
    let imported = runtime
        .block_on(import.import_files(std::slice::from_ref(&fixture), device))
        .expect("import real EPUB through ImportService");
    let item = imported.items.first().expect("import item");
    let book_id = item.book_id.expect("imported book id");
    let book_file_id = item.file_id.expect("imported book file id");
    let book_file_path = data_dir.join("library");
    eprintln!(
        "LUMA_BROWSER_IMPORT fixture={} importService=true bookId={} bookFileId={} libraryDir={}",
        fixture.display(),
        book_id,
        book_file_id,
        book_file_path.display()
    );

    let library = LibraryService::new(db.clone(), event_bus);
    let reader = ReaderService::new(db.clone(), cache.clone());
    // Same real services the desktop Tauri commands use, so every browser
    // bridge command exercises the production backend path.
    let annotations = AnnotationService::new(db.clone(), EventBus::default(), cache.clone());
    let bookmarks = BookmarkService::new(db.clone(), EventBus::default());
    let progress = ReadingProgressService::new(db.clone(), EventBus::default());
    let collections = CollectionService::new(db.clone());
    // Keep an import handle for browser drag-and-drop imports
    // (import_file_bytes) — the same real ImportService used at startup.
    let import = ImportService::new(
        db.clone(),
        FileService::new(&data_dir),
        EventBus::default(),
        JobManager::new(JobRepository::new(db.clone()), EventBus::default()),
        cache,
    );
    let library_dir = data_dir.join("library");
    let evidence_path = env::var_os("LUMA_BROWSER_RUNTIME_EVIDENCE")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            Path::new("docs/reader-recovery/runtime-artifacts/browser-reader-runtime.json")
                .to_path_buf()
        });
    let state = BridgeState {
        library,
        reader,
        import,
        annotations,
        bookmarks,
        progress,
        collections,
        db: db.clone(),
        library_dir,
        book_id,
        fixture,
        evidence_path,
    };

    // Port 0 = OS-assigned (default). Pin with LUMA_BROWSER_BRIDGE_PORT so
    // long-lived setups (e.g. the browser preview's .env.local) survive
    // bridge restarts without re-pointing the frontend.
    let port: u16 = env::var("LUMA_BROWSER_BRIDGE_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    let listener = TcpListener::bind(("127.0.0.1", port)).expect("bind localhost bridge");
    let address = listener.local_addr().expect("bridge address");
    println!("LUMA_BROWSER_BRIDGE_URL=http://{}", address);
    println!("LUMA_BROWSER_BOOK_ID={}", state.book_id);
    std::io::stdout()
        .flush()
        .expect("flush bridge startup output");

    let runtime = Arc::new(runtime);
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let state = state.clone();
                let runtime = runtime.clone();
                thread::spawn(move || handle_connection(stream, state, runtime));
            }
            Err(error) => eprintln!("bridge connection error: {error}"),
        }
    }
}
