#![deny(rust_2018_idioms)]

use orchestrator::coordinator::{
    limits::{self, Acquisition},
    CoordinatorFactory, ResourceLimits,
};
use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

const DEFAULT_ADDRESS: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5000;

const DEFAULT_WEBSOCKET_IDLE_TIMEOUT: Duration = Duration::from_secs(60);
const DEFAULT_WEBSOCKET_SESSION_TIMEOUT: Duration = Duration::from_secs(45 * 60);

const DEFAULT_COORDINATORS_LIMIT: usize = 25;
const DEFAULT_PROCESSES_LIMIT: usize = 10;

mod env;
mod gist;
mod metrics;
mod public_http_api;
mod request_database;
mod server_axum;

use env::{PLAYGROUND_GITHUB_TOKEN, PLAYGROUND_UI_ROOT};

fn main() {
    // Dotenv may be unable to load environment variables, but that's ok in production
    let _ = dotenv::dotenv();
    // SAFETY: We have not started any other threads yet.
    unsafe {
        openssl_probe::init_openssl_env_vars();
    }

    // Info-level logging is enabled by default.
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = Config::from_env();
    server_axum::serve(config);
}

#[derive(Copy, Clone)]
pub(crate) struct FeatureFlags {}

#[derive(Clone)]
struct Config {
    address: String,
    cors_enabled: bool,
    gh_token: Option<String>,
    metrics_token: Option<String>,
    feature_flags: FeatureFlags,
    request_db_path: Option<PathBuf>,
    websocket_config: WebSocketConfig,
    limits: Arc<dyn ResourceLimits>,
    port: u16,
    root: PathBuf,
    public_url: String,
}

