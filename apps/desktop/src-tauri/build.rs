fn main() {
    // ------------------------------------------------------------------------
    // Configure build behaviour via environment variables
    // ------------------------------------------------------------------------

    // Enable verbose logging: `LUMA_BUILD_VERBOSE=1 cargo build`
    let verbose = std::env::var("LUMA_BUILD_VERBOSE").is_ok();

    // Allow custom output directory: `LUMA_BUILD_OUT_DIR=./custom_target`
    let _out_dir = std::env::var("LUMA_BUILD_OUT_DIR").ok();

    // Re-run build if these environment variables change
    println!("cargo:rerun-if-env-changed=LUMA_BUILD_VERBOSE");
    println!("cargo:rerun-if-env-changed=LUMA_BUILD_OUT_DIR");

    if verbose {
        println!("Starting Tauri build...");
        if let Some(dir) = _out_dir {
            println!("Using custom output directory: {}", dir);
        }
    }

    // ------------------------------------------------------------------------
    // You can insert custom pre‑build steps here
    // e.g., generate version file, check dependencies, etc.
    // ------------------------------------------------------------------------

    // Perform the Tauri build (this will panic on failure)
    tauri_build::build();

    if verbose {
        println!("Tauri build completed successfully.");
    }
}