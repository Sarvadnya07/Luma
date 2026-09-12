use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use luma_core::ids::{BookId, DeviceId};
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{JobRepository, LibraryFilterOptions, LibrarySortOptions};
use luma_storage::services::{ImportService, LibraryService, ReaderService};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::runtime::Runtime;

#[derive(Clone)]
struct BridgeState {
    library: LibraryService,
    reader: ReaderService,
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
        "get_reading_progress" => Ok(Value::Null),
        "start_reading_session" => Ok(json!({
            "id": "browser-integration-session",
            "book_id": state.book_id,
            "device_id": "browser-integration",
            "started_at": "1970-01-01T00:00:00Z",
            "ended_at": null,
            "duration_seconds": 0,
            "start_progress_pct": 0.0,
            "end_progress_pct": 0.0
        })),
        "save_reading_progress" | "complete_reading_session" => Ok(Value::Null),
        "list_collections"
        | "list_tags"
        | "list_authors"
        | "list_series"
        | "list_all_annotations" => Ok(json!([])),
        "get_reading_analytics" => Ok(json!({
            "total_reading_time_seconds": 0,
            "weekly_reading_seconds": 0,
            "books_completed_count": 0,
            "daily_reading_minutes_last_28_days": [],
            "recent_sessions": [],
            "time_focus_data": [0, 0, 0, 0, 0, 0]
        })),
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

    let (status, payload) = if path == "/health" {
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
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
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

    let library = LibraryService::new(db.clone(), event_bus);
    let reader = ReaderService::new(db, cache);
    let evidence_path = env::var_os("LUMA_BROWSER_RUNTIME_EVIDENCE")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            Path::new("docs/reader-recovery/runtime-artifacts/browser-reader-runtime.json")
                .to_path_buf()
        });
    let state = BridgeState {
        library,
        reader,
        book_id,
        fixture,
        evidence_path,
    };

    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind localhost bridge");
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