impl Config {
    fn from_env() -> Self {
        let root = if let Some(root) = env::var_os(PLAYGROUND_UI_ROOT) {
            // Ensure it appears as an absolute path in logs to help user orient
            // themselves about what directory the PLAYGROUND_UI_ROOT
            // configuration is interpreted relative to.
            let mut root = PathBuf::from(root);
            if !root.is_absolute() {
                if let Ok(current_dir) = env::current_dir() {
                    root = current_dir.join(root);
                }
            }
            root
        } else {
            // Note this is `env!` (compile time) while the above is
            // `env::var_os` (run time). We know where the ui is expected to be
            // relative to the source code that the server was compiled from.
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("frontend")
                .join("build")
        };

        let index_html = root.join("index.html");
        if index_html.exists() {
            info!("Serving playground frontend from {}", root.display());
        } else {
            error!(
                "Playground ui does not exist at {}\n\
                Playground will not work until `pnpm build` has been run or {PLAYGROUND_UI_ROOT} has been fixed",
                index_html.display(),
            );
        }

        let address =
            env::var("PLAYGROUND_UI_ADDRESS").unwrap_or_else(|_| DEFAULT_ADDRESS.to_string());
        let port = env::var("PLAYGROUND_UI_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DEFAULT_PORT);

        let gh_token = env::var(PLAYGROUND_GITHUB_TOKEN).ok();
        if gh_token.is_none() {
            warn!("Environment variable {} is not set, so reading and writing GitHub gists will not work", PLAYGROUND_GITHUB_TOKEN);
        }

        let metrics_token = env::var("PLAYGROUND_METRICS_TOKEN").ok();
        let public_url = env::var("PLAYGROUND_PUBLIC_URL").unwrap_or_else(|_| "".to_string());

        let cors_enabled = env::var_os("PLAYGROUND_CORS_ENABLED").is_some();

        let feature_flags = FeatureFlags {};

        let request_db_path = env::var_os("PLAYGROUND_REQUEST_DATABASE").map(Into::into);

        let websocket_config = {
            let idle_timeout = env::var("PLAYGROUND_WEBSOCKET_IDLE_TIMEOUT_S")
                .ok()
                .and_then(|l| l.parse().map(Duration::from_secs).ok())
                .unwrap_or(DEFAULT_WEBSOCKET_IDLE_TIMEOUT);

            let session_timeout = env::var("PLAYGROUND_WEBSOCKET_SESSION_TIMEOUT_S")
                .ok()
                .and_then(|l| l.parse().map(Duration::from_secs).ok())
                .unwrap_or(DEFAULT_WEBSOCKET_SESSION_TIMEOUT);

            WebSocketConfig {
                idle_timeout,
                session_timeout,
            }
        };

        let coordinators_limit = env::var("PLAYGROUND_COORDINATORS_LIMIT")
            .ok()
            .and_then(|l| l.parse().ok())
            .unwrap_or(DEFAULT_COORDINATORS_LIMIT);

        let processes_limit = env::var("PLAYGROUND_PROCESSES_LIMIT")
            .ok()
            .and_then(|l| l.parse().ok())
            .unwrap_or(DEFAULT_PROCESSES_LIMIT);

        let limits = Arc::new(limits::Global::with_lifecycle(
            coordinators_limit,
            processes_limit,
            LifecycleMetrics,
        ));

        Self {
            address,
            cors_enabled,
            gh_token,
            metrics_token,
            feature_flags,
            request_db_path,
            websocket_config,
            limits,
            port,
            root,
            public_url,
        }
    }

    fn root_path(&self) -> &Path {
        &self.root
    }

    fn asset_path(&self) -> PathBuf {
        self.root.join("assets")
    }

    fn use_cors(&self) -> bool {
        self.cors_enabled
    }

    fn metrics_token(&self) -> Option<MetricsToken> {
        self.metrics_token.as_deref().map(MetricsToken::new)
    }

    fn github_token(&self) -> GhToken {
        GhToken::new(&self.gh_token)
    }

    fn request_database(&self) -> request_database::Database {
        use request_database::Database;

        let request_db = match &self.request_db_path {
            Some(path) => Database::initialize(path),
            None => Database::initialize_memory(),
        };

        request_db.expect("Unable to open request log database")
    }

    fn coordinator_factory(&self) -> CoordinatorFactory {
        CoordinatorFactory::new(self.limits.clone())
    }

    fn server_socket_addr(&self) -> SocketAddr {
        let address = self.address.parse().expect("Invalid address");
        SocketAddr::new(address, self.port)
    }
}

#[derive(Debug, Clone)]
struct GhToken(Option<Arc<String>>);

impl GhToken {
    fn new(token: &Option<String>) -> Self {
        GhToken(token.clone().map(Arc::new))
    }
}

#[derive(Debug, Clone)]
struct MetricsToken(Arc<String>);

impl MetricsToken {
    fn new(token: impl Into<String>) -> Self {
        MetricsToken(Arc::new(token.into()))
    }
}

#[derive(Debug, Copy, Clone)]
struct LifecycleMetrics;

impl limits::Lifecycle for LifecycleMetrics {
    fn container_start(&self) {
        metrics::CONTAINER_QUEUE.inc();
    }

    fn container_acquired(&self, how: limits::Acquisition) {
        metrics::CONTAINER_QUEUE.dec();

        if how == Acquisition::Acquired {
            metrics::CONTAINER_ACTIVE.inc();
        }
    }

    fn container_release(&self) {
        metrics::CONTAINER_ACTIVE.dec();
    }

    fn process_start(&self) {
        metrics::PROCESS_QUEUE.inc();
    }

    fn process_acquired(&self, how: limits::Acquisition) {
        metrics::PROCESS_QUEUE.dec();

        if how == Acquisition::Acquired {
            metrics::PROCESS_ACTIVE.inc();
        }
    }

    fn process_release(&self) {
        metrics::PROCESS_ACTIVE.dec();
    }
}

#[derive(Debug, Copy, Clone)]
struct WebSocketConfig {
    idle_timeout: Duration,
    session_timeout: Duration,
}
