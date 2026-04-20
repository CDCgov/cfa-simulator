use anyhow::Result;
use axoupdater::{AxoUpdater, ReleaseSource, ReleaseSourceType};

const APP_NAME: &str = "cfasim";
const GH_OWNER: &str = "CDCgov";
const GH_REPO: &str = "cfa-simulator";

pub fn configured_updater() -> AxoUpdater {
    let mut updater = AxoUpdater::new_for(APP_NAME);
    updater.set_release_source(ReleaseSource {
        release_type: ReleaseSourceType::GitHub,
        owner: GH_OWNER.to_string(),
        name: GH_REPO.to_string(),
        app_name: APP_NAME.to_string(),
    });
    updater
}

pub fn run() -> Result<()> {
    let current = env!("CARGO_PKG_VERSION");
    cliclack::intro(format!("cfasim update (current: v{current})"))?;

    let spinner = cliclack::spinner();
    spinner.start("Checking for updates...");

    let current_exe = std::env::current_exe()?;
    let install_dir = current_exe
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Can't determine install directory"))?;

    let mut updater = configured_updater();
    updater.set_install_dir(install_dir.to_string_lossy().as_ref());
    updater
        .set_current_version(current.parse()?)
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    let update_needed = updater
        .is_update_needed_sync()
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    if !update_needed {
        spinner.stop(format!("v{current} is already the latest version"));
        cliclack::outro("Nothing to do")?;
        return Ok(());
    }

    spinner.stop("New version available");
    let update_spinner = cliclack::spinner();
    update_spinner.start("Downloading and installing...");

    let result = updater.run_sync().map_err(|e| anyhow::anyhow!("{e}"))?;

    match result {
        Some(update_result) => {
            update_spinner.stop(format!("Updated to v{}", update_result.new_version));
            cliclack::outro("Update complete")?;
        }
        None => {
            update_spinner.stop("No update performed");
            cliclack::outro("Nothing to do")?;
        }
    }

    Ok(())
}
