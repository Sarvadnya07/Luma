use std::fs;
use std::path::Path;

fn repository_reach_throughs_in_collection_command() -> Vec<String> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/desktop/src-tauri/src/commands/collection.rs");
    let source = fs::read_to_string(path).expect("collection command source should be readable");

    source
        .lines()
        .filter(|line| line.contains("Repository::new(ctx.db.clone())"))
        .map(str::to_owned)
        .collect()
}

#[test]
fn tauri_commands_do_not_construct_storage_repositories_directly() {
    let violations = repository_reach_throughs_in_collection_command();

    // Other command families are intentionally tracked as an incremental
    // migration item in ADR-0024; this fitness function protects the boundary
    // that has already been migrated.
    assert!(
        violations.is_empty(),
        "Tauri commands must call application services instead of reaching into storage:\n{}",
        violations.join("\n")
    );
}

#[test]
fn storage_application_boundary_is_explicit() {
    let source = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../luma-storage/src/lib.rs"),
    )
    .expect("storage lib source should be readable");

    assert!(
        !source.contains("pub use repos::*") && !source.contains("pub use services::*"),
        "storage must not wildcard-export internal repositories or services"
    );
    assert!(
        source.contains("CollectionService"),
        "collection operations must have an explicit application service"
    );
}
