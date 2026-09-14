//! ARCH-02 fitness functions: continuously enforce the crate dependency
//! layering documented in docs/architecture/ARCHITECTURE-PRINCIPLES.md and
//! docs/architecture/DEPENDENCY-POLICY.md.
//!
//! Allowed edges (direction = "depends on"):
//!   core        <- nothing
//!   security    <- core
//!   anchor      <- core
//!   reader      <- core, security
//!   storage     <- core, anchor, reader, security
//!   search      <- core, storage
//!   sync        <- core
//!   ai          <- core
//!   desktop app <- all crates
//!
//! Any new luma-* dependency not listed here fails CI. Update ALLOWED_EDGES
//! deliberately when a boundary change is intentional, and record it in an ADR.

use std::collections::BTreeMap;

/// The enforced layering, as allowed `dependency -> caller` edges.
fn allowed_edges() -> BTreeMap<&'static str, Vec<&'static str>> {
    BTreeMap::from([
        ("luma-core", vec![]),
        ("luma-security", vec!["luma-core"]),
        ("luma-anchor", vec!["luma-core"]),
        ("luma-reader", vec!["luma-core", "luma-security"]),
        (
            "luma-storage",
            vec!["luma-core", "luma-anchor", "luma-reader", "luma-security"],
        ),
        ("luma-search", vec!["luma-core", "luma-storage"]),
        ("luma-sync", vec!["luma-core"]),
        ("luma-ai", vec!["luma-core"]),
    ])
}

/// Every luma-* dependency declared in a crate's Cargo.toml.
fn declared_dependencies(crate_name: &str) -> Vec<String> {
    let manifest_path = format!("../../crates/{crate_name}/Cargo.toml");
    let manifest = std::fs::read_to_string(&manifest_path)
        .unwrap_or_else(|e| panic!("failed to read {manifest_path}: {e}"));

    let mut deps = Vec::new();
    let mut in_relevant_table = false;
    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_relevant_table = matches!(
                trimmed,
                "[dependencies]" | "[dependencies.]" | "[build-dependencies]"
            );
            continue;
        }
        if in_relevant_table {
            if let Some((name, _)) = trimmed.split_once('=') {
                let name = name.trim();
                if name.starts_with("luma-") {
                    deps.push(name.to_string());
                }
            }
        }
    }
    deps.sort();
    deps.dedup();
    deps
}

#[test]
fn crate_dependency_direction_matches_documented_layering() {
    let allowed = allowed_edges();
    let mut violations = Vec::new();

    for (crate_name, allowed_deps) in &allowed {
        for dep in declared_dependencies(crate_name) {
            let dep_name: &str = &dep;
            if !allowed_deps.contains(&dep_name) {
                violations.push(format!("{crate_name} -> {dep} (not in allowed layering)"));
            }
        }
    }

    assert!(
        violations.is_empty(),
        "Crate dependency direction violated the documented layering:\n  {}\n\
         If this boundary change is intentional, update ALLOWED_EDGES in \
         crates/luma-storage/tests/architecture_boundaries.rs and record an ADR.",
        violations.join("\n  ")
    );
}

#[test]
fn layering_table_covers_every_workspace_crate() {
    // Guards against a new crate silently escaping the policy: if a crate is
    // added to the workspace but not to allowed_edges(), this fails.
    let root_manifest =
        std::fs::read_to_string("../../Cargo.toml").expect("failed to read workspace Cargo.toml");
    let mut workspace_crates: Vec<&str> = root_manifest
        .lines()
        .filter_map(|l| l.trim().strip_prefix("\"crates/"))
        .filter_map(|l| l.strip_suffix("\","))
        .collect();
    workspace_crates.sort_unstable();

    let allowed = allowed_edges();
    let mut policed: Vec<&str> = allowed.keys().copied().collect();
    policed.sort_unstable();

    assert_eq!(
        workspace_crates, policed,
        "Workspace crates and the layering policy are out of sync. \
         Add every new crate to allowed_edges()."
    );
}

#[test]
fn workspace_dependency_cycles_do_not_exist() {
    // Transitive reachability check: no crate may reach itself through
    // allowed edges. With the current DAG this is trivially true, but it
    // fails immediately if someone adds a cycle to the policy table itself.
    let allowed = allowed_edges();

    fn reaches<'a>(
        from: &'a str,
        to: &str,
        allowed: &BTreeMap<&'a str, Vec<&'a str>>,
        seen: &mut Vec<&'a str>,
    ) -> bool {
        if seen.contains(&from) {
            return false; // already visited on this path
        }
        seen.push(from);
        for &next in allowed.get(from).map(|v| v.as_slice()).unwrap_or(&[]) {
            if next == to || reaches(next, to, allowed, seen) {
                return true;
            }
        }
        seen.pop();
        false
    }

    for &crate_name in allowed.keys() {
        let mut seen = Vec::new();
        assert!(
            !reaches(crate_name, crate_name, &allowed, &mut seen),
            "Dependency cycle detected through {crate_name}"
        );
    }
}
